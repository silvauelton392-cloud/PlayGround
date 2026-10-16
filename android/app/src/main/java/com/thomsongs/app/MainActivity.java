package com.thomsongs.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int AUDIO_PERM_REQUEST = 1002;
    private static final int MIC_PERM_REQUEST = 1003;
    private PermissionRequest pendingMicRequest;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // Permite o player (file://) carregar nxzero.json e assets locais via fetch/XHR
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String scheme = url.getScheme();
                // Links de app (whatsapp:, tg:, intent:) abrem fora do WebView
                if (scheme != null && !scheme.equals("http") && !scheme.equals("https")
                        && !scheme.equals("file") && !scheme.equals("data")
                        && !scheme.equals("blob") && !scheme.equals("about")) {
                    try {
                        Intent i;
                        if (scheme.equals("intent")) {
                            i = Intent.parseUri(url.toString(), Intent.URI_INTENT_SCHEME);
                        } else {
                            i = new Intent(Intent.ACTION_VIEW, url);
                        }
                        view.getContext().startActivity(i);
                    } catch (Exception ignored) {}
                    return true;
                }
                String host = url.getHost();
                if (host == null) return false;
                // Letras / WhatsApp / Telegram abrem no app externo
                if (host.contains("letras.mus.br")
                        || host.contains("wa.me") || host.contains("whatsapp.com")
                        || host.contains("t.me") || host.contains("telegram.me")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, url);
                        view.getContext().startActivity(i);
                    } catch (Exception ignored) {}
                    return true;
                }
                // Player é 100% local: mantém o resto dentro do WebView
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                boolean wantMic = false;
                try {
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) { wantMic = true; break; }
                    }
                } catch (Exception ignored) {}
                if (!wantMic) { try { request.deny(); } catch (Exception ignored) {} return; }
                if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    try { request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); } catch (Exception ignored) {}
                } else {
                    pendingMicRequest = request;
                    try { requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO}, MIC_PERM_REQUEST); } catch (Exception ignored) {}
                }
            }
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = filePathCallback;
                Intent intent = fileChooserParams.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(Intent.createChooser(intent, "Escolher áudio"), FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Ponte de download: o app web chama AndroidDL.download(url, nomeDoArquivo)
        // downloadQuiet = mesma coisa sem toast (para baixar álbuns inteiros)
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void download(String url, String filename) {
                runOnUiThread(() -> enqueueDownload(url, filename, false));
            }
            @JavascriptInterface
            public void downloadQuiet(String url, String filename) {
                runOnUiThread(() -> enqueueDownload(url, filename, true));
            }
            @JavascriptInterface
            public void saveAudio(String base64, String filename) {
                runOnUiThread(() -> saveAudioFile(base64, filename));
            }
            @JavascriptInterface
            public void openLive(String url) {
                runOnUiThread(() -> {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Não foi possível abrir", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "AndroidDL");

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                enqueueDownload(url, android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)));

        // Atualização automática: o app web verifica a versão e baixa o APK novo
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int versionCode() {
                return BuildConfig.VERSION_CODE;
            }
            @JavascriptInterface
            public String versionName() {
                return BuildConfig.VERSION_NAME;
            }
            @JavascriptInterface
            public void downloadUpdate(String url, String file) {
                runOnUiThread(() -> {
                    try {
                        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                        req.setTitle("Thom Songs " + file);
                        req.setDescription("Baixando atualização…");
                        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                        req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "ThomSongs/" + file);
                        req.setMimeType("application/vnd.android.package-archive");
                        long did = ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(req);
                        getSharedPreferences("thomupd", MODE_PRIVATE).edit().putLong("dl", did).apply();
                        Toast.makeText(MainActivity.this, "Baixando atualização…", Toast.LENGTH_SHORT).show();
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Falha ao baixar atualização", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "AndroidApp");

        // Biblioteca do aparelho: o app web chama AndroidLib.getSongs()
        // (só pergunta ao sistema quando o usuário toca em "Permitir acesso")
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String getSongs() {
                if (!hasAudioPermission()) return "NEED_PERM";
                return queryDeviceSongs();
            }
            @JavascriptInterface
            public void askPerm() {
                runOnUiThread(() -> {
                    if (!hasAudioPermission()) {
                        requestPermissions(new String[]{audioPermission()}, AUDIO_PERM_REQUEST);
                    } else if (webView != null) {
                        webView.evaluateJavascript(
                                "window.__onDevicePerm&&window.__onDevicePerm(true)", null);
                    }
                });
            }
        }, "AndroidLib");

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("file:///android_asset/www/index.html");
        }
    }

    private String audioPermission() {
        if (Build.VERSION.SDK_INT >= 33) return android.Manifest.permission.READ_MEDIA_AUDIO;
        return android.Manifest.permission.READ_EXTERNAL_STORAGE;
    }

    private boolean hasAudioPermission() {
        return checkSelfPermission(audioPermission()) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERM_REQUEST && webView != null) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            webView.evaluateJavascript("window.__onDevicePerm&&window.__onDevicePerm(" + ok + ")", null);
        }
        if (requestCode == MIC_PERM_REQUEST) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            PermissionRequest req = pendingMicRequest;
            pendingMicRequest = null;
            if (req != null) {
                try {
                    if (ok) req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    else req.deny();
                } catch (Exception ignored) {}
            }
        }
    }

    private String queryDeviceSongs() {
        JSONArray arr = new JSONArray();
        String[] proj = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DISPLAY_NAME
        };
        String sel = MediaStore.Audio.Media.IS_MUSIC + "!=0 AND "
                + MediaStore.Audio.Media.DURATION + ">30000";
        try (Cursor c = getContentResolver().query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, proj, sel, null,
                MediaStore.Audio.Media.TITLE + " ASC")) {
            int count = 0;
            while (c != null && c.moveToNext() && count < 3000) {
                try {
                    long id = c.getLong(0);
                    Uri uri = ContentUris.withAppendedId(
                            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                    JSONObject o = new JSONObject();
                    o.put("title", c.getString(1));
                    o.put("artist", c.getString(2));
                    o.put("album", c.getString(3));
                    o.put("dur", c.getLong(4));
                    o.put("uri", uri.toString());
                    arr.put(o);
                    count++;
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            return "ERROR";
        }
        return arr.toString();
    }

    private void saveAudioFile(String base64, String filename) {
        try {
            byte[] data = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Audio.Media.DISPLAY_NAME, filename);
                cv.put(MediaStore.Audio.Media.MIME_TYPE, "audio/webm");
                cv.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/Thom Songs");
                Uri uri = getContentResolver().insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) throw new Exception("media");
                try (java.io.OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new Exception("stream");
                    os.write(data);
                }
            } else {
                java.io.File dir = new java.io.File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "Thom Songs");
                if (!dir.exists()) dir.mkdirs();
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(new java.io.File(dir, filename))) {
                    fos.write(data);
                }
            }
            Toast.makeText(this, "Áudio salvo — encaminhe no WhatsApp 🎤", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Falha ao salvar áudio", Toast.LENGTH_SHORT).show();
        }
    }

    private void enqueueDownload(String url, String filename) {
        enqueueDownload(url, filename, false);
    }

    private void enqueueDownload(String url, String filename, boolean quiet) {
        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle(filename);
            req.setDescription("Thom Songs");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            try {
                req.setDestinationInExternalPublicDir(Environment.DIRECTORY_MUSIC, "Thom Songs/" + filename);
            } catch (Exception e) {
                // Android 10+: cai para a pasta privada do app (sempre permitida)
                req.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_MUSIC, filename);
            }
            req.allowScanningByMediaScanner();
            ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(req);
            if (!quiet) Toast.makeText(this, "Baixando: " + filename, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            if (!quiet) Toast.makeText(this, "Falha no download", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            fileChooserCallback.onReceiveValue(results);
            fileChooserCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        // NÃO pausa o WebView: a música continua tocando em 2º plano
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
