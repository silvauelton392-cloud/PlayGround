#!/usr/bin/env bash
# Build RELEASE otimizado (R8 + assets minificados) — um APK por app,
# cada um com seu applicationId (downloads separados, sem conflito):
#   ./build-apk.sh oa    → apks/oa-sens-hud/OASensHUD-vX.Y.Z.apk   (com.oasens.app)
#   ./build-apk.sh thom  → apks/thom-songs/ThomSongs-vX.Y.Z.apk    (com.thomsongs.app)
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME="${ANDROID_HOME:-/usr/local/lib/android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

APP="${1:-oa}"
case "$APP" in
  oa)   FLAVOR="Oa";   VJSON="version-oa.json"; OUTDIR="apks/oa-sens-hud"; PREFIX="OASensHUD" ;;
  thom) FLAVOR="Thom"; VJSON="version.json";    OUTDIR="apks/thom-songs";  PREFIX="ThomSongs" ;;
  *) echo "Uso: $0 [oa|thom]"; exit 1 ;;
esac

WWW=android/app/src/main/assets/www
echo "→ Sincronizando arquivos web para $WWW/ (app: $APP)"
mkdir -p "$WWW" "$WWW/art" "$OUTDIR"
cp -f index.html styles.css app.js manifest.webmanifest sw.js \
      icon-192.png icon-512.png icon-maskable-512.png \
      "$WWW/"
for f in nxzero.json cbjr.json pitty.json version.json version-oa.json; do [ -f "$f" ] && cp -f "$f" "$WWW/"; done
[ -d art ] && cp -f art/*.jpg "$WWW/art/" 2>/dev/null || true
if [ ! -f android/keystore.properties ]; then
  echo "  (aviso: sem keystore.properties — assinando com chave debug)"
fi

echo "→ Minificando assets web..."
# JS: esbuild (seguro); fallback = mantém original
if npx -y esbuild --version >/dev/null 2>&1; then
  npx -y esbuild app.js --minify --outfile="$WWW/app.js" --log-level=error
  echo "  app.js minificado: $(du -h "$WWW/app.js" | cut -f1)"
else
  echo "  (esbuild indisponível — app.js original)"
fi
# CSS: minify seguro via python (sem dependências)
python3 - "$WWW/styles.css" << 'EOF'
import re, sys
p = sys.argv[1]
css = open(p, encoding='utf-8').read()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s+', ' ', css)
css = re.sub(r'\s*([{}:;,>])\s*', r'\1', css)
open(p, 'w', encoding='utf-8').write(css.strip())
EOF
echo "  styles.css minificado: $(du -h "$WWW/styles.css" | cut -f1)"
# PNGs: otimiza sem perda se oxipng/pillow disponível
python3 - "$WWW" << 'EOF' 2>/dev/null || true
import sys
try:
    from PIL import Image
    import os
    for f in os.listdir(sys.argv[1]):
        if f.endswith('.png'):
            p = os.path.join(sys.argv[1], f)
            Image.open(p).save(p, optimize=True)
    print('  PNGs otimizados')
except ImportError:
    pass
EOF

VERSION="$(python3 -c "import json;print(json.load(open('$VJSON'))['versionName'])")"
echo "→ Compilando APK RELEASE $PREFIX (flavor $APP, R8 + shrink, v$VERSION)..."
gradle -p android ":app:assemble${FLAVOR}Release" --console=plain -q

APK="${PREFIX}-v${VERSION}.apk"
cp -f "android/app/build/outputs/apk/${APP}/release/app-${APP}-release.apk" "$OUTDIR/$APK"
ls "$OUTDIR"/${PREFIX}-v*.apk 2>/dev/null | grep -v "$OUTDIR/$APK" | xargs -r rm -f
echo "✔ APK pronto: $OUTDIR/$APK ($(du -h "$OUTDIR/$APK" | cut -f1))"
