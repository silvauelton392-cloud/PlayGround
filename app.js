(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ---------- PWA: registra o service worker (só em http/https) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW:', e.message));
    });
  }

  /* ---------- Theme ---------- */
  const themeBtn = $('themeBtn');
  const savedTheme = localStorage.getItem('voiceai-theme');
  if (savedTheme) { document.documentElement.dataset.theme = savedTheme; themeBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙'; }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? '' : 'light';
    if (next) document.documentElement.dataset.theme = next; else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('voiceai-theme', next);
    themeBtn.textContent = next === 'light' ? '☀️' : '🌙';
  });

  /* ================= TIER LIST ONMYOJI ARENA (meta v3.333, set/2026) ================= */
  const OA_META = {
    top: { name: 'Top', icon: '⚔️', color: '#ff6b6b', tiers: {
      'S+': ['Tanjiro Kamado', 'Kani Hime'],
      'S': ['Ibaraki Doji', 'Furi', 'Orochi', 'Yuki', 'Aobozu', 'Kujira', 'Lord Arakawa', 'Takiyasha Hime'],
      'A': ['Kuro', 'Onigiri', 'Susanoo', 'Jinmenju', 'Rukia Kuchiki', 'Nezuko Kamado', 'Zashiki', 'Shuten Doji', 'Yumekui'],
      'B': ['Tanuki', 'Shishio', 'Kuro Mujou', 'Ryomen', 'Karasu Tengu', 'Kyonshi Ani', 'Vampira', 'Satori', 'Kyonshi Imoto', 'Yoto Hime', 'Jorogumo'],
      'C': ['Ichigo Kurosaki', 'Inugami', 'Hououga', 'Hannya', 'Inuyasha'] } },
    jungle: { name: 'Jungle', icon: '🌿', color: '#2ed573', tiers: {
      'S+': ['Wukong', 'Itsumade', 'Furi', 'Kainin'],
      'S': ['Yato no Kami', 'Kosodenote', 'Susanoo', 'Puppeteer'],
      'A': ['Ittan-momen', 'Shishio', 'Hakuzosu', 'Onikiri', 'Rukia Kuchiki', 'Yoto Hime', 'Yamakaze', 'Yumekui'],
      'B': ['Yasha', 'Hone Onna', 'Mannendake', 'Ibaraki Doji'],
      'C': ['Sesshomaru', 'Yuki', 'Karasu Tengu', 'Yamawaro', 'Ubume', 'Kamaitachi', 'Mouba', 'Kyuumei Neko'] } },
    mid: { name: 'Mid', icon: '🔮', color: '#a55eea', tiers: {
      'S+': ['Inaba Kaguya', 'Nyuunai-suzume', 'Hoshiguma Doji', 'Ungaikyo', 'Maestro', 'Senhime'],
      'S': ['Inryo', 'Shiranui', 'Kiyohime', 'Hana', 'Menreiki', 'Taishakuten', 'Lana'],
      'A': ['Kyonshi Imoto', 'Dai Shimei', 'Bukkuman', 'Higanbana', 'Shiro Mujou'],
      'B': ['Oitsuki', 'Futakuchi', 'Enma', 'Tamamonomae', 'Mouba', 'Vampira', 'Kingyo', 'Shiro', 'Aoandon'],
      'C': ['Kikyo', 'Suzuka Gozen', 'Susabi', 'Enenra', 'Hangan', 'Yuki Onna', 'Momiji', 'Ootengu', 'Kisei', 'Tesso'] } },
    marksman: { name: 'Marksman', icon: '🏹', color: '#ffa502', tiers: {
      'S+': ['Mahamayuri', 'Kidomaru', 'Enma'],
      'S': ['Kinnara', 'Youko', 'Suzuka Gozen', 'Tesso', 'Kaoru'],
      'A': ['Rei', 'Jikikaeru', 'Miketsu', 'Futakuchi', 'Komatsu', 'Chin'],
      'B': ['Hakuro'],
      'C': ['Kikyo', 'Kubinashi', 'Kanko', 'Dodomeki'] } },
    support: { name: 'Support', icon: '💚', color: '#1e90ff', tiers: {
      'S+': ['Mushishi', 'Nezuko Kamado', 'Momo', 'Akaname', 'Hako Shoujo', 'Kusa', 'Tenjo Kudari'],
      'S': ['Hiyoribou', 'Bukkuman', 'Ebisu', 'Shouzu', 'Bakekujira', 'Kaguya', 'Ichimokuren', 'Hana'],
      'A': ['Izanami', 'Umibozu', 'Yamausagi', 'Kamimai'],
      'B': ['Samurai X', 'Yamawaro'],
      'C': ['Karasu Tengu', 'Tanuki', 'Kuro'] } },
  };
  const OA_TOP10 = ['Maestro', 'Kani Hime', 'Itsumade', 'Kainin', 'Mahamayuri', 'Kidomaru', 'Wukong', 'Inaba Kaguya', 'Ungaikyo', 'Senhime'];
  let oaMains = [];
  try { oaMains = JSON.parse(localStorage.getItem('voiceai-oa-mains') || '[]'); } catch { oaMains = []; }
  let oaLane = 'all', oaQuery = '';
  const oaTop10El = $('oaTop10'), oaTiersEl = $('oaTiers');
  function oaInitials(name) { return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
  function oaFindLane(name) {
    for (const [key, lane] of Object.entries(OA_META))
      for (const [tier, names] of Object.entries(lane.tiers))
        if (names.includes(name)) return { lane: lane.name, tier, color: lane.color };
    return null;
  }
  function oaBadge(name, color) {
    const b = document.createElement('button');
    b.className = 'oa-badge' + (oaMains.includes(name) ? ' main' : '');
    const av = document.createElement('span');
    av.className = 'oa-avatar'; av.textContent = oaInitials(name); av.style.background = color;
    const nm = document.createElement('span'); nm.textContent = name;
    const st = document.createElement('span');
    st.className = 'oa-star'; st.textContent = oaMains.includes(name) ? '★' : '☆';
    b.append(av, nm, st);
    b.title = `${name} — toque para ${oaMains.includes(name) ? 'remover dos' : 'marcar como'} mains`;
    b.addEventListener('click', () => {
      oaMains = oaMains.includes(name) ? oaMains.filter(m => m !== name) : [...oaMains, name];
      localStorage.setItem('voiceai-oa-mains', JSON.stringify(oaMains));
      renderOaTiers();
    });
    return b;
  }
  function renderOaTiers() {
    const q = oaQuery.trim().toLowerCase();
    oaTop10El.innerHTML = '';
    OA_TOP10.forEach((name, i) => {
      const info = oaFindLane(name);
      const c = document.createElement('button');
      c.className = 'chip'; c.textContent = `${i + 1}. ${name}`;
      c.title = info ? `${info.lane} · Tier ${info.tier}` : name;
      c.addEventListener('click', () => { oaQuery = name; $('oaSearch').value = name; oaLane = 'all'; syncLaneChips(); renderOaTiers(); });
      oaTop10El.appendChild(c);
    });
    oaTiersEl.innerHTML = '';
    const lanes = oaLane === 'all' ? Object.entries(OA_META)
      : oaLane === 'mains' ? [] : [[oaLane, OA_META[oaLane]]];
    let shown = 0;
    const matchQ = (n) => !q || n.toLowerCase().includes(q);
    if (oaLane === 'mains') {
      const box = document.createElement('div');
      box.innerHTML = `<h3 class="oa-lane-title">⭐ Meus mains (${oaMains.length})</h3>`;
      const wrap = document.createElement('div'); wrap.className = 'oa-tier-sp';
      const list = oaMains.filter(matchQ);
      if (!list.length) { wrap.innerHTML = '<span class="muted">Toque num shikigami para marcá-lo como main.</span>'; }
      list.forEach(n => { const info = oaFindLane(n); wrap.appendChild(oaBadge(n, info ? info.color : '#8395a7')); });
      box.appendChild(wrap); oaTiersEl.appendChild(box);
      shown = list.length;
    } else {
      for (const [key, lane] of lanes) {
        let laneShown = 0;
        const sec = document.createElement('div');
        sec.innerHTML = `<h3 class="oa-lane-title">${lane.icon} ${lane.name}</h3>`;
        for (const tier of ['S+', 'S', 'A', 'B', 'C']) {
          const names = (lane.tiers[tier] || []).filter(matchQ);
          if (!names.length) continue;
          laneShown += names.length; shown += names.length;
          const row = document.createElement('div');
          row.className = `oa-tier oa-tier-${tier.replace('+', 'plus')}`;
          const lab = document.createElement('div'); lab.className = 'oa-tier-label'; lab.textContent = tier;
          const sp = document.createElement('div'); sp.className = 'oa-tier-sp';
          names.forEach(n => sp.appendChild(oaBadge(n, lane.color)));
          row.append(lab, sp); sec.appendChild(row);
        }
        if (laneShown) oaTiersEl.appendChild(sec);
      }
    }
    if (!shown) {
      const d = document.createElement('div');
      d.className = 'status oa-empty';
      d.textContent = q ? `Nenhum shikigami combina com “${oaQuery.trim()}”.` : 'Nada por aqui.';
      oaTiersEl.appendChild(d);
    }
  }
  function syncLaneChips() {
    document.querySelectorAll('#laneChips .chip').forEach(c => c.classList.toggle('active', c.dataset.lane === oaLane));
  }
  document.querySelectorAll('#laneChips .chip').forEach(c => c.addEventListener('click', () => { oaLane = c.dataset.lane; syncLaneChips(); renderOaTiers(); }));
  $('oaSearch').addEventListener('input', (e) => { oaQuery = e.target.value; renderOaTiers(); });
  renderOaTiers();

  /* ================= CÓDEX ONMYOJI ARENA (dados: Shikigami Index fã-site) ================= */
  const OA_CODEX = {
    stats: ['142 shikigamis', '60 SSR · 60 SR · 19 R · 3 SP', '877 skins', '52 Legendary · 61 Royal', '16 collabs', '36 seasons'],
    classes: [
      { id: 'samurai', name: 'Samurai', icon: '⚔️', count: 38, featured: [
        { n: 'Shuten Doji', jp: '酒呑童子', r: 'SSR', t: 'Oeyama Demon King', slug: 'shuten-doji' },
        { n: 'Ibaraki Doji', jp: '茨木童子', r: 'SSR', t: 'Oeyama Commander', slug: 'ibaraki-doji' },
        { n: 'Asura', jp: '阿修羅', r: 'SSR', t: 'Hellfire Archdemon', slug: 'asura' },
        { n: 'Susanowo', jp: '須佐之男', r: 'SSR', t: 'Heavenly Executioner', slug: 'susanowo' } ] },
      { id: 'mage', name: 'Mage', icon: '🔮', count: 42, featured: [
        { n: 'Aoandon', jp: '青行燈', r: 'SSR', t: 'Story Lord', slug: 'aoandon' },
        { n: 'Ootengu', jp: '大天狗', r: 'SSR', t: 'Wind of Justice', slug: 'ootengu' },
        { n: 'Tamamonomae', jp: '玉藻前', r: 'SSR', t: 'Fallen Fox Flame', slug: 'tamamonomae' },
        { n: 'Amaterasu', jp: '天照', r: 'SSR', t: 'Heavenly King', slug: 'amaterasu' } ] },
      { id: 'marksman-c', name: 'Marksman', icon: '🏹', count: 24, featured: [
        { n: 'Suzuka Gozen', jp: '鈴鹿御前', r: 'SSR', t: 'Suzuka Lord', slug: 'suzuka-gozen' },
        { n: 'Miketsu', jp: '御饌津', r: 'SSR', t: 'Inari Deity', slug: 'miketsu' },
        { n: 'Enma', jp: '閻魔', r: 'SSR', t: 'Underworld Lord', slug: 'enma' },
        { n: 'Mahamayuri', jp: '孔雀明王', r: 'SSR', t: 'Prayer Dance of the Sparrow', slug: 'mahamayuri' } ] },
      { id: 'ninja', name: 'Ninja', icon: '🗡️', count: 29, featured: [
        { n: 'Yamakaze', jp: '山風', r: 'SSR', t: 'King of the Wildwood', slug: 'yamakaze' },
        { n: 'Onikiri', jp: '鬼切', r: 'SSR', t: 'Demonbane', slug: 'onikiri' },
        { n: 'Hakuzosu', jp: '白蔵主', r: 'SSR', t: 'Lord of Mt. Dream', slug: 'hakuzosu' },
        { n: 'Ubume', jp: '姑獲鳥', r: 'SR', t: 'Lone Benevolent Feather', slug: 'ubume' } ] },
      { id: 'tank', name: 'Tank', icon: '🛡️', count: 19, featured: [
        { n: 'Ungaikyo', jp: '雲外鏡', r: 'SSR', t: 'Void Mirror', slug: 'ungaikyo' },
        { n: 'Kuro', jp: '黒童子', r: 'SR', t: 'Beginner Black Emissary', slug: 'kuro' },
        { n: 'Yumekui', jp: '夢喰い', r: 'SR', t: 'Nightmare Devourer', slug: 'yumekui' },
        { n: 'Kani Hime', jp: '蟹姫', r: 'SR', t: 'Tank Crab Guardian', slug: 'kani-hime' } ] },
      { id: 'support-c', name: 'Support', icon: '💚', count: 23, featured: [
        { n: 'Kaguya', jp: 'かぐや姫', r: 'SSR', t: 'Princess Kaguya', slug: 'kaguya' },
        { n: 'Ichimokuren', jp: '一目連', r: 'SSR', t: 'Old Tempest', slug: 'ichimokuren' },
        { n: 'Enmusubi', jp: '縁結神', r: 'SSR', t: 'Fate Bestower', slug: 'enmusubi' },
        { n: 'Young Ootengu', jp: '少羽大天狗', r: 'SP', t: 'Will of the Featherling', slug: 'young-ootengu' } ] },
    ],
    collabs: [
      { n: 'Demon Slayer', g: ['Tanjiro Kamado', 'Nezuko Kamado', 'Zenitsu Agatsuma', 'Inosuke Hashibira'] },
      { n: 'Inuyasha', g: ['Inuyasha', 'Sesshomaru', 'Kikyo'] },
      { n: 'BLEACH', g: ['Ichigo Kurosaki', 'Rukia Kuchiki'] },
      { n: 'Gintama', g: ['Gintoki Sakata', 'Kagura'] },
      { n: 'Shaman King', g: ['Anna Kyoyama', 'Yoh Asakura'] },
      { n: 'Phantoms: Tang Dynasty', g: ['Aori', 'Dai Shimei'] },
      { n: 'Fog Hill of Five Elements', g: ['Wenren Yixuan', 'Shentu Ziye'] },
      { n: 'Extraordinary Ones', g: ['Jingwei', 'Xiliang'] },
      { n: 'Natsuhiko Kyogoku', g: ['Yato no Kami'] },
    ],
  };
  let oaCodexClass = 'samurai';
  function renderOaCodex() {
    const statsEl = $('oaStats');
    statsEl.innerHTML = '';
    OA_CODEX.stats.forEach(s => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = s; statsEl.appendChild(c); });
    const chipsEl = $('oaClassChips');
    chipsEl.innerHTML = '';
    OA_CODEX.classes.forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip lane' + (c.id === oaCodexClass ? ' active' : '');
      b.textContent = `${c.icon} ${c.name} (${c.count})`;
      b.addEventListener('click', () => { oaCodexClass = c.id; renderOaCodex(); });
      chipsEl.appendChild(b);
    });
    const cls = OA_CODEX.classes.find(c => c.id === oaCodexClass);
    const det = $('oaClassDetail');
    det.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'oa-codex-grid';
    cls.featured.forEach(f => {
      const card = document.createElement('div');
      card.className = 'oa-shiki';
      const info = oaFindLane(f.n);
      card.innerHTML = `<h4>${f.n}</h4><div class="jp">${f.jp}</div>` +
        `<div class="title">${escapeHtml(f.t)}</div>` +
        `<div class="meta"><span class="rarity rarity-${f.r}">${f.r}</span>` +
        (info ? `<span class="oa-tier-tag">${info.lane} · Tier ${info.tier}</span>` : '') +
        `<a class="oa-src" href="https://onmyojiarena.co.in/shikigami/${f.slug}/" target="_blank" rel="noopener">ficha ↗</a></div>`;
      grid.appendChild(card);
    });
    det.appendChild(grid);
    const col = $('oaCollabs');
    col.innerHTML = '';
    OA_CODEX.collabs.forEach(c => {
      const d = document.createElement('div');
      d.className = 'oa-collab';
      d.innerHTML = `<b>${escapeHtml(c.n)}</b> — ${c.g.map(g => escapeHtml(g)).join(' · ')}`;
      col.appendChild(d);
    });
  }
  renderOaCodex();
  const oaTiersView = $('oaTiersView'), oaCodexView = $('oaCodexView');
  const oaViewTiers = $('oaViewTiers'), oaViewCodex = $('oaViewCodex');
  function oaSetView(which) {
    const tiers = which === 'tiers';
    oaTiersView.style.display = tiers ? '' : 'none';
    oaCodexView.style.display = tiers ? 'none' : '';
    oaViewTiers.className = tiers ? 'primary' : 'secondary';
    oaViewCodex.className = tiers ? 'secondary' : 'primary';
  }
  oaViewTiers.addEventListener('click', () => oaSetView('tiers'));
  oaViewCodex.addEventListener('click', () => oaSetView('codex'));
})();
