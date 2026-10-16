/* OA Sens HUD — sensibilidade + HUD para Onmyoji Arena */
"use strict";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ---------- dados ---------- */
const SLIDERS = [
  { k: "cam", label: "Sensibilidade da Câmera", min: 1, max: 10, def: 5, tip: "Velocidade ao deslizar a tela. No jogo: Config → Controles → Sensibilidade da Câmera." },
  { k: "wheel", label: "Sens. da Roda de Skill", min: 1, max: 10, def: 6, tip: "Quão longe a seta de mira vai com pouco arrasto do dedo." },
  { k: "aim", label: "Assistência de Mira", min: 0, max: 10, def: 6, tip: "Ajuda a grudar a mira no alvo. Alto = gruda mais (bom para mago/atirador)." },
  { k: "map", label: "Sensibilidade do Minimapa", min: 1, max: 10, def: 4, tip: "Toque no minimapa para mover a câmera rápido e ver ganks." },
  { k: "height", label: "Altura da Câmera", min: 1, max: 5, def: 3, tip: "No jogo: Câmera Alta = vê mais da teamfight (recomendado 3+)." },
  { k: "cancel", label: "Área de Cancelar Skill", min: 1, max: 10, def: 5, tip: "Tamanho da zona de cancelar ao arrastar a skill para o X." },
];

const PROFILES = [
  { id: "eq", name: "Equilibrado", tag: "RECOMENDADO", desc: "Ideal para Ouro → Diamante", v: { cam: 5, wheel: 5, aim: 6, map: 4, height: 3, cancel: 5 } },
  { id: "pro", name: "Precisão Onmyoji", tag: "MAGO / ATIRADOR", desc: "Mira cravada p/ Ootengu, Miketsu, Menreiki", v: { cam: 4, wheel: 7, aim: 8, map: 3, height: 4, cancel: 4 } },
  { id: "speed", name: "Speed Ninja", tag: "YAMAKAZE / SELVA", desc: "Câmera rápida, gank em 1s", v: { cam: 8, wheel: 8, aim: 5, map: 7, height: 3, cancel: 6 } },
  { id: "claw", name: "Claw / Dedal", tag: "3-4 DEDOS", desc: "Botões menores, câmera estável", v: { cam: 6, wheel: 6, aim: 6, map: 5, height: 4, cancel: 7 } },
];

const ROLES = [
  { id: "Atirador", tip: "Atirador / Bot (Ubume, Miketsu, Menreiki): câmera 4–5, roda 6–7, trava de alvo em Menor HP. Altura 4 para ver o ninja antes do gank." },
  { id: "Mago", tip: "Mago / Mid (Ootengu, Tamamonomae, Higanbana, Susabi): roda 7–8 para skillshot longo. Assistência de mira alta." },
  { id: "Ninja", tip: "Ninja / Selva (Yamakaze, Yoto Hime, Ibaraki Doji): câmera 7–9! Você vive olhando as 3 rotas." },
  { id: "Samurai", tip: "Samurai / Top (Kuro Mujou, Onikiri, Shuten Doji): equilibrado 5/5/6, trava em Mais Próximo para o 1v1." },
  { id: "Tanque", tip: "Tanque (Shuten Doji, Ibaraki Doji tank): minimapa 6–7 para iniciar a luta olhando o mapa." },
  { id: "Suporte", tip: "Suporte (Yamausagi, Kaguya, Shiro Mujou): câmera 5, mapa 6. Priorize visão, escudo e posicionamento." },
];

const HEROES = [
  { n: "Ubume", f: "Atirador", e: "🪶", v: { cam: 4, wheel: 7, aim: 8, map: 3, height: 4, cancel: 4 } },
  { n: "Miketsu", f: "Atirador", e: "🏹", v: { cam: 5, wheel: 6, aim: 7, map: 4, height: 4, cancel: 5 } },
  { n: "Menreiki", f: "Atirador", e: "🎭", v: { cam: 5, wheel: 7, aim: 8, map: 4, height: 4, cancel: 4 } },
  { n: "Ootengu", f: "Mago", e: "🌪️", v: { cam: 4, wheel: 8, aim: 8, map: 3, height: 4, cancel: 4 } },
  { n: "Tamamonomae", f: "Mago", e: "🦊", v: { cam: 4, wheel: 7, aim: 9, map: 3, height: 4, cancel: 4 } },
  { n: "Higanbana", f: "Mago", e: "🌺", v: { cam: 5, wheel: 7, aim: 8, map: 4, height: 4, cancel: 4 } },
  { n: "Susabi", f: "Mago", e: "🌟", v: { cam: 4, wheel: 8, aim: 8, map: 3, height: 4, cancel: 4 } },
  { n: "Yamakaze", f: "Ninja", e: "🐺", v: { cam: 8, wheel: 8, aim: 5, map: 7, height: 3, cancel: 6 } },
  { n: "Yoto Hime", f: "Ninja", e: "🗡️", v: { cam: 7, wheel: 7, aim: 6, map: 6, height: 3, cancel: 5 } },
  { n: "Ibaraki Doji", f: "Ninja", e: "👹", v: { cam: 7, wheel: 6, aim: 6, map: 6, height: 3, cancel: 5 } },
  { n: "Kuro Mujou", f: "Samurai", e: "⛓️", v: { cam: 5, wheel: 5, aim: 6, map: 4, height: 3, cancel: 5 } },
  { n: "Onikiri", f: "Samurai", e: "⚔️", v: { cam: 6, wheel: 6, aim: 6, map: 5, height: 3, cancel: 5 } },
  { n: "Shuten Doji", f: "Tanque", e: "🍶", v: { cam: 5, wheel: 5, aim: 5, map: 7, height: 3, cancel: 6 } },
  { n: "Yamausagi", f: "Suporte", e: "🐰", v: { cam: 5, wheel: 5, aim: 7, map: 6, height: 4, cancel: 5 } },
  { n: "Kaguya", f: "Suporte", e: "🎋", v: { cam: 5, wheel: 6, aim: 7, map: 6, height: 4, cancel: 5 } },
  { n: "Shiro Mujou", f: "Suporte", e: "🤍", v: { cam: 5, wheel: 6, aim: 7, map: 6, height: 4, cancel: 5 } },
];

const FAQ = [
  ["A sensibilidade funciona em qualquer celular?", "Sim. Os valores usam os mesmos nomes do Onmyoji Arena (Config → Controles). O que muda por aparelho é o DPI do sistema e o tamanho do dedo — por isso use a aba Aparelho."],
  ["Qual a melhor sensibilidade para Ninja / selva?", "Câmera 7–8, roda 7–8, mapa 6–7 (ex: Yamakaze). O segredo é olhar o minimapa a cada 3 segundos + treinar entrada e saída da moita no modo prática."],
  ["Como deixo a mira mais precisa?", "Suba a Roda de Skill 1 ponto e a Assistência de Mira. Diminua a Câmera se você passa do alvo. Ajuste 1 ponto por vez e teste no treino."],
  ["Trava de alvo: Menor HP ou Mais Próximo?", "Atirador e mago: Menor HP (explode o carry). Samurai e tanque: Mais Próximo (não deixa o ninja fugir). Configure em Config → Batalha."],
  ["O que é HUD? Preciso mudar?", "HUD é a posição/tamanho dos botões. Jogador claw usa botões menores e juntos; jogador de 2 dedos usa botões maiores e afastados. Monte o seu na aba Meu HUD."],
  ["Meu jogo trava na teamfight. O que faço?", "Qualidade no Fluido/Equilibrado, taxa de quadros Alta, efeitos e sombras reduzidos, feche apps de fundo e jogue com ping abaixo de 60ms."],
];

const DEFAULT_HUD = [
  { id: "move", icon: "🕹️", label: "Mover", x: 14, y: 66, size: 92, op: 100, bg: "#5b4b8a" },
  { id: "atk", icon: "⚔️", label: "Ataque", x: 84, y: 68, size: 84, op: 100, bg: "#b3273b" },
  { id: "s1", icon: "1", label: "Skill 1", x: 73, y: 52, size: 62, op: 100, bg: "#6a3fb5" },
  { id: "s2", icon: "2", label: "Skill 2", x: 78, y: 34, size: 62, op: 100, bg: "#2f6db3" },
  { id: "ult", icon: "★", label: "Ult", x: 90, y: 44, size: 72, op: 100, bg: "#c97b1e" },
  { id: "spell", icon: "🔮", label: "Feitiço", x: 70, y: 74, size: 52, op: 95, bg: "#2e7d6e" },
  { id: "recall", icon: "↩️", label: "Voltar", x: 62, y: 24, size: 48, op: 90, bg: "#37474f" },
  { id: "regen", icon: "💚", label: "Cura", x: 62, y: 40, size: 48, op: 90, bg: "#2e7d32" },
  { id: "item", icon: "🎒", label: "Item", x: 30, y: 22, size: 50, op: 90, bg: "#5d4037" },
];

/* ---------- estado ---------- */
const store = {
  load() { try { return JSON.parse(localStorage.getItem("oasens-v1") || "{}") || {}; } catch { return {}; } },
  save(d) { try { localStorage.setItem("oasens-v1", JSON.stringify(d)); } catch {} },
};
const saved = store.load();
let sensi = { ...(PROFILES[0].v), ...(saved.sensi || {}) };
let profileId = saved.profileId || "eq";
let roleId = saved.roleId || "Atirador";
let heroFilter = "all", searchQ = "";
let hud = saved.hud || JSON.parse(JSON.stringify(DEFAULT_HUD));
let layouts = saved.layouts || {};
let selHud = "atk";
let claw = saved.claw || "2", lag = saved.lag || "no";

function persist() { store.save({ sensi, profileId, roleId, hud, layouts, claw, lag }); }
function toast(msg) {
  const box = $("#toasts");
  while (box.children.length > 2) box.firstChild.remove();
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2300);
}
function greeting() {
  const h = new Date().getHours();
  $("#greeting").textContent = h < 5 ? "Treinando de madrugada? 🌙" : h < 12 ? "Bom dia, onmyoji! ☀️" : h < 18 ? "Boa tarde, onmyoji! 🌤️" : "Rumo ao Mestre 🏆";
}

/* ---------- navegação ---------- */
function go(tab) {
  $$("#tabs-top button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$("#tabbar .nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === tab));
  $$("#main .tab-page").forEach((p) => p.classList.toggle("active", p.id === "tab-" + tab));
  $("#main").scrollTo({ top: 0 });
}
$$("#tabs-top button").forEach((b) => (b.onclick = () => go(b.dataset.tab)));
$$("#tabbar .nav-item").forEach((b) => (b.onclick = () => go(b.dataset.view)));

/* ---------- sensibilidade ---------- */
function profileName() { return (PROFILES.find((p) => p.id === profileId) || PROFILES[0]).name; }

function renderProfiles() {
  const box = $("#profiles"); box.innerHTML = "";
  PROFILES.forEach((p) => {
    const b = document.createElement("button");
    b.className = "profile" + (profileId === p.id ? " active" : "");
    b.innerHTML = `<span class="tag">${p.tag}</span><strong>${p.name}</strong><small>${p.desc}</small>`;
    b.onclick = () => { profileId = p.id; sensi = { ...p.v }; persist(); renderAll(); toast(`Perfil ${p.name} aplicado ⚡`); };
    box.appendChild(b);
  });
  const p = PROFILES.find((x) => x.id === profileId) || PROFILES[0];
  $("#profile-name").textContent = p.name;
  $("#profile-desc").textContent = p.desc;
}

function renderSliders() {
  const box = $("#sliders"); box.innerHTML = "";
  SLIDERS.forEach((s) => {
    const d = document.createElement("div");
    d.className = "slider";
    d.innerHTML = `<div class="row-between"><strong>${s.label}</strong><span class="val">${sensi[s.k]}</span></div>
      <input type="range" min="${s.min}" max="${s.max}" step="1" value="${sensi[s.k]}" />
      <small>${s.tip}</small>`;
    d.querySelector("input").oninput = (e) => {
      sensi[s.k] = +e.target.value;
      profileId = "custom";
      d.querySelector(".val").textContent = sensi[s.k];
      $("#profile-name").textContent = "Personalizado";
      $("#profile-desc").textContent = "Ajuste manual — treine antes da ranked";
      persist(); updateMini();
    };
    box.appendChild(d);
  });
}

function renderRoles() {
  const box = $("#roles"); box.innerHTML = "";
  ROLES.forEach((r) => {
    const b = document.createElement("button");
    b.textContent = (r.id === roleId ? "✓ " : "") + r.id;
    b.className = roleId === r.id ? "active" : "";
    b.onclick = () => { roleId = r.id; persist(); renderRoles(); };
    box.appendChild(b);
  });
  $("#role-tip").textContent = "💡 " + (ROLES.find((r) => r.id === roleId) || ROLES[0]).tip;
}

function renderHeroes() {
  const box = $("#hero-list"); box.innerHTML = "";
  const list = HEROES.filter((h) => (heroFilter === "all" || h.f === heroFilter) &&
    (!searchQ || `${h.n} ${h.f}`.toLowerCase().includes(searchQ)));
  if (!list.length) box.innerHTML = `<p class="hint">Nenhum shikigami encontrado. Tente "mago" ou "yoto".</p>`;
  list.forEach((h) => {
    const d = document.createElement("div");
    d.className = "hero-row";
    d.innerHTML = `<div class="hero-ico">${h.e}</div><div><strong>${h.n}</strong><span>${h.f} · Cam ${h.v.cam} · Roda ${h.v.wheel} · Mira ${h.v.aim}</span></div><button class="apply">Aplicar</button>`;
    d.querySelector(".apply").onclick = (e) => {
      e.stopPropagation();
      sensi = { ...h.v }; profileId = "custom"; roleId = h.f;
      persist(); renderAll(); toast(`Ajustes de ${h.n} aplicados 🎯`);
      $("#main").scrollTo({ top: 0, behavior: "smooth" });
    };
    d.onclick = () => { sensi = { ...h.v }; profileId = "custom"; roleId = h.f; persist(); renderAll(); toast(`${h.n}: pronto para testar ⚔️`); };
    box.appendChild(d);
  });
}
$$("#hero-filter button").forEach((b) => (b.onclick = () => {
  $$("#hero-filter button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); heroFilter = b.dataset.f; renderHeroes();
}));
let searchT;
$("#search").oninput = (e) => { clearTimeout(searchT); searchT = setTimeout(() => { searchQ = e.target.value.trim().toLowerCase(); renderHeroes(); }, 180); };

function sensiText() {
  return `⛩️ MEUS AJUSTES ONMYOJI ARENA — ${profileName()} (${roleId})\n` +
    `📷 Câmera: ${sensi.cam} · 🎡 Roda: ${sensi.wheel} · 🎯 Mira: ${sensi.aim}\n` +
    `🗺️ Mapa: ${sensi.map} · 👁️ Altura: ${sensi.height} · ❌ Cancelar: ${sensi.cancel}\n` +
    `📱 Dedos: ${claw} · Feito no app OA Sens HUD`;
}
function updateMini() {
  $("#m-title").textContent = `Perfil: ${profileName()}`;
  $("#m-artist").textContent = `Câmera ${sensi.cam} · Mira ${sensi.aim} · Roda ${sensi.wheel}`;
}
$("#btn-copy").onclick = async () => {
  try { await navigator.clipboard.writeText(sensiText()); toast("Ajustes copiados! 📋"); }
  catch { toast(sensiText()); }
};
$("#m-copy").onclick = $("#btn-copy").onclick;
$("#miniplayer").onclick = () => go("sensi");
$("#btn-reset-sensi").onclick = () => { profileId = "eq"; sensi = { ...PROFILES[0].v }; persist(); renderAll(); toast("Sensibilidade padrão restaurada ↺"); };
$("#btn-share").onclick = async () => {
  const data = { title: "Meus ajustes Onmyoji Arena", text: sensiText() };
  if (navigator.share) { try { await navigator.share(data); } catch {} }
  else { try { await navigator.clipboard.writeText(sensiText()); toast("Copiado — cole onde quiser 📤"); } catch {} }
};

/* ---------- HUD editor ---------- */
function renderHudSelect() {
  const sel = $("#hud-item"); sel.innerHTML = "";
  hud.forEach((h) => {
    const o = document.createElement("option");
    o.value = h.id; o.textContent = `${h.icon} ${h.label}`;
    sel.appendChild(o);
  });
  sel.value = selHud;
  const cur = hud.find((h) => h.id === selHud);
  if (cur) { $("#hud-size").value = cur.size; $("#hud-opacity").value = cur.op; }
}
$("#hud-item").onchange = (e) => { selHud = e.target.value; renderHud(); renderHudSelect(); };
$("#hud-size").oninput = (e) => { const cur = hud.find((h) => h.id === selHud); if (cur) { cur.size = +e.target.value; persist(); renderHud(); } };
$("#hud-opacity").oninput = (e) => { const cur = hud.find((h) => h.id === selHud); if (cur) { cur.op = +e.target.value; persist(); renderHud(); } };

function renderHud() {
  const cv = $("#hud-canvas");
  cv.querySelectorAll(".hud-btn").forEach((n) => n.remove());
  hud.forEach((h) => {
    const d = document.createElement("div");
    d.className = "hud-btn" + (h.id === selHud ? " sel" : "");
    d.dataset.id = h.id;
    d.style.left = h.x + "%"; d.style.top = h.y + "%";
    d.style.width = d.style.height = h.size + "px";
    d.style.fontSize = Math.max(14, h.size * 0.32) + "px";
    d.style.background = h.bg; d.style.opacity = h.op / 100;
    d.innerHTML = `${h.icon}<small>${h.label} ${h.size}</small>`;
    d.addEventListener("pointerdown", (e) => startDrag(e, h.id));
    cv.appendChild(d);
  });
}
let dragId = null;
function startDrag(e, id) {
  dragId = id; selHud = id;
  const el = document.querySelector(`.hud-btn[data-id="${id}"]`);
  if (el && el.setPointerCapture) try { el.setPointerCapture(e.pointerId); } catch {}
  moveDrag(e);
  const mv = (ev) => moveDrag(ev);
  const up = () => {
    dragId = null; persist(); renderHud(); renderHudSelect();
    window.removeEventListener("pointermove", mv);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", mv);
  window.addEventListener("pointerup", up);
  e.preventDefault();
}
function moveDrag(e) {
  if (!dragId) return;
  const cv = $("#hud-canvas").getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  const h = hud.find((x) => x.id === dragId);
  if (!h) return;
  h.x = Math.min(96, Math.max(4, ((cx - cv.left) / cv.width) * 100));
  h.y = Math.min(90, Math.max(10, ((cy - cv.top) / cv.height) * 100));
  const el = document.querySelector(`.hud-btn[data-id="${dragId}"]`);
  if (el) { el.style.left = h.x + "%"; el.style.top = h.y + "%"; }
}
$("#btn-hud-reset").onclick = () => { hud = JSON.parse(JSON.stringify(DEFAULT_HUD)); persist(); renderHud(); renderHudSelect(); toast("HUD padrão restaurado ↺"); };

function renderLayouts() {
  const box = $("#layout-list"); box.innerHTML = "";
  const names = Object.keys(layouts);
  if (!names.length) box.innerHTML = `<p class="hint">Nenhum layout salvo. Monte sua posição e toque em 💾 Salvar layout.</p>`;
  names.forEach((n) => {
    const d = document.createElement("div");
    d.className = "layout-row";
    d.innerHTML = `<strong>🕹️ ${n}</strong><button data-a="load">Usar</button><button data-a="del">✕</button>`;
    d.querySelector('[data-a="load"]').onclick = () => { hud = JSON.parse(JSON.stringify(layouts[n])); persist(); renderHud(); renderHudSelect(); go("hud"); toast(`Layout "${n}" carregado ✅`); };
    d.querySelector('[data-a="del"]').onclick = () => { if (confirm(`Excluir "${n}"?`)) { delete layouts[n]; persist(); renderLayouts(); } };
    box.appendChild(d);
  });
}
const modal = $("#modal"), modalInput = $("#modal-input");
$("#btn-hud-save").onclick = () => { modalInput.value = ""; modal.hidden = false; setTimeout(() => modalInput.focus(), 100); };
$("#modal-cancel").onclick = () => (modal.hidden = true);
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
$("#modal-ok").onclick = () => {
  const n = modalInput.value.trim() || `Layout ${Object.keys(layouts).length + 1}`;
  layouts[n] = JSON.parse(JSON.stringify(hud));
  persist(); renderLayouts(); modal.hidden = true; toast(`"${n}" salvo 💾`);
};
function encodeHud() { try { return btoa(unescape(encodeURIComponent(JSON.stringify(hud)))); } catch { return ""; } }
function decodeHud(code) { try { return JSON.parse(decodeURIComponent(escape(atob(code.trim())))); } catch { return null; } }
$("#btn-export").onclick = async () => {
  const code = encodeHud();
  $("#hud-code").value = code;
  try { await navigator.clipboard.writeText(code); toast("Código copiado! 📤"); } catch { toast("Código gerado abaixo 👇"); }
};
$("#btn-import").onclick = () => {
  const arr = decodeHud($("#hud-code").value || "");
  if (!arr || !Array.isArray(arr)) return toast("Código inválido ⚠️");
  hud = arr; persist(); renderHud(); renderHudSelect(); toast("Layout importado ✅");
};

/* ---------- aparelho / DPI ---------- */
$$("#claw-seg button").forEach((b) => (b.onclick = () => {
  $$("#claw-seg button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); claw = b.dataset.c; persist();
}));
$$("#lag-seg button").forEach((b) => (b.onclick = () => {
  $$("#lag-seg button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); lag = b.dataset.l; persist();
}));
$("#btn-calc").onclick = () => {
  const size = Math.max(4, Math.min(14, +$("#in-size").value || 6.5));
  const w = +$("#in-w").value || 1080, h = +$("#in-h").value || 2400;
  const diagPx = Math.hypot(w, h);
  const ppi = Math.round(diagPx / size);
  let dpi;
  if (size >= 10) dpi = 500 + Math.round(ppi / 12);
  else if (size >= 7.5) dpi = 430 + Math.round(ppi / 14);
  else dpi = 360 + Math.round(ppi / 16);
  dpi = Math.max(320, Math.min(700, dpi));
  if (claw === "2") sensi = { cam: 5, wheel: 6, aim: 7, map: 4, height: 4, cancel: 5 };
  if (claw === "3") sensi = { cam: 6, wheel: 6, aim: 6, map: 5, height: 4, cancel: 6 };
  if (claw === "4") sensi = { cam: 7, wheel: 7, aim: 6, map: 6, height: 3, cancel: 7 };
  if (claw === "6") sensi = { cam: 6, wheel: 7, aim: 7, map: 5, height: 4, cancel: 6 };
  if (lag === "mid") sensi = { ...sensi, height: 3 };
  if (lag === "yes") sensi = { ...sensi, height: 2, map: Math.max(3, sensi.map - 1) };
  profileId = "custom";
  const graficos = lag === "yes" ? "Fluido + Taxa de quadros Alta (efeitos e sombras reduzidos)" : lag === "mid" ? "Equilibrado + Taxa de quadros Alta" : "HD + Taxa de quadros Alta";
  const box = $("#dpi-result");
  box.hidden = false;
  box.innerHTML = `📱 <b>${w}×${h} · ${size}" · ~${ppi} ppi</b><br>` +
    `🎯 <b>DPI do sistema sugerido: ${dpi}</b> <small style="color:var(--mut)">(Ajuste → Opções do desenvolvedor → Menor largura ≈ ${dpi})</small><br>` +
    `🖐️ Estilo: <b>${claw} dedos</b> → Câmera <b>${sensi.cam}</b> · Roda <b>${sensi.wheel}</b> · Mira <b>${sensi.aim}</b><br>` +
    `🎮 Gráficos no OA: <b>${graficos}</b><br>` +
    `<small style="color:var(--mut)">⚠️ DPI muda o tamanho de tudo no celular. Anote o valor original antes de mexer!</small>`;
  persist(); renderAll();
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  toast("Sensibilidade calculada ⚙️");
};

/* ---------- guias / faq ---------- */
function renderFaq() {
  const box = $("#faq"); box.innerHTML = "";
  FAQ.forEach(([q, a]) => {
    const d = document.createElement("div");
    d.className = "faq-item";
    d.innerHTML = `<button>${q}</button><p>${a}</p>`;
    d.querySelector("button").onclick = () => d.classList.toggle("open");
    box.appendChild(d);
  });
}

/* ---------- fundo animado ---------- */
const bg = $("#bg-canvas"), gctx = bg.getContext("2d");
function fitBg() { bg.width = innerWidth; bg.height = innerHeight; }
addEventListener("resize", fitBg); fitBg();
const parts = Array.from({ length: 55 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, v: Math.random() * 0.0006 + 0.0002 }));
(function loop() {
  requestAnimationFrame(loop);
  gctx.clearRect(0, 0, bg.width, bg.height);
  parts.forEach((p) => {
    p.y -= p.v; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
    gctx.globalAlpha = 0.4;
    gctx.fillStyle = p.s > 1.5 ? "#e8b64c" : "#b3273b";
    gctx.beginPath(); gctx.arc(p.x * bg.width, p.y * bg.height, p.s * 1.6, 0, 7); gctx.fill();
  });
  gctx.globalAlpha = 1;
})();

/* ---------- tema / misc ---------- */
$("#btn-theme").onclick = () => {
  const r = document.documentElement;
  const light = r.dataset.theme === "light";
  r.dataset.theme = light ? "" : "light";
  $("#btn-theme").textContent = light ? "🌙" : "☀️";
};
// Atualização automática — usa o canal próprio do OA Sens HUD (version-oa.json),
// separado do Thom Songs, para um download nunca interferir no outro app.
const UPDATE_BASE = "https://raw.githubusercontent.com/silvauelton392-cloud/PlayGround/main/";
const UPDATE_FILE = "version-oa.json";
const baseName = (p) => String(p).split("/").pop();
$("#btn-update").onclick = async () => {
  if (!window.AndroidApp || !window.AndroidApp.versionCode) return toast("Atualização automática só no app Android 📱");
  try {
    const r = await fetch(UPDATE_BASE + UPDATE_FILE + "?t=" + Date.now());
    const v = await r.json();
    if (v.versionCode > window.AndroidApp.versionCode() && v.apk) { toast(`Nova versão ${v.versionName} — baixando… ⬇️`); window.AndroidApp.downloadUpdate(UPDATE_BASE + v.apk, baseName(v.apk)); }
    else toast("App já atualizado ✅");
  } catch { toast("Sem conexão ⚠️"); }
};
$("#btn-wipe").onclick = () => { if (confirm("Apagar todos os meus ajustes e layouts?")) { localStorage.removeItem("oasens-v1"); location.reload(); } };

/* ---------- init ---------- */
function renderAll() { renderProfiles(); renderSliders(); renderRoles(); renderHeroes(); renderHud(); renderHudSelect(); renderLayouts(); updateMini(); }
greeting();
$$("#claw-seg button").forEach((x) => x.classList.toggle("active", x.dataset.c === claw));
$$("#lag-seg button").forEach((x) => x.classList.toggle("active", x.dataset.l === lag));
renderFaq();
renderAll();
