/* Thom Songs — player mobile (Web Audio API) */
"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* Catálogo: Nx Zero (via nxzero.json) + músicas importadas pelo usuário.
   As faixas demo padrão foram removidas — só entra o que é NX Zero ou seu. */
let tracks = [];

/* Equalizador removido — reprodução direta com visualizer. */
const LYRIC_TPL = [
  "Acendo as luzes da cidade em mim", "Cada batida conta um novo começo",
  "Deixo o vento levar o que passou", "E o refrão me encontra no espelho",
  "Se o mundo girar, eu giro junto", "Até o amanhecer dançar conosco",
  "Guardo teu nome no meu compasso", "E a noite inteira canta mais alto",
];

const store = {
  load() { try { return JSON.parse(localStorage.getItem("thomsongs-v1") || localStorage.getItem("sonara-v2") || "{}") || {} } catch { return {} } },
  save(d) { try { localStorage.setItem("thomsongs-v1", JSON.stringify(d)) } catch {} },
};
const saved = store.load();

let NX = null, nxAlbum = "", CB = null, cbAlbum = "", PT = null, ptAlbum = "", NV = null, nvAlbum = "";
const isStream = (t) => t && (t.nx || t.cb || t.pitty || t.nv);
const letraLink = (t) => (t.cb ? "https://www.letras.mus.br/charlie-brown-jr/" : t.pitty ? "https://www.letras.mus.br/pitty/" : t.nv ? "https://www.letras.mus.br/nirvana/" : "https://www.letras.mus.br/nx-zero/");
let order = tracks.map((_, i) => i);
let pos = 0;
let view = "inicio", searchQ = "", sortBy = "padrao", activePlaylist = null;
let shuffle = saved.shuffle || false;
let repeat = saved.repeat || "all";
let likes = new Set(saved.likes || []);
let playlists = saved.playlists || {};
let history = saved.history || [];
let volumes = saved.volume ?? 0.9;
let listenedSec = saved.listenedSec || 0;

// ---------- Audio graph ----------
const audio = $("#audio");
audio.volume = volumes;
let actx = null, srcNode = null, analyser = null, gainNode = null, freqData = null, noGraph = false, graphWarned = false;
let visualOn = true;

function ensureGraph() {
  if (noGraph) return;
  try {
    if (actx) { if (actx.state === "suspended") actx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("no AC");
    actx = new AC();
    srcNode = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    gainNode = actx.createGain();
    srcNode.connect(analyser);
    analyser.connect(gainNode); gainNode.connect(actx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  } catch {
    // WebView sem Web Audio: segue tocando direto pelo elemento
    noGraph = true; actx = null; analyser = null;
    if (!graphWarned) { graphWarned = true; toast("Áudio em modo compatível 🔊"); }
  }
}

// ---------- helpers ----------
const fmt = (s) => { if (!isFinite(s) || s == null) return "0:00"; s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const coverCSS = (hue) => `linear-gradient(135deg,hsl(${hue} 80% 55%),hsl(${(hue + 60) % 360} 85% 45%))`;
const curTrackIdx = () => order[pos];
const curTrack = () => tracks[curTrackIdx()];
const normTitle = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Se o usuário tem o arquivo no aparelho, toca ele
function fullLocalFor(t) {
  if (!isStream(t)) return null;
  const nt = normTitle(t.title);
  return tracks.find((x) => x.device && normTitle(x.title) === nt) || null;
}

function toast(msg) {
  const box = $("#toasts");
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2200);
}
function persist() {
  store.save({ shuffle, repeat, likes: [...likes], playlists, history: history.slice(0, 30), volume: audio.volume, listenedSec });
}
function greeting() {
  const h = new Date().getHours();
  $("#greeting").textContent = h < 6 ? "Boa madrugada 🌌" : h < 12 ? "Bom dia ☀️" : h < 18 ? "Boa tarde 🌤️" : "Boa noite 🌙";
}

// ---------- sheet (Tocando Agora) ----------
function openSheet(tab) {
  if (tab) switchTab(tab);
  $("#sheet").classList.add("open");
  $("#sheet").setAttribute("aria-hidden", "false");
}
function closeSheet() {
  $("#sheet").classList.remove("open");
  $("#sheet").setAttribute("aria-hidden", "true");
}
function switchTab(name) {
  $$(".tabs button").forEach((x) => x.classList.toggle("active", x.dataset.tab === name));
  $$(".tab-page").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
}
// arrastar para fechar
(() => {
  const head = document.querySelector(".sheet-head");
  let y0 = null;
  head.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  head.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) $("#sheet").style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  head.addEventListener("touchend", (e) => {
    const dy = (e.changedTouches[0].clientY - y0);
    $("#sheet").style.transform = "";
    if (dy > 110) closeSheet();
    y0 = null;
  });
})();

// ---------- renderers ----------
function filteredTracks() {
  let list = tracks.map((t, i) => ({ ...t, idx: i }));
  if (view === "curtidas") list = list.filter((t) => likes.has(t.idx));
  if (view === "historico") {
    const h = [...new Set(history)].filter((i) => tracks[i]);
    list = h.map((i) => ({ ...tracks[i], idx: i }));
  }
  if (view === "nxzero") {
    list = list.filter((t) => t.nx);
    if (nxAlbum) list = list.filter((t) => t.album === nxAlbum);
  }
  if (view === "cbjr") {
    list = list.filter((t) => t.cb);
    if (cbAlbum) list = list.filter((t) => t.album === cbAlbum);
  }
  if (view === "pitty") {
    list = list.filter((t) => t.pitty);
    if (ptAlbum) list = list.filter((t) => t.album === ptAlbum);
  }
  if (view === "nirvana") {
    list = list.filter((t) => t.nv);
    if (nvAlbum) list = list.filter((t) => t.album === nvAlbum);
  }
  if (view === "aparelho") list = list.filter((t) => t.device);
  if (activePlaylist && playlists[activePlaylist]) {
    list = playlists[activePlaylist].filter((i) => tracks[i]).map((i) => ({ ...tracks[i], idx: i }));
  }
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter((t) => `${t.title} ${t.artist} ${t.album} ${t.genre}`.toLowerCase().includes(q));
  }
  if (sortBy === "titulo") list.sort((a, b) => a.title.localeCompare(b.title));
  if (sortBy === "artista") list.sort((a, b) => a.artist.localeCompare(b.artist));
  if (sortBy === "duracao") list.sort((a, b) => (a._dur || 200) - (b._dur || 200));
  return list;
}

function artHTML(t, cls) {
  return t.art
    ? `<div class="${cls} has-img"><img src="${t.art}" alt="" loading="lazy" /></div>`
    : `<div class="${cls}" style="background:${coverCSS(t.hue)}">${(t.title[0] || "♪").toUpperCase()}</div>`;
}

function trackRow(t, n) {
  const div = document.createElement("div");
  div.className = "track" + (t.idx === curTrackIdx() ? " playing" : "");
  div.innerHTML = `
    <div class="num"><span class="idx">${String(n).padStart(2, "0")}</span><span class="eq-bars"><i></i><i></i><i></i></span></div>
    ${artHTML(t, "mini-art")}
    <div class="t-info"><strong>${t.title}</strong><span>${t.artist} · ${t.album}</span></div>
    <div class="t-act">
      <button data-a="like" title="Curtir">${likes.has(t.idx) ? "❤️" : "🤍"}</button>
      <button data-a="queue" title="Adicionar à fila">＋</button>
      <button data-a="dl" title="Baixar">⤓</button>
    </div>`;
  div.onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return playIndex(t.idx);
    if (btn.dataset.a === "like") toggleLike(t.idx);
    else if (btn.dataset.a === "dl") downloadTrack(t);
    else { order.splice(pos + 1, 0, t.idx); renderQueue(); toast("Adicionada à fila ⏭"); }
  };
  return div;
}

// ---------- download ----------
function dlName(t) {
  const ext = t.local ? (t.ext || "mp3") : ((t.src.split(".").pop() || "mp3").split("?")[0].slice(0, 4) || "mp3");
  return (`${t.artist} - ${t.title}`.replace(/[\\/:*?"<>|]/g, "").slice(0, 90)) + "." + ext;
}
async function downloadTrack(t, quiet) {
  if (!t) return false;
  if (t.device || t.local || t.src.startsWith("blob:")) { if (!quiet) toast("Essa música já está salva no seu aparelho ✅"); return false; }
  const file = dlName(t);
  try {
    if (window.AndroidDL && window.AndroidDL.download) {
      if (quiet && window.AndroidDL.downloadQuiet) window.AndroidDL.downloadQuiet(t.src, file);
      else window.AndroidDL.download(t.src, file);
      if (!quiet) toast("Baixando… ⤓");
      return true;
    }
    if (!quiet) toast("Baixando… ⤓");
    const r = await fetch(t.src);
    if (!r.ok) throw new Error("http");
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u; a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 15000);
    if (!quiet) toast("Download concluído ✅");
    return true;
  } catch { if (!quiet) toast("Falha no download ⚠️"); return false; }
}
async function downloadList(list) {
  list = list.filter((t) => !t.device && !t.local && !t.src.startsWith("blob:"));
  if (!list.length) return toast("Nada para baixar aqui ⚠️");
  if (list.length > 20 && !confirm(`Baixar ${list.length} músicas para ouvir offline?`)) return;
  toast(`Enfileirando ${list.length} downloads… ⤓`);
  let ok = 0;
  for (const t of list) {
    if (await downloadTrack(t, true)) ok++;
    await new Promise((r) => setTimeout(r, 350));
  }
  toast(`${ok}/${list.length} na fila de download ✅`);
}
$("#btn-dl-album").onclick = () => downloadList(filteredTracks());
$("#btn-dl-cb").onclick = () => downloadList(filteredTracks());
$("#btn-dl-pitty").onclick = () => downloadList(filteredTracks());
$("#btn-dl").onclick = () => downloadTrack(curTrack());

// ---------- download ----------
function renderTracks() {
  const list = filteredTracks();
  const box = $("#track-list"); box.innerHTML = "";
  list.slice(0, view === "nxzero" ? 500 : 100).forEach((t, i) => box.appendChild(trackRow(t, i + 1)));
  $("#empty-msg").hidden = list.length > 0;
  $("#track-count").textContent = `· ${list.length}`;
  const titles = { inicio: "📀 Em destaque", biblioteca: "🎵 Todas as músicas", curtidas: "❤️ Suas curtidas", historico: "🕘 Tocadas recentemente", nxzero: "🎸 NX Zero", cbjr: "🎸 Charlie Brown Jr", pitty: "🎸 Pitty", nirvana: "🎸 Nirvana", aparelho: "📱 Neste aparelho" };
  const selAlbum = view === "nxzero" ? nxAlbum : view === "cbjr" ? cbAlbum : view === "pitty" ? ptAlbum : view === "nirvana" ? nvAlbum : "";
  $("#view-title").textContent = activePlaylist ? `📁 ${activePlaylist}` : (selAlbum ? `🎸 ${selAlbum}` : (titles[view] || titles.inicio));
  $("#nx-head").hidden = view !== "nxzero";
  if (view === "nxzero") renderNxHead();
  $("#cb-head").hidden = view !== "cbjr";
  if (view === "cbjr") renderCbHead();
  $("#pitty-head").hidden = view !== "pitty";
  if (view === "pitty") renderPtHead();
  $("#nv-head").hidden = view !== "nirvana";
  if (view === "nirvana") renderNvHead();
  $("#dev-head").hidden = view !== "aparelho";
  if (view === "aparelho") updateDevHead();
}

function renderFeatured() {
  const box = $("#featured"); box.innerHTML = "";
  filteredTracks().slice(0, 8).forEach((t) => {
    const c = document.createElement("div");
    c.className = "card" + (t.idx === curTrackIdx() ? " playing" : "");
    const art = t.art
      ? `<div class="art has-img"><img src="${t.art}" alt="" loading="lazy" /></div>`
      : `<div class="art" style="background:${coverCSS(t.hue)}">${(t.title[0] || "♪").toUpperCase()}</div>`;
    c.innerHTML = `${art}<strong>${t.title}</strong><span>${t.artist}</span>`;
    c.onclick = () => playIndex(t.idx);
    box.appendChild(c);
  });
}

function renderPlaylists() {
  const box = $("#playlist-list"); box.innerHTML = "";
  Object.entries(playlists).forEach(([name, arr]) => {
    const b = document.createElement("button");
    b.className = "pl-item" + (activePlaylist === name ? " active" : "");
    b.innerHTML = `<span class="pl-dot" style="background:${coverCSS((name.length * 47) % 360)}"></span>${name}<small>${arr.length}</small>`;
    b.onclick = () => { activePlaylist = activePlaylist === name ? null : name; view = "biblioteca"; syncNav(); renderAll(); $("#main").scrollTo({ top: 0 }); };
    b.oncontextmenu = (e) => { e.preventDefault(); if (confirm(`Excluir "${name}"?`)) { delete playlists[name]; activePlaylist = null; persist(); renderAll(); } };
    box.appendChild(b);
  });
  const likesEl = $("#nav-likes-count");
  if (likesEl) likesEl.textContent = likes.size;
  $("#stat-tracks").textContent = tracks.length;
  $("#stat-today").textContent = `${Math.floor(listenedSec / 60)} min`;
}

function renderQueue() {
  const box = $("#queue-list"); box.innerHTML = "";
  const upcoming = order.slice(pos + 1, pos + 21);
  if (!upcoming.length) box.innerHTML = `<p class="hint" style="color:var(--mut);font-size:12px">Fila vazia — toque ＋ numa faixa para enfileirar.</p>`;
  upcoming.forEach((idx, k) => {
    const t = tracks[idx]; if (!t) return;
    const d = document.createElement("div");
    d.className = "q-item";
    d.innerHTML = `${artHTML(t, "mini-art")}
      <div><strong>${t.title}</strong><span>${t.artist}</span></div><button>✕</button>`;
    d.onclick = (e) => { if (e.target.tagName === "BUTTON") { order.splice(pos + 1 + k, 1); renderQueue(); } else playAt(pos + 1 + k); };
    box.appendChild(d);
  });
}

function renderLyrics() {
  const t = curTrack(); const box = $("#lyrics");
  if (!t) { box.innerHTML = "<p>Toque uma faixa para ver a letra aqui. 🎤</p>"; return; }
  if (isStream(t)) {
    box.innerHTML = `<p><strong>${t.title}</strong> — ${t.artist}<br/><span style="font-size:12px">${t.album} · ${t.year}</span></p>
      <p><a href="${letraLink(t)}" target="_blank" rel="noopener" class="yt-link alt">📝 Ver letra no Letras.mus.br</a></p>`;
    return;
  }
  if (t.device || t.local) {
    box.innerHTML = `<p><strong>${t.title}</strong> — ${t.artist}<br/><span style="font-size:12px">${t.album}</span></p>
      <p>Arquivo do aparelho: sem letra embutida 🎤</p>`;
    return;
  }
  box.innerHTML = `<p><strong>${t.title}</strong> — ${t.artist}<br/><span style="font-size:12px">${t.album} · ${t.year}</span></p>` +
    LYRIC_TPL.map((l) => `<p data-lyric>${l}</p>`).join("") +
    `<p data-lyric>E a cidade inteira canta: ${t.title}…</p><p data-lyric>(instrumental 🎷)</p>`;
}
function syncLyrics() {
  const lines = $$("#lyrics [data-lyric]");
  if (!lines.length || !audio.duration) return;
  const step = audio.duration / (lines.length + 1);
  const active = Math.floor(audio.currentTime / step);
  lines.forEach((l, i) => {
    const on = i === active;
    l.classList.toggle("on", on);
    if (on) l.scrollIntoView({ block: "nearest" });
  });
}

function updatePlayerUI() {
  const t = curTrack();
  const title = t ? t.title : "Nada tocando";
  const sub = t ? `${t.artist} · ${t.album}` : "—";
  const subPrev = sub;
  $("#p-title").textContent = title;
  $("#p-artist").textContent = subPrev;
  $("#m-title").textContent = title;
  $("#m-artist").textContent = subPrev;
  $("#hero-title").textContent = t ? t.title : "—";
  $("#hero-artist").textContent = t ? [t.artist, t.genre, t.bpm ? t.bpm + " BPM" : ""].filter(Boolean).join(" · ") : "Escolha uma faixa abaixo";
  const css = t ? coverCSS(t.hue) : "#333";
  const ch = t ? (t.title[0] || "S").toUpperCase() : "S";
  const cover = $("#cover");
  cover.style.background = css;
  cover.innerHTML = t && t.art ? `<img src="${t.art}" alt="" />` : `<span>${ch}</span>`;
  cover.classList.toggle("spin", !audio.paused && !!t && !t.art);
  const mc = $("#m-cover");
  mc.style.background = css;
  mc.innerHTML = t && t.art ? `<img src="${t.art}" alt="" />` : `<span>${ch}</span>`;
  const ic = audio.paused ? "▶" : "⏸";
  $("#btn-play").textContent = ic;
  $("#m-play").textContent = ic;
  $("#btn-like").textContent = t && likes.has(curTrackIdx()) ? "❤️" : "🤍";
  $$("#tabbar .nav-item[data-view]").forEach((b) => b.classList.remove("active"));
  const nb = document.querySelector(`#tabbar .nav-item[data-view="${view}"]`);
  const sh = $("#btn-shuffle");
  sh.classList.toggle("active", shuffle);
  const rep = $("#btn-repeat");
  rep.classList.toggle("active", repeat !== "off");
  rep.textContent = repeat === "one" ? "🔂" : "🔁";
  $("#btn-toggle-visual").textContent = visualOn ? "📊 ON" : "📊 OFF";
  if ("mediaSession" in navigator && t) {
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album }); } catch {}
  }
}
function syncNav() {
  $$("#tabbar .nav-item[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view && !activePlaylist));
}
function renderAll() { renderTracks(); renderFeatured(); renderPlaylists(); renderQueue(); updatePlayerUI(); }

// ---------- playback ----------
function buildOrder(startIdx, keepShuffle = true) {
  if (shuffle && keepShuffle) {
    const rest = tracks.map((_, i) => i).filter((i) => i !== startIdx).sort(() => Math.random() - 0.5);
    order = [startIdx, ...rest]; pos = 0;
  } else {
    order = tracks.map((_, i) => i);
    pos = Math.max(0, order.indexOf(startIdx));
  }
}
function playIndex(idx, autoplay = true) {
  if (!tracks[idx]) return;
  if (!order.includes(idx) || !shuffle) buildOrder(idx);
  else pos = order.indexOf(idx);
  loadCurrent(autoplay);
}
function playAt(p) { pos = (p + order.length) % order.length; loadCurrent(true); }

function loadCurrent(autoplay = true) {
  const t = curTrack(); if (!t) return;
  ensureGraph();
  const local = fullLocalFor(t);
  const src = local ? local.src : t.src;
  if (local && !t._full) toast("Tocando arquivo do aparelho 📱");
  t._full = !!local;
  const changed = audio.src !== src && audio.currentSrc !== src;
  if (changed) {
    try { audio.pause(); } catch {}
    audio.removeAttribute("src");
    try { audio.load(); } catch {}
    audio.src = src; abLoop.a = abLoop.b = null; updateAB();
    t._retried = 0;
    try { audio.load(); } catch {}
  }
  renderLyrics();
  if (audio.error) { try { audio.load(); } catch {} }
  if (autoplay) { wantPlay = true; audio.play().catch(() => { if (!audio.error) toast("Toque em ▶ para começar 🔊"); }); }
  history = [curTrackIdx(), ...history.filter((x) => x !== curTrackIdx())].slice(0, 30);
  updatePlayerUI(); renderTracks(); renderFeatured(); renderQueue(); persist();
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("previoustrack", prev);
      navigator.mediaSession.setActionHandler("nexttrack", () => next(false));
      navigator.mediaSession.setActionHandler("play", () => audio.play().catch(() => {}));
      navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    } catch {}
  }
}
function togglePlay() {
  ensureGraph();
  if (!audio.src && tracks.length) return loadCurrent(true);
  if (audio.paused) { wantPlay = true; audio.play().catch(() => {}); } else audio.pause();
}
function next(auto = false) {
  if (repeat === "one" && auto) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  if (pos < order.length - 1) playAt(pos + 1);
  else if (repeat === "all") playAt(0);
  else toast("Fim da fila 🔚");
}
function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  playAt(pos - 1 < 0 ? (repeat === "all" ? order.length - 1 : 0) : pos - 1);
}
function toggleLike(idx = curTrackIdx()) {
  if (idx == null || !tracks[idx]) return;
  likes.has(idx) ? likes.delete(idx) : likes.add(idx);
  persist(); updatePlayerUI(); renderTracks(); renderPlaylists();
  toast(likes.has(idx) ? "Nos favoritos ❤️" : "Removida dos favoritos 🤍");
}

// ---------- audio events ----------
audio.addEventListener("play", updatePlayerUI);
audio.addEventListener("pause", updatePlayerUI);
audio.addEventListener("loadedmetadata", () => {
  const t = tracks[order[pos]]; if (t) t._dur = audio.duration;
  $("#t-total").textContent = fmt(audio.duration);
});
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  const p = (audio.currentTime / audio.duration) * 100;
  $("#bar").style.width = p + "%";
  $("#knob").style.left = p + "%";
  $("#mini-bar").style.width = p + "%";
  $("#t-cur").textContent = fmt(audio.currentTime);
  $("#t-total").textContent = fmt(audio.duration);
  if (audio.buffered.length) {
    try { $("#buffered").style.width = (audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100 + "%"; } catch {}
  }
  syncLyrics();
  if (abLoop.a != null && abLoop.b != null && audio.currentTime >= abLoop.b) audio.currentTime = abLoop.a;
});
audio.addEventListener("ended", () => next(true));
// Recuperação automática: 2 tentativas com backoff antes de pular
let errCount = 0, wantPlay = false;
const MEDIA_ERR = { 1: "interrompido", 2: "rede", 3: "decodificação", 4: "fonte não suportada" };
audio.addEventListener("playing", () => { errCount = 0; wantPlay = true; const t = curTrack(); if (t) t._retried = 0; });
audio.addEventListener("pause", () => { wantPlay = false; });
audio.addEventListener("error", () => {
  const t = curTrack();
  const code = audio.error ? audio.error.code : 0;
  try { window.__lastAudioError = { code, src: (audio.currentSrc || "").slice(0, 80), at: Date.now() }; } catch {}
  // tenta até 2x com intervalo crescente, só se o usuário queria ouvir
  if (t && wantPlay && (t._retried || 0) < 2) {
    t._retried = (t._retried || 0) + 1;
    toast(`Falha de ${MEDIA_ERR[code] || "áudio"} — tentando de novo (${t._retried}/2) 🔄`);
    setTimeout(() => { try { audio.load(); } catch {} audio.play().catch(() => {}); }, t._retried === 1 ? 900 : 2500);
    return;
  }
  errCount++;
  if (errCount > 3) { errCount = 0; return toast("Muitas falhas seguidas — verifique a internet ⚠️"); }
  toast(`"${t ? t.title : "Faixa"}" falhou (${MEDIA_ERR[code] || "erro"}), pulando ⏭`);
  setTimeout(() => { if (audio.error) next(false); }, 700);
});
setInterval(() => { if (!audio.paused && audio.src) { listenedSec += 5; persist(); $("#stat-today").textContent = `${Math.floor(listenedSec / 60)} min`; } }, 5000);

// seek (toque/arrasto)
const prog = $("#progress");
let seeking = false;
function seekFromEvent(e) {
  const r = prog.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const ratio = Math.min(1, Math.max(0, (cx - r.left) / r.width));
  if (audio.duration) audio.currentTime = ratio * audio.duration;
}
prog.addEventListener("pointerdown", (e) => { seeking = true; try { prog.setPointerCapture(e.pointerId); } catch {} seekFromEvent(e); });
prog.addEventListener("pointermove", (e) => { if (seeking) seekFromEvent(e); });
prog.addEventListener("pointerup", () => (seeking = false));

// ---------- UI wiring ----------
$("#btn-play").onclick = togglePlay;
$("#m-play").onclick = (e) => { e.stopPropagation(); togglePlay(); };
$("#m-next").onclick = (e) => { e.stopPropagation(); next(false); };
$("#btn-next").onclick = () => next(false);
$("#btn-prev").onclick = prev;
$("#miniplayer").onclick = () => openSheet();
$("#btn-sheet-close").onclick = closeSheet;
$$(".tabs button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

$("#btn-shuffle").onclick = () => {
  shuffle = !shuffle;
  const cur = curTrackIdx();
  if (shuffle) buildOrder(cur); else { order = tracks.map((_, i) => i); pos = order.indexOf(cur); }
  persist(); updatePlayerUI(); renderQueue(); toast(shuffle ? "Aleatório ON 🔀" : "Aleatório OFF");
};
$("#btn-repeat").onclick = () => {
  repeat = repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
  persist(); updatePlayerUI();
  toast(repeat === "one" ? "Repetindo a faixa 🔂" : repeat === "all" ? "Repetindo tudo 🔁" : "Repetição off");
};
$("#btn-like").onclick = () => toggleLike();
$("#btn-mute").onclick = () => { audio.muted = !audio.muted; $("#btn-mute").textContent = audio.muted ? "🔇" : "🔊"; };
$("#volume").value = volumes;
$("#volume").oninput = (e) => { audio.volume = +e.target.value; audio.muted = false; $("#btn-mute").textContent = "🔊"; persist(); };
function needTracks() {
  if (!tracks.length) { toast("Carregando músicas… ⏳"); return false; }
  return true;
}
$("#btn-play-all").onclick = () => { if (!needTracks()) return; shuffle = false; buildOrder(0); loadCurrent(true); openSheet(); };
$("#btn-shuffle-all").onclick = () => { if (!needTracks()) return; shuffle = true; buildOrder(Math.floor(Math.random() * tracks.length)); loadCurrent(true); openSheet(); };
$("#btn-toggle-visual").onclick = () => { visualOn = !visualOn; updatePlayerUI(); if (!visualOn) clearVisuals(); };
$("#btn-clear-queue").onclick = () => { order = [curTrackIdx()]; pos = 0; renderQueue(); toast("Fila limpa 🧹"); };
$("#btn-reset").onclick = () => { ["thomsongs-v1", "sonara-v2", "sonara-v1"].forEach((k) => localStorage.removeItem(k)); location.reload(); };
$("#btn-theme").onclick = () => {
  const r = document.documentElement;
  const light = r.dataset.theme === "light";
  r.dataset.theme = light ? "" : "light";
  $("#btn-theme").textContent = light ? "🌙" : "☀️";
};

let searchT;
$("#search").oninput = (e) => { clearTimeout(searchT); searchT = setTimeout(() => { searchQ = e.target.value.trim(); view = "biblioteca"; syncNav(); renderTracks(); renderFeatured(); }, 180); };
$$("#sort-seg button").forEach((b) => (b.onclick = () => { $$("#sort-seg button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); sortBy = b.dataset.sort; renderTracks(); }));
$$("#tabbar .nav-item[data-view]").forEach((b) => (b.onclick = () => {
  view = b.dataset.view; activePlaylist = null;
  syncNav(); renderAll(); $("#main").scrollTo({ top: 0, behavior: "smooth" });
}));
$$(".sleep-grid button").forEach((b) => (b.onclick = () => {
  $$(".sleep-grid button").forEach((x) => x.classList.remove("active")); b.classList.add("active");
  setSleep(+b.dataset.sleep);
}));

let sleepTO = null;
function setSleep(min) {
  clearTimeout(sleepTO); sleepTO = null;
  if (!min) { $("#sleep-status").textContent = "Reprodução contínua."; return; }
  $("#sleep-status").textContent = `Pausando em ${min} min 😴`;
  toast(`Timer: ${min} min ⏱`);
  sleepTO = setTimeout(() => { audio.pause(); $("#sleep-status").textContent = "Reprodução contínua."; toast("Boa noite! 🌙"); }, min * 60 * 1000);
}

// A-B loop
const abLoop = { a: null, b: null };
function updateAB() {
  const r = $("#loop-region");
  if (abLoop.a != null && abLoop.b != null && audio.duration) {
    r.hidden = false;
    r.style.left = (abLoop.a / audio.duration) * 100 + "%";
    r.style.width = ((abLoop.b - abLoop.a) / audio.duration) * 100 + "%";
    $("#btn-ab").classList.add("active");
  } else { r.hidden = true; $("#btn-ab").classList.remove("active"); }
}
$("#btn-ab").onclick = () => {
  if (abLoop.a == null) { abLoop.a = audio.currentTime || 0; toast(`Ponto A: ${fmt(abLoop.a)} 🅰️`); }
  else if (abLoop.b == null) {
    if (audio.currentTime <= abLoop.a) return toast("Ponto B deve ser depois do A ⚠️");
    abLoop.b = audio.currentTime; updateAB(); toast(`Loop A-B 🔁 (${fmt(abLoop.a)}–${fmt(abLoop.b)})`);
  } else { abLoop.a = abLoop.b = null; updateAB(); toast("Loop A-B off"); }
};

// playlists modal
const modal = $("#modal"), modalInput = $("#modal-input"), modalList = $("#modal-list");
let modalMode = "new", pendingTrack = null;
$("#btn-new-playlist").onclick = () => { modalMode = "new"; $("#modal-title").textContent = "Nova playlist"; modalInput.style.display = ""; modalInput.value = ""; modalList.innerHTML = ""; modal.hidden = false; setTimeout(() => modalInput.focus(), 100); };
$("#btn-add-pl").onclick = () => {
  modalMode = "add"; pendingTrack = curTrackIdx();
  $("#modal-title").textContent = "Adicionar à playlist";
  modalInput.style.display = "none"; modalList.innerHTML = "";
  Object.keys(playlists).forEach((name) => {
    const b = document.createElement("button"); b.textContent = `📁 ${name} (${playlists[name].length})`;
    b.onclick = () => { if (!playlists[name].includes(pendingTrack)) playlists[name].push(pendingTrack); persist(); renderPlaylists(); modal.hidden = true; toast(`Adicionada ✅`); };
    modalList.appendChild(b);
  });
  if (!Object.keys(playlists).length) modalList.innerHTML = `<p style="color:#9aa3c7;font-size:13px">Nenhuma playlist — crie uma primeiro.</p>`;
  modal.hidden = false;
};
$("#modal-cancel").onclick = () => (modal.hidden = true);
$("#modal-ok").onclick = () => {
  if (modalMode !== "new") return (modal.hidden = true);
  const name = modalInput.value.trim() || `Playlist ${Object.keys(playlists).length + 1}`;
  if (!playlists[name]) playlists[name] = [];
  persist(); renderPlaylists(); modal.hidden = true; toast(`"${name}" criada ✨`);
};
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

// importar áudios
$("#file-input").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
function addFiles(files) {
  let n = 0;
  [...files].filter((f) => f.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/i.test(f.name)).forEach((f) => {
    const url = URL.createObjectURL(f);
    tracks.push({ title: f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || "Faixa local", artist: "Arquivo local", album: "Importadas", genre: "Local", hue: Math.floor(Math.random() * 360), bpm: 100, src: url, local: true, ext: (f.name.split(".").pop() || "mp3").toLowerCase().slice(0, 4) });
    n++;
  });
  if (n) { order = tracks.map((_, i) => i); renderAll(); toast(`${n} importada(s) 🎶`); }
  else toast("Nenhum áudio válido ⚠️");
}

// ---------- visualizers ----------
const big = $("#visual-big"), bg = $("#bg-canvas");
const bctx = big.getContext("2d"), gctx = bg.getContext("2d");
function fitCanvases() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = big.getBoundingClientRect();
  if (r.width > 0) { big.width = r.width * dpr; big.height = r.height * dpr; }
  bg.width = innerWidth; bg.height = innerHeight;
}
addEventListener("resize", fitCanvases);
addEventListener("orientationchange", () => setTimeout(fitCanvases, 300));

const particles = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, v: Math.random() * 0.0006 + 0.0002 }));
function drawLoop() {
  requestAnimationFrame(drawLoop);
  if (!visualOn) return;
  let level = 0.12, data = null;
  if (analyser && !audio.paused && !audio.muted) { analyser.getByteFrequencyData(freqData); data = freqData; level = freqData.slice(0, 40).reduce((a, b) => a + b, 0) / 40 / 255; }
  const W = big.width, H = big.height;
  if (W > 0) {
    bctx.clearRect(0, 0, W, H);
    const N = 40, bw = W / N;
    for (let i = 0; i < N; i++) {
      const v = data ? data[Math.floor((i / N) * data.length * 0.7)] / 255 : 0.08 + 0.05 * Math.sin(Date.now() / 700 + i * 0.5);
      const h = Math.max(4, v * H * 0.95);
      const g = bctx.createLinearGradient(0, H - h, 0, H);
      g.addColorStop(0, "#8b5cf6"); g.addColorStop(1, "#06b6d4");
      bctx.fillStyle = g;
      bctx.beginPath();
      if (bctx.roundRect) bctx.roundRect(i * bw + bw * 0.2, H - h, bw * 0.6, h, 4);
      else bctx.rect(i * bw + bw * 0.2, H - h, bw * 0.6, h);
      bctx.fill();
    }
  }
  gctx.clearRect(0, 0, bg.width, bg.height);
  particles.forEach((p) => {
    p.y -= p.v * (1 + level * 4);
    if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
    gctx.globalAlpha = 0.25 + level * 0.6;
    gctx.fillStyle = p.s > 1.5 ? "#8b5cf6" : "#06b6d4";
    gctx.beginPath(); gctx.arc(p.x * bg.width, p.y * bg.height, p.s * (1 + level * 3), 0, 7); gctx.fill();
  });
  gctx.globalAlpha = 1;
  if (curTrack()) $("#hero-bpm").textContent = curTrack().bpm ? `♪ ${curTrack().bpm} BPM` : "♪";
}
function clearVisuals() { bctx.clearRect(0, 0, big.width, big.height); }

// ---------- NX Zero ----------
function renderNxHead() {
  if (!NX) return;
  const feat = NX.albums.find((a) => a.name.includes("Tour Cedo")) || NX.albums[0];
  if (feat && feat.art) $("#nx-photo").src = feat.art;
  $("#nx-stats").textContent = `${NX.total} faixas · ${NX.albums.length} álbuns · 2006–2024`;
  const box = $("#nx-albums"); box.innerHTML = "";
  const all = document.createElement("button");
  all.textContent = `Tudo (${NX.total})`;
  all.className = nxAlbum ? "" : "active";
  all.onclick = () => { nxAlbum = ""; renderAll(); };
  box.appendChild(all);
  NX.albums.forEach((a) => {
    const b = document.createElement("button");
    b.textContent = `${a.year} · ${a.name} (${a.count})`;
    b.className = nxAlbum === a.name ? "active" : "";
    b.onclick = () => { nxAlbum = a.name; renderAll(); $("#main").scrollTo({ top: 0 }); };
    box.appendChild(b);
  });
}
// Catálogo embutido (catalog.js) como fallback se o fetch falhar no aparelho
async function catOrEmbedded(key, file) {
  try {
    const r = await fetch(file);
    if (r.ok) return await r.json();
  } catch {}
  if (window.__CATALOG && window.__CATALOG[key]) return window.__CATALOG[key];
  throw new Error("cat");
}
async function loadNX() {
  try {
    NX = await catOrEmbedded("nx", "./nxzero.json");
    const cur = order[pos];
    NX.tracks.forEach((nt) => {
      if (tracks.some((t) => t.src === nt.preview)) return;
      tracks.push({ title: nt.title, artist: nt.artist, album: nt.album, genre: "Rock", hue: nt.id % 360, src: nt.preview, nx: true, art: nt.art, year: nt.year });
    });
    if (shuffle && cur !== undefined && tracks[cur]) buildOrder(cur);
    else { order = tracks.map((_, i) => i); pos = Math.max(0, order.indexOf(cur)); }
    $("#nx-banner-sub").textContent = `${NX.total} músicas · ${NX.albums.length} álbuns`;
    renderAll();
  } catch { const el = $("#nx-banner-sub"); if (el) el.textContent = "Falha ao carregar — toque para tentar"; }
}
$("#nx-banner").onclick = () => {
  if (!NX) { toast("Tentando carregar… ⏳"); loadNX(); return; }
  view = "nxzero"; nxAlbum = ""; activePlaylist = null;
  syncNav(); renderAll(); $("#main").scrollTo({ top: 0 });
};

// ---------- Charlie Brown Jr ----------
function renderCbHead() {
  if (!CB) return;
  if (CB.albums[0] && CB.albums[0].art) $("#cb-photo").src = CB.albums[0].art;
  $("#cb-stats").textContent = `${CB.total} clássicos · ${CB.albums.length} álbuns`;
  const box = $("#cb-albums"); box.innerHTML = "";
  const all = document.createElement("button");
  all.textContent = `Tudo (${CB.total})`;
  all.className = cbAlbum ? "" : "active";
  all.onclick = () => { cbAlbum = ""; renderAll(); };
  box.appendChild(all);
  CB.albums.forEach((a) => {
    const b = document.createElement("button");
    b.textContent = `${a.name} (${a.count})`;
    b.className = cbAlbum === a.name ? "active" : "";
    b.onclick = () => { cbAlbum = a.name; renderAll(); $("#main").scrollTo({ top: 0 }); };
    box.appendChild(b);
  });
}
async function loadCB() {
  try {
    CB = await catOrEmbedded("cb", "./cbjr.json");
    const cur = order[pos];
    CB.tracks.forEach((ct) => {
      if (tracks.some((t) => t.src === ct.preview)) return;
      tracks.push({ title: ct.title, artist: ct.artist, album: ct.album, genre: "Rock", hue: (ct.id * 7) % 360, src: ct.preview, cb: true, art: ct.art, year: ct.year });
    });
    if (shuffle && cur !== undefined && tracks[cur]) buildOrder(cur);
    else { const have = new Set(order); tracks.forEach((_, i) => { if (!have.has(i)) { order.push(i); have.add(i); } }); }
    $("#cb-banner-sub").textContent = `${CB.total} clássicos`;
    renderAll();
  } catch { const el = $("#cb-banner-sub"); if (el) el.textContent = "Falha ao carregar — toque para tentar"; }
}
$("#cb-banner").onclick = () => {
  if (!CB) { toast("Tentando carregar… ⏳"); loadCB(); return; }
  view = "cbjr"; cbAlbum = ""; activePlaylist = null;
  syncNav(); renderAll(); $("#main").scrollTo({ top: 0 });
};

// ---------- Pitty ----------
function renderPtHead() {
  if (!PT) return;
  if (PT.albums[0] && PT.albums[0].art) $("#pitty-photo").src = PT.albums[0].art;
  $("#pitty-stats").textContent = `${PT.total} faixa(s) · ${PT.albums.length} álbum(ns)`;
  const box = $("#pitty-albums"); box.innerHTML = "";
  const all = document.createElement("button");
  all.textContent = `Tudo (${PT.total})`;
  all.className = ptAlbum ? "" : "active";
  all.onclick = () => { ptAlbum = ""; renderAll(); };
  box.appendChild(all);
  PT.albums.forEach((a) => {
    const b = document.createElement("button");
    b.textContent = `${a.year} · ${a.name} (${a.count})`;
    b.className = ptAlbum === a.name ? "active" : "";
    b.onclick = () => { ptAlbum = a.name; renderAll(); $("#main").scrollTo({ top: 0 }); };
    box.appendChild(b);
  });
}
async function loadPT() {
  try {
    PT = await catOrEmbedded("pitty", "./pitty.json");
    const cur = order[pos];
    PT.tracks.forEach((pt) => {
      if (tracks.some((t) => t.src === pt.preview)) return;
      tracks.push({ title: pt.title, artist: pt.artist, album: pt.album, genre: "Rock", hue: (pt.id * 13) % 360, src: pt.preview, pitty: true, art: pt.art, year: pt.year });
    });
    if (shuffle && cur !== undefined && tracks[cur]) buildOrder(cur);
    else { const have = new Set(order); tracks.forEach((_, i) => { if (!have.has(i)) { order.push(i); have.add(i); } }); }
    $("#pitty-banner-sub").textContent = `${PT.total} faixa(s)`;
    renderAll();
  } catch { const el = $("#pitty-banner-sub"); if (el) el.textContent = "Falha ao carregar — toque para tentar"; }
}
$("#pitty-banner").onclick = () => {
  if (!PT) { toast("Tentando carregar… ⏳"); loadPT(); return; }
  view = "pitty"; ptAlbum = ""; activePlaylist = null;
  syncNav(); renderAll(); $("#main").scrollTo({ top: 0 });
};

// ---------- Nirvana ----------
function renderNvHead() {
  if (!NV) return;
  if (NV.albums[0] && NV.albums[0].art) $("#nv-photo").src = NV.albums[0].art;
  $("#nv-stats").textContent = `${NV.total} faixa(s) · ${NV.albums.length} álbum(ns)`;
  const box = $("#nv-albums"); box.innerHTML = "";
  const all = document.createElement("button");
  all.textContent = `Tudo (${NV.total})`;
  all.className = nvAlbum ? "" : "active";
  all.onclick = () => { nvAlbum = ""; renderAll(); };
  box.appendChild(all);
  NV.albums.forEach((a) => {
    const b = document.createElement("button");
    b.textContent = `${a.year} · ${a.name} (${a.count})`;
    b.className = nvAlbum === a.name ? "active" : "";
    b.onclick = () => { nvAlbum = a.name; renderAll(); $("#main").scrollTo({ top: 0 }); };
    box.appendChild(b);
  });
}
async function loadNV() {
  try {
    NV = await catOrEmbedded("nv", "./nirvana.json");
    const cur = order[pos];
    NV.tracks.forEach((nv) => {
      if (tracks.some((t) => t.src === nv.preview)) return;
      tracks.push({ title: nv.title, artist: nv.artist, album: nv.album, genre: "Rock", hue: (nv.id * 17) % 360, src: nv.preview, nv: true, art: nv.art, year: nv.year });
    });
    if (shuffle && cur !== undefined && tracks[cur]) buildOrder(cur);
    else { const have = new Set(order); tracks.forEach((_, i) => { if (!have.has(i)) { order.push(i); have.add(i); } }); }
    $("#nv-banner-sub").textContent = `${NV.total} faixa(s)`;
    renderAll();
  } catch { const el = $("#nv-banner-sub"); if (el) el.textContent = "Falha ao carregar — toque para tentar"; }
}
$("#nv-banner").onclick = () => {
  if (!NV) { toast("Tentando carregar… ⏳"); loadNV(); return; }
  view = "nirvana"; nvAlbum = ""; activePlaylist = null;
  syncNav(); renderAll(); $("#main").scrollTo({ top: 0 });
};
$("#btn-dl-nv").onclick = () => downloadList(filteredTracks());

// ---------- músicas do aparelho (Android MediaStore) ----------
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function deviceCount() { return tracks.filter((t) => t.device).length; }
function updateDevHead() {
  const n = deviceCount();
  $("#dev-count").textContent = n
    ? `${n} música(s) importada(s) do aparelho 📱`
    : (window.AndroidLib ? "Nenhuma música encontrada. Toque em ⟳ atualizar." : "Recurso disponível no app Android 📱");
}
async function importDevice(silent) {
  if (!window.AndroidLib || !window.AndroidLib.getSongs) return;
  let res;
  try { res = window.AndroidLib.getSongs(); } catch { return; }
  if (res === "NEED_PERM") { maybeShowPermCard(); return; }
  if (!res || res === "ERROR" || res === "DENIED") return;
  let arr = [];
  try { arr = JSON.parse(res); } catch { return; }
  const have = new Set(tracks.filter((t) => t.device).map((t) => t.src));
  let n = 0;
  arr.forEach((s) => {
    if (!s.uri || have.has(s.uri)) return;
    tracks.push({
      title: s.title || "Desconhecida", artist: s.artist || "Desconhecido",
      album: s.album || "No aparelho", genre: "Aparelho",
      hue: hashStr(s.title || "x") % 360, src: s.uri, device: true, year: "",
      _dur: (s.dur || 0) / 1000,
    });
    order.push(tracks.length - 1); n++;
  });
  updateDevHead();
  if (n) { renderAll(); toast(`${n} música(s) do aparelho 📱`); }
  else if (!silent) toast("Nenhuma música nova no aparelho ✅");
}
function hidePermCard() { const c = $("#perm-card"); if (c) c.hidden = true; }
function permDismissed() { try { return localStorage.getItem("ts_perm_no") === "1"; } catch { return false; } }
function maybeShowPermCard() { if (!permDismissed()) $("#perm-card").hidden = false; }
$("#btn-perm-ok").onclick = () => { hidePermCard(); try { window.AndroidLib.askPerm(); } catch {} };
$("#btn-perm-no").onclick = () => { try { localStorage.setItem("ts_perm_no", "1"); } catch {} hidePermCard(); };
function requestDeviceAccess() {
  if (!window.AndroidLib || !window.AndroidLib.getSongs) return toast("Recurso do app Android 📱");
  let res;
  try { res = window.AndroidLib.getSongs(); } catch { return; }
  if (res === "NEED_PERM") { try { window.AndroidLib.askPerm(); } catch {} return; }
  importDevice(false);
}
window.__onDevicePerm = (ok) => {
  if (ok) { hidePermCard(); importDevice(true); }
  else { toast("Sem permissão, sem músicas do aparelho 🚫"); updateDevHead(); }
};
$("#btn-rescan").onclick = () => requestDeviceAccess();

// ---------- chat pedir música ----------
const DEFAULT_WA = "5571999104096"; // WhatsApp do dono — recebe os pedidos
const chatStore = {
  load() {
    try {
      const raw = localStorage.getItem("thomchat-v1");
      if (!raw) return { msgs: [], wa: DEFAULT_WA };
      const d = JSON.parse(raw) || {};
      return { msgs: d.msgs || [], wa: d.wa || "" };
    } catch { return { msgs: [], wa: DEFAULT_WA }; }
  },
  save(d) { try { localStorage.setItem("thomchat-v1", JSON.stringify(d)); } catch {} },
};
let chat = chatStore.load();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function waNumber() { return (chat.wa || "").replace(/\D/g, ""); }
function renderChat() {
  const box = $("#chat-msgs"); box.innerHTML = "";
  const day = document.createElement("div");
  day.className = "chat-day"; day.textContent = "Peça sua música 🎵";
  box.appendChild(day);
  chat.msgs.slice(-50).forEach((m) => {
    const d = document.createElement("div");
    if (m.audioId) {
      d.className = "bubble mine";
      const b = audioBlobs[m.audioId];
      if (b) {
        if (!audioURLs[m.audioId]) { try { audioURLs[m.audioId] = URL.createObjectURL(b); } catch {} }
        d.innerHTML = `<audio controls preload="metadata" src="${audioURLs[m.audioId] || ""}"></audio><small>🎤 ${m.dur || 0}s</small><button class="mini-btn" data-resend="${m.audioId}">⤓ salvar / enviar</button>`;
      } else {
        d.innerHTML = `🎤 áudio expirado (sessão anterior)<small>${esc(m.time || "")}</small>`;
      }
      box.appendChild(d);
      return;
    }
    d.className = "bubble " + (m.mine ? "mine" : "theirs");
    d.innerHTML = `${esc(m.text)}<small>${esc(m.time || "")}</small>`;
    box.appendChild(d);
  });
  box.querySelectorAll("[data-resend]").forEach((btn) => { btn.onclick = () => resendAudio(btn.dataset.resend); });
  if (!ownerMode) $("#chat-status").textContent = waNumber() ? "online · envia p/ WhatsApp" : "online";
  box.scrollTop = box.scrollHeight;
}
function openChat() { renderChat(); $("#chat").classList.add("open"); setTimeout(() => { try { $("#chat-text").focus(); } catch {} }, 250); }
function closeChat() { $("#chat").classList.remove("open"); }
function chatPush(text, mine = true) {
  const now = new Date();
  chat.msgs.push({ text, mine, time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
  chat.msgs = chat.msgs.slice(-100);
  chatStore.save(chat); renderChat();
}
function sendRequest() {
  const inp = $("#chat-text");
  const text = inp.value.trim();
  if (!text) return;
  chatPush(`🎵 Pedido: ${text}`);
  inp.value = "";
  let num = waNumber();
  if (!num) { chat.wa = DEFAULT_WA; chatStore.save(chat); renderChat(); num = DEFAULT_WA; }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent("🎵 Pedido Thom Songs\n🎶 " + text)}`, "_blank");
  chatPush("✅ Pedido enviado! Valeu! 🙌", false);
}
$("#chat-fab").onclick = openChat;
$("#btn-chat-close").onclick = closeChat;
$("#btn-chat-send").onclick = sendRequest;
$("#chat-text").addEventListener("keydown", (e) => { if (e.key === "Enter") sendRequest(); });
$("#btn-chat-current").onclick = () => {
  const t = curTrack();
  if (t) $("#chat-text").value = `${t.artist} - ${t.title}`;
  try { $("#chat-text").focus(); } catch {}
};

// ---------- chat: modo dono + envio de áudio (só o dono envia) ----------
let ownerMode = false;
const audioBlobs = {}, audioURLs = {};
function ownerPin() { try { return localStorage.getItem("thom_owner_pin") || ""; } catch { return ""; } }
function setOwnerPin(p) { try { localStorage.setItem("thom_owner_pin", p); } catch {} }
function refreshOwnerUI() {
  $("#btn-chat-mic").hidden = !ownerMode;
  if (ownerMode) $("#chat-status").textContent = "modo dono 👑 · só você envia áudio";
  renderChat();
}
function ownerToggle() {
  if (ownerMode) { ownerMode = false; refreshOwnerUI(); toast("Modo dono off"); return; }
  const has = ownerPin();
  const v = prompt(has ? "PIN do dono:" : "Crie seu PIN do dono (4+ dígitos):");
  if (v == null) return;
  if (!has) {
    if (v.replace(/\D/g, "").length < 4) return toast("PIN muito curto ⚠️");
    setOwnerPin(v); ownerMode = true;
  } else if (v === has) ownerMode = true;
  else return toast("PIN incorreto 🚫");
  refreshOwnerUI(); toast("Modo dono ativo 👑 — só você envia áudio");
}
(() => {
  const title = document.querySelector(".chat-title");
  if (!title) return;
  let t = null;
  const start = () => { t = setTimeout(ownerToggle, 700); };
  const cancel = () => clearTimeout(t);
  title.addEventListener("touchstart", start, { passive: true });
  title.addEventListener("touchend", cancel);
  title.addEventListener("touchcancel", cancel);
  title.addEventListener("mousedown", start);
  title.addEventListener("mouseup", cancel);
  title.addEventListener("mouseleave", cancel);
  try { title.style.userSelect = "none"; title.style.webkitUserSelect = "none"; } catch {}
})();
let rec = null, recChunks = [], recStart = 0, recStream = null;
async function toggleRec() {
  if (rec) return stopRec();
  if (!ownerMode) return toast("Só o dono envia áudio 👑");
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast("Gravação não suportada aqui ⚠️");
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch { return toast("Permita o microfone para gravar 🎤"); }
  try {
    recChunks = [];
    rec = new MediaRecorder(recStream);
  } catch { try { recStream.getTracks().forEach((x) => x.stop()); } catch {} recStream = null; return toast("Gravação não suportada ⚠️"); }
  rec.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  rec.onstop = () => {
    const dur = Math.max(1, Math.round((Date.now() - recStart) / 1000));
    const blob = new Blob(recChunks, { type: (rec && rec.mimeType) || "audio/webm" });
    try { recStream.getTracks().forEach((x) => x.stop()); } catch {}
    recStream = null; rec = null;
    $("#btn-chat-mic").classList.remove("rec");
    handleRecordedAudio(blob, dur);
  };
  recStart = Date.now();
  try { rec.start(); } catch { return toast("Falha ao gravar ⚠️"); }
  $("#btn-chat-mic").classList.add("rec");
  toast("🔴 Gravando… toque de novo para parar");
}
function stopRec() { try { if (rec) rec.stop(); } catch { rec = null; $("#btn-chat-mic").classList.remove("rec"); } }
function audioFileName() { return `thomsongs-audio-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`; }
async function shareOrSaveAudio(blob, fname) {
  try {
    const file = new File([blob], fname, { type: blob.type || "audio/webm" });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Áudio Thom Songs" });
      chatPush("📤 Áudio compartilhado!", false);
      return true;
    }
  } catch {}
  const rd = new FileReader();
  await new Promise((res) => { rd.onload = res; rd.readAsDataURL(blob); });
  const b64 = String(rd.result).split(",")[1];
  if (window.AndroidDL && window.AndroidDL.saveAudio) window.AndroidDL.saveAudio(b64, fname);
  else {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 15000);
  }
  toast("Áudio salvo — encaminhe no WhatsApp 🎤");
  return true;
}
async function handleRecordedAudio(blob, dur) {
  if (!blob || !blob.size) return toast("Áudio vazio ⚠️");
  const id = "a" + Date.now();
  audioBlobs[id] = blob;
  pushAudioMsg(id, dur);
  await shareOrSaveAudio(blob, audioFileName());
}
function pushAudioMsg(id, dur) {
  const now = new Date();
  chat.msgs.push({ audioId: id, dur, mine: true, time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` });
  chat.msgs = chat.msgs.slice(-100);
  chatStore.save(chat); renderChat();
}
async function resendAudio(id) {
  const blob = audioBlobs[id];
  if (!blob) return toast("Áudio expirado ⚠️");
  await shareOrSaveAudio(blob, audioFileName());
}
$("#btn-chat-mic").onclick = toggleRec;

// ---------- atualização automática (APK) ----------
const UPDATE_BASE = "https://raw.githubusercontent.com/silvauelton392-cloud/PlayGround/main/";
let updateInfo = null, lastUpdateCheck = 0;
async function checkUpdate(manual) {
  if (!window.AndroidApp || !window.AndroidApp.versionCode) {
    if (manual) toast("Atualização automática só no app Android 📱");
    return;
  }
  try {
    const r = await fetch(UPDATE_BASE + "version.json?t=" + Date.now());
    if (!r.ok) throw new Error("http");
    const v = await r.json();
    lastUpdateCheck = Date.now();
    const cur = window.AndroidApp.versionCode();
    if (v.versionCode > cur && v.apk) {
      updateInfo = v;
      $("#update-sub").textContent = `Versão ${v.versionName} disponível — ${v.notes || "novidades"}.`;
      $("#update-card").hidden = false;
      toast(`Nova versão ${v.versionName} — baixando… ⬇️`);
      window.AndroidApp.downloadUpdate(UPDATE_BASE + v.apk, v.apk);
    } else {
      updateInfo = null;
      $("#update-card").hidden = true;
      if (manual) toast("App já atualizado ✅");
    }
  } catch { if (manual) toast("Sem conexão para verificar ⚠️"); }
}
function triggerUpdateDownload() {
  if (!updateInfo) return checkUpdate(true);
  try {
    window.AndroidApp.downloadUpdate(UPDATE_BASE + updateInfo.apk, updateInfo.apk);
    toast("Baixando atualização… ⬇️");
  } catch { toast("Falha ao baixar ⚠️"); }
}
$("#btn-update").onclick = () => checkUpdate(true);
$("#btn-update-go").onclick = triggerUpdateDownload;
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastUpdateCheck > 5 * 60 * 1000) checkUpdate(false);
});

// ---------- aviso de app atualizado ----------
async function checkFreshUpdate() {
  if (!window.AndroidApp || !window.AndroidApp.versionCode) return;
  let cur = 0, name = "";
  try { cur = window.AndroidApp.versionCode(); name = window.AndroidApp.versionName(); } catch { return; }
  if (!cur) return;
  let seen = 0;
  try { seen = +(localStorage.getItem("thomseen-vc") || 0); } catch {}
  try { localStorage.setItem("thomseen-vc", String(cur)); } catch {}
  if (!seen || seen >= cur) return;
  let notes = "";
  try {
    const r = await fetch(UPDATE_BASE + "version.json?t=" + Date.now());
    if (r.ok) notes = (await r.json()).notes || "";
  } catch {}
  $("#upd-ver").textContent = `Versão ${name || cur}`;
  $("#upd-notes").textContent = notes || "Melhorias e correções.";
  $("#modal-update").hidden = false;
}
$("#upd-ok").onclick = () => ($("#modal-update").hidden = true);

// ---------- boas-vindas (primeira abertura) ----------
function checkWelcome() {
  let seen = false;
  try { seen = localStorage.getItem("thomseen-welcome") === "1"; } catch {}
  if (seen) return;
  $("#modal-welcome").hidden = false;
}
$("#welcome-ok").onclick = () => {
  try { localStorage.setItem("thomseen-welcome", "1"); } catch {}
  $("#modal-welcome").hidden = true;
};

// ---------- init ----------
greeting();
buildOrder(0, false);
if (shuffle) buildOrder(0, true);
fitCanvases();
setTimeout(fitCanvases, 300);
renderLyrics();
renderAll();
drawLoop();
updatePlayerUI();
loadNX();
loadCB();
loadPT();
loadNV();
setTimeout(() => checkUpdate(false), 9000);
setTimeout(() => { if (!updateInfo) checkUpdate(false); }, 60000);
setTimeout(() => checkFreshUpdate(), 2500);
(function checkDeviceAccess() {
  if (!window.AndroidLib || !window.AndroidLib.getSongs) return;
  let res;
  try { res = window.AndroidLib.getSongs(); } catch { return; }
  if (res === "NEED_PERM") { maybeShowPermCard(); updateDevHead(); return; }
  hidePermCard();
  importDevice(true);
})();
setTimeout(() => checkWelcome(), 900);
