/* ============================================================
   Marktplaats Tracker — frontend logica
   ============================================================ */

const API = '';
const CATEGORIES = ['Kleding', 'Meubels', 'Decoratie', 'Keuken', 'Speelgoed',
  'Elektronica', 'Boeken', 'Sieraden / Accessoires', 'Kunst', 'Overig'];

const STALE_DAYS = 60; // na hoeveel dagen 'te koop' een advertentie als 'lang te koop' geldt

const state = {
  items: [],
  filter: 'alle',
  search: '',
  sort: 'nieuw',
  category: 'alle',
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '€ ' + Number(n || 0).toFixed(2).replace('.', ',');

/* ---------- Datum-helpers ---------- */
const dateOnly = (s) => (s ? String(s).slice(0, 10) : '');
const listingDate = (i) => dateOnly(i.onlineSinds) || dateOnly(i.aangemaakt) || '';
const daysSince = (d) => {
  if (!d) return null;
  const ms = Date.now() - new Date(d + 'T00:00:00').getTime();
  return Math.floor(ms / 86400000);
};
const fmtDateNL = (s) => {
  const d = dateOnly(s);
  if (!d) return '';
  const [y, m, da] = d.split('-');
  return `${da}-${m}-${y}`;
};
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- API helper ---------- */
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (res.status === 401) { showLogin(); throw new Error('auth'); }
  if (!res.ok) throw new Error((data && data.error) || 'Er ging iets mis');
  return data;
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  $('theme-btn').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('mp_theme', theme); } catch (_) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1019' : '#ef5b46');
}
function initTheme() {
  let t;
  try { t = localStorage.getItem('mp_theme'); } catch (_) {}
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(t);
}

/* ---------- Auth flow ---------- */
function showLogin() {
  $('login').classList.remove('hidden');
  $('app').classList.add('hidden');
  setTimeout(() => $('pw').focus(), 50);
}
function showApp() {
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
}

async function checkSession() {
  try {
    const r = await api('session.php');
    if (r.authenticated) { showApp(); await loadItems(); }
    else showLogin();
  } catch (_) { showLogin(); }
}

async function doLogin(e) {
  e.preventDefault();
  const btn = $('login-btn');
  const err = $('login-err');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Bezig…';
  try {
    await api('login.php', { method: 'POST', body: JSON.stringify({ password: $('pw').value }) });
    $('pw').value = '';
    showApp();
    await loadItems();
  } catch (ex) {
    err.textContent = ex.message === 'auth' ? 'Onjuist wachtwoord' : ex.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Inloggen';
  }
}

async function doLogout() {
  try { await api('logout.php', { method: 'POST' }); } catch (_) {}
  state.items = [];
  closeSheet('settings-overlay');
  showLogin();
}

/* ---------- Data laden ---------- */
async function loadItems() {
  $('items-list').innerHTML = '<div class="spinner"></div>';
  try {
    const r = await api('items.php');
    state.items = r.items || [];
    renderList();
    renderStats();
  } catch (ex) {
    if (ex.message !== 'auth') {
      $('items-list').innerHTML = `<div class="empty"><div class="ico">⚠️</div><p>${esc(ex.message)}</p></div>`;
    }
  }
}

/* ---------- Navigatie ---------- */
function switchView(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'list') renderList();
  if (view === 'stats') renderStats();
}

/* ---------- Categorie-selects vullen ---------- */
function fillCategories() {
  const opts = '<option value="">— kies categorie —</option>' +
    CATEGORIES.map((c) => `<option>${c}</option>`).join('');
  $('categorie').innerHTML = opts;
  $('edit-categorie').innerHTML = opts;
  $('cat-filter').innerHTML = '<option value="alle">Alle categorieën</option>' +
    CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
}

/* ---------- Winst-preview ---------- */
function updateProfit() {
  const inc = parseFloat($('prijs-in').value) || 0;
  const uit = parseFloat($('prijs-uit').value) || 0;
  const p = $('profit');
  if (!inc && !uit) { p.classList.remove('show'); return; }
  p.classList.add('show');
  const diff = uit - inc;
  $('profit-amt').textContent = fmt(diff);
  $('profit-lbl').textContent = diff >= 0 ? 'Winst' : 'Verlies';
  p.classList.toggle('loss', diff < 0);
}

/* ---------- Item opslaan ---------- */
async function saveItem() {
  const naam = $('naam').value.trim();
  if (!naam) { toast('Vul eerst een artikelnaam in'); return; }
  const btn = $('save-btn');
  btn.disabled = true;
  const payload = {
    naam,
    categorie: $('categorie').value,
    winkel: $('winkel').value.trim(),
    datumInkoop: $('datum-inkoop').value,
    prijsIn: parseFloat($('prijs-in').value) || 0,
    prijsUit: parseFloat($('prijs-uit').value) || 0,
    status: $('status').value,
    datumVerkoop: $('datum-verkoop').value,
    notitie: $('notitie').value.trim(),
    advertentieUrl: $('link').value.trim(),
  };
  try {
    const r = await api('items.php', { method: 'POST', body: JSON.stringify(payload) });
    state.items.unshift(r.item);
    toast('✓ ' + naam + ' opgeslagen');
    resetForm();
    renderStats();
    switchView('list');
  } catch (ex) {
    toast(ex.message);
  } finally {
    btn.disabled = false;
  }
}

function resetForm() {
  ['naam', 'winkel', 'notitie', 'prijs-in', 'prijs-uit', 'datum-verkoop', 'link'].forEach((id) => ($(id).value = ''));
  $('categorie').value = '';
  $('status').value = 'te-koop';
  $('profit').classList.remove('show');
  $('datum-inkoop').value = new Date().toISOString().slice(0, 10);
}

/* ---------- Lijst renderen ---------- */
const itemDate = (i) => i.datumVerkoop || i.datumInkoop || '';
const idNum = (id) => { const m = String(id).match(/(\d+)/); return m ? parseInt(m[1], 10) : 0; };

function sortComparator(a, b) {
  switch (state.sort) {
    case 'oud': {
      const da = itemDate(a) || '0000-00-00';
      const db = itemDate(b) || '0000-00-00';
      if (da !== db) return da.localeCompare(db);
      return idNum(a.id) - idNum(b.id);
    }
    case 'prijs-hoog': return (b.prijsUit || 0) - (a.prijsUit || 0);
    case 'prijs-laag': return (a.prijsUit || 0) - (b.prijsUit || 0);
    case 'winst':
      return ((b.prijsUit || 0) - (b.prijsIn || 0)) - ((a.prijsUit || 0) - (a.prijsIn || 0));
    case 'langst': {
      const la = listingDate(a) || '9999-99-99';
      const lb = listingDate(b) || '9999-99-99';
      if (la !== lb) return la.localeCompare(lb);
      return idNum(a.id) - idNum(b.id);
    }
    case 'nieuw':
    default: {
      const da = itemDate(a) || '9999-99-99';
      const db = itemDate(b) || '9999-99-99';
      if (da !== db) return db.localeCompare(da);
      return idNum(a.id) - idNum(b.id);
    }
  }
}

function renderList() {
  const list = $('items-list');
  const q = state.search;

  let items = state.filter === 'alle'
    ? state.items.slice()
    : state.items.filter((i) => i.status === state.filter);

  if (state.category !== 'alle') {
    items = items.filter((i) => (i.categorie || 'Overig') === state.category);
  }

  if (q) {
    items = items.filter((i) =>
      [i.naam, i.categorie, i.winkel, i.notitie].some((v) => (v || '').toLowerCase().includes(q)));
  }

  items.sort(sortComparator);

  $('list-count').textContent = items.length
    ? `${items.length} ${items.length === 1 ? 'artikel' : 'artikelen'}${q ? ' gevonden' : ''}`
    : '';

  if (!items.length) {
    list.innerHTML = q
      ? `<div class="empty"><div class="ico">🔍</div><p>Geen resultaten voor “${esc(q)}”</p></div>`
      : `<div class="empty"><div class="ico">📭</div><p>Nog geen artikelen hier</p></div>`;
    return;
  }

  const label = { verkocht: 'Verkocht', 'te-koop': 'Te koop', gereserveerd: 'Gereserveerd' };

  list.innerHTML = items.map((item) => {
    const verkocht = item.status === 'verkocht';
    const winst = (item.prijsUit || 0) - (item.prijsIn || 0);

    const meta = [];
    if (item.categorie) meta.push(`<span>📂 ${esc(item.categorie)}</span>`);
    if (item.winkel) meta.push(`<span>📍 ${esc(item.winkel)}</span>`);
    if (item.onlineSinds) meta.push(`<span>🗓️ online sinds ${fmtDateNL(item.onlineSinds)}</span>`);
    else if (item.datumInkoop) meta.push(`<span>🗓️ ${esc(item.datumInkoop)}</span>`);
    if (item.weergaven != null) meta.push(`<span>👁 ${item.weergaven}</span>`);
    if (item.bewaard != null) meta.push(`<span>❤ ${item.bewaard}</span>`);

    let staleHtml = '';
    if (item.status === 'te-koop') {
      const d = daysSince(listingDate(item));
      if (d != null && d > STALE_DAYS) staleHtml = `<span class="stale-badge">⏳ ${d} dagen te koop</span>`;
    }

    const banner = item.vermoedelijkVerkocht
      ? `<div class="sold-banner">Staat niet meer op Marktplaats — verkocht? <button class="link-btn" onclick="event.stopPropagation(); openSold('${item.id}')">Markeer verkocht</button></div>`
      : '';

    let footLeft, footRight;
    if (verkocht) {
      footLeft = `In: <strong class="tnum">${fmt(item.prijsIn)}</strong> · Uit: <strong class="tnum">${fmt(item.prijsUit)}</strong>`;
      footRight = `<span class="winst ${winst >= 0 ? 'pos' : 'neg'} tnum">${winst >= 0 ? '+' : ''}${fmt(winst)}</span>`;
    } else if (item.prijsUit) {
      footLeft = 'Vraagprijs';
      footRight = `<span class="winst tnum" style="color:var(--text)">${fmt(item.prijsUit)}</span>`;
    } else {
      footLeft = 'Prijs';
      footRight = `<span class="price-line">Bieden</span>`;
    }

    const fotoHtml = item.fotoUrl
      ? `<img class="item-foto" src="${esc(item.fotoUrl)}" loading="lazy" alt="" onerror="this.style.display='none'">`
      : '';

    return `<div class="item ${item.status}${item.vermoedelijkVerkocht ? ' flagged' : ''}" onclick="openActions('${item.id}')" role="button" tabindex="0">
      <div class="item-head">
        ${fotoHtml}
        <div class="item-headtext">
          <div class="item-top">
            <div class="item-name">${esc(item.naam)}</div>
            <span class="badge ${item.status}">${label[item.status] || esc(item.status)}</span>
          </div>
          ${staleHtml}
          ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
        </div>
      </div>
      ${item.notitie ? `<div class="item-note">${esc(item.notitie)}</div>` : ''}
      ${banner}
      <div class="item-foot">
        <div>
          <div class="price-line">${footLeft}</div>
          ${footRight}
        </div>
        <span class="item-chevron" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>
    </div>`;
  }).join('');
}

function setSort(v) { state.sort = v; renderList(); }
function setCategory(v) { state.category = v; renderList(); }

function setFilter(f, btn) {
  state.filter = f;
  document.querySelectorAll('.chip').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

/* ---------- Bewerken ---------- */
function editItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  $('edit-id').value = id;
  $('edit-naam').value = item.naam;
  $('edit-categorie').value = item.categorie || '';
  $('edit-winkel').value = item.winkel || '';
  $('edit-datum-inkoop').value = item.datumInkoop || '';
  $('edit-prijs-in').value = item.prijsIn || '';
  $('edit-prijs-uit').value = item.prijsUit || '';
  $('edit-status').value = item.status;
  $('edit-datum-verkoop').value = item.datumVerkoop || '';
  $('edit-notitie').value = item.notitie || '';
  $('edit-link').value = item.advertentieUrl || '';
  $('edit-foto').value = item.fotoUrl || '';
  openSheet('edit-overlay');
}

async function saveEdit() {
  const id = $('edit-id').value;
  const naam = $('edit-naam').value.trim();
  if (!naam) { toast('Vul eerst een artikelnaam in'); return; }
  const btn = $('edit-save');
  btn.disabled = true;
  const base = state.items.find((i) => i.id === id) || {};
  const payload = {
    ...base, // behoud mpId, onlineSinds, weergaven, bewaard, vermoedelijkVerkocht
    naam,
    categorie: $('edit-categorie').value,
    winkel: $('edit-winkel').value.trim(),
    datumInkoop: $('edit-datum-inkoop').value,
    prijsIn: parseFloat($('edit-prijs-in').value) || 0,
    prijsUit: parseFloat($('edit-prijs-uit').value) || 0,
    status: $('edit-status').value,
    datumVerkoop: $('edit-datum-verkoop').value,
    notitie: $('edit-notitie').value.trim(),
    advertentieUrl: $('edit-link').value.trim(),
    fotoUrl: $('edit-foto').value.trim(),
  };
  try {
    const r = await api('items.php?id=' + encodeURIComponent(id), {
      method: 'PUT', body: JSON.stringify(payload),
    });
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx > -1) state.items[idx] = r.item;
    closeSheet('edit-overlay');
    toast('✓ Bijgewerkt');
    renderList();
    renderStats();
  } catch (ex) {
    toast(ex.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!confirm(`"${item ? item.naam : 'Dit artikel'}" verwijderen?`)) return;
  try {
    await api('items.php?id=' + encodeURIComponent(id), { method: 'DELETE' });
    state.items = state.items.filter((i) => i.id !== id);
    renderList();
    renderStats();
    toast('Verwijderd');
  } catch (ex) {
    toast(ex.message);
  }
}

/* ---------- Actiemenu (tik op kaart) ---------- */
let actionsId = null;
function openActions(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  actionsId = id;
  $('actions-naam').textContent = item.naam;
  $('act-sold').classList.toggle('hidden', item.status === 'verkocht');
  $('act-link').classList.toggle('hidden', !item.advertentieUrl);
  openSheet('actions-overlay');
}

/* ---------- Snel verkocht ---------- */
function openSold(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  $('sold-id').value = id;
  $('sold-naam').textContent = item.naam;
  $('sold-prijs').value = item.prijsUit || '';
  $('sold-datum').value = today();
  openSheet('sold-overlay');
  setTimeout(() => $('sold-prijs').focus(), 60);
}

async function saveSold() {
  const id = $('sold-id').value;
  const base = state.items.find((i) => i.id === id);
  if (!base) return;
  const btn = $('sold-save');
  btn.disabled = true;
  const payload = {
    ...base,
    status: 'verkocht',
    prijsUit: parseFloat($('sold-prijs').value) || 0,
    datumVerkoop: $('sold-datum').value || today(),
    vermoedelijkVerkocht: false,
  };
  try {
    const r = await api('items.php?id=' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(payload) });
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx > -1) state.items[idx] = r.item;
    closeSheet('sold-overlay');
    toast('✓ Verkocht: ' + base.naam);
    renderList();
    renderStats();
  } catch (ex) {
    toast(ex.message);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Advertentietekst-generator ---------- */
function buildAdText(item) {
  const lines = [];
  lines.push(item.naam);
  lines.push('');
  if (item.notitie) { lines.push(item.notitie); lines.push(''); }
  lines.push(item.prijsUit ? `Vraagprijs: ${fmt(item.prijsUit)}` : 'Prijs: bieden');
  if (item.categorie) lines.push(`Categorie: ${item.categorie}`);
  lines.push('');
  lines.push('Ophalen of verzenden mogelijk. Bekijk ook mijn andere advertenties!');
  return lines.join('\n');
}

function openAdText(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  $('adtext-content').value = buildAdText(item);
  openSheet('adtext-overlay');
}

function copyAdText() {
  const text = $('adtext-content').value;
  const done = () => toast('✓ Tekst gekopieerd');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => {
      $('adtext-content').select(); document.execCommand('copy'); done();
    });
  } else {
    $('adtext-content').select(); document.execCommand('copy'); done();
  }
}

/* ---------- Statistieken ---------- */
function renderStats() {
  const items = state.items;
  const verkocht = items.filter((i) => i.status === 'verkocht');
  const totaalIn = items.reduce((s, i) => s + (i.prijsIn || 0), 0);
  const omzet = verkocht.reduce((s, i) => s + (i.prijsUit || 0), 0);
  const inkoopVerkocht = verkocht.reduce((s, i) => s + (i.prijsIn || 0), 0);
  const winst = omzet - inkoopVerkocht;
  const voorraad = items.filter((i) => i.status !== 'verkocht').reduce((s, i) => s + (i.prijsIn || 0), 0);

  $('s-totaal').textContent = items.length;
  $('s-verkocht').textContent = verkocht.length;
  $('s-inkoop').textContent = fmt(totaalIn);
  $('s-omzet').textContent = fmt(omzet);
  $('s-voorraad').textContent = fmt(voorraad);
  $('s-winst').textContent = (winst >= 0 ? '+' : '') + fmt(winst);
  $('s-winst-sub').textContent = `${verkocht.length} verkocht · ${fmt(omzet)} omzet`;

  // --- extra statistieken ---
  const aantalV = verkocht.length;
  $('s-gem-prijs').textContent = fmt(aantalV ? omzet / aantalV : 0);
  $('s-gem-marge').textContent = fmt(aantalV ? winst / aantalV : 0);

  const teKoop = items.filter((i) => i.status === 'te-koop');
  $('s-aanbod').textContent = fmt(teKoop.reduce((s, i) => s + (i.prijsUit || 0), 0));
  const staleCount = teKoop.filter((i) => {
    const d = daysSince(listingDate(i));
    return d != null && d > STALE_DAYS;
  }).length;
  $('s-stale').textContent = staleCount;

  const looptijden = verkocht.map((i) => {
    const l = listingDate(i);
    const v = dateOnly(i.datumVerkoop);
    if (!l || !v || l > v) return null;
    return Math.round((new Date(v + 'T00:00:00') - new Date(l + 'T00:00:00')) / 86400000);
  }).filter((d) => d != null);
  const gemLooptijd = looptijden.length ? Math.round(looptijden.reduce((a, b) => a + b, 0) / looptijden.length) : null;
  $('s-doorlooptijd').textContent = gemLooptijd != null ? gemLooptijd + ' dagen' : 'n.v.t.';

  const catOmzet = {};
  verkocht.forEach((i) => { const c = i.categorie || 'Overig'; catOmzet[c] = (catOmzet[c] || 0) + (i.prijsUit || 0); });
  const beste = Object.entries(catOmzet).sort((a, b) => b[1] - a[1])[0];
  $('s-beste-cat').textContent = beste ? beste[0] : '—';
  $('s-beste-cat-sub').textContent = beste ? fmt(beste[1]) + ' omzet' : '';

  renderGoal();
  renderJaar();
  renderMaand();
  renderCategorie();
}

/* ---------- Maanddoel ---------- */
function getGoal() {
  let g = 0;
  try { g = parseFloat(localStorage.getItem('mp_goal')); } catch (_) {}
  return g > 0 ? g : 0;
}

function renderGoal() {
  const wrap = $('goalbar-wrap');
  if (!wrap) return;
  const goal = getGoal();
  if (!goal) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const maand = new Date().toISOString().slice(0, 7);
  const omzet = state.items
    .filter((i) => i.status === 'verkocht' && dateOnly(i.datumVerkoop).slice(0, 7) === maand)
    .reduce((s, i) => s + (i.prijsUit || 0), 0);
  const pct = Math.min(100, Math.round((omzet / goal) * 100));
  const rest = Math.max(0, goal - omzet);
  $('goalbar-fill').style.width = pct + '%';
  $('goal-label').textContent = `${fmt(omzet)} van ${fmt(goal)} · ${pct}%`;
  $('goal-sub').textContent = rest > 0 ? `nog ${fmt(rest)} te gaan` : '🎉 doel gehaald!';
}

function renderJaar() {
  const el = $('per-jaar');
  if (!el) return;
  const g = groupBy(state.items.filter((i) => i.status === 'verkocht'), (i) => {
    const d = i.datumVerkoop;
    return d ? d.slice(0, 4) : null;
  });
  const keys = Object.keys(g).sort((a, b) => b.localeCompare(a));
  if (!keys.length) { el.innerHTML = `<p style="color:var(--muted);padding:14px 0;font-size:0.85rem">Nog geen data</p>`; return; }
  el.innerHTML = keys.map((jaar) => {
    const its = g[jaar];
    const omzet = its.reduce((s, i) => s + (i.prijsUit || 0), 0);
    const winst = its.reduce((s, i) => s + ((i.prijsUit || 0) - (i.prijsIn || 0)), 0);
    return `<div class="jaar-row">
      <div><span class="jaar-label">${jaar}</span> <span class="acc-sub">${its.length} verkocht</span></div>
      <div style="text-align:right">
        <div class="tnum" style="font-weight:700">${fmt(omzet)}</div>
        <div class="winst ${winst >= 0 ? 'pos' : 'neg'} tnum" style="font-size:0.8rem">${winst >= 0 ? '+' : ''}${fmt(winst)} winst</div>
      </div>
    </div>`;
  }).join('');
}

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function groupBy(items, keyFn) {
  const g = {};
  items.forEach((i) => {
    const k = keyFn(i);
    if (k == null) return;
    (g[k] = g[k] || []).push(i);
  });
  return g;
}

function accordion(id, title, sub, bodyHtml, accent) {
  return `<div class="acc">
    <div class="acc-head" onclick="toggleAcc('${id}', this)">
      <div>
        <div class="acc-title">${title}</div>
        <div class="acc-sub">${sub}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="winst ${accent >= 0 ? 'pos' : 'neg'} tnum" style="font-size:0.95rem">${accent >= 0 ? '+' : ''}${fmt(accent)}</span>
        <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
    <div class="acc-body" id="${id}">${bodyHtml}</div>
  </div>`;
}

function toggleAcc(id, head) {
  const body = $(id);
  const arrow = head.querySelector('.arrow');
  const open = body.classList.toggle('open');
  if (arrow) arrow.classList.toggle('open', open);
}

function renderMaand() {
  const el = $('per-maand');
  const g = groupBy(state.items, (i) => {
    const d = i.datumVerkoop || i.datumInkoop;
    return d ? d.slice(0, 7) : null;
  });
  const keys = Object.keys(g).sort((a, b) => b.localeCompare(a));
  if (!keys.length) { el.innerHTML = `<p style="color:var(--muted);padding:14px 0;font-size:0.85rem">Nog geen data</p>`; return; }

  el.innerHTML = keys.map((key, idx) => {
    const its = g[key];
    const [jaar, m] = key.split('-');
    const omzet = its.reduce((s, i) => s + (i.prijsUit || 0), 0);
    const inkoop = its.reduce((s, i) => s + (i.prijsIn || 0), 0);
    const winst = omzet - inkoop;
    const rows = its.map((i) => `<div class="acc-row"><span class="nm">${esc(i.naam)}</span><span class="tnum">${i.prijsUit ? fmt((i.prijsUit || 0) - (i.prijsIn || 0)) : '—'}</span></div>`).join('');
    return accordion('m-' + idx, `${MAAND[parseInt(m, 10) - 1]} ${jaar}`, `${its.length} artikelen · omzet ${fmt(omzet)}`, rows, winst);
  }).join('');
}

function renderCategorie() {
  const el = $('per-categorie');
  const g = groupBy(state.items, (i) => i.categorie || 'Overig');
  const keys = Object.keys(g).sort((a, b) => {
    const w = (k) => g[k].reduce((s, i) => s + ((i.prijsUit || 0) - (i.prijsIn || 0)), 0);
    return w(b) - w(a);
  });
  if (!keys.length) { el.innerHTML = `<p style="color:var(--muted);padding:14px 0;font-size:0.85rem">Nog geen data</p>`; return; }

  el.innerHTML = keys.map((cat, idx) => {
    const its = g[cat];
    const winst = its.reduce((s, i) => s + ((i.prijsUit || 0) - (i.prijsIn || 0)), 0);
    const verkocht = its.filter((i) => i.status === 'verkocht').length;
    const rows = its.map((i) => `<div class="acc-row"><span class="nm">${esc(i.naam)}</span><span class="tnum">${i.prijsUit ? fmt((i.prijsUit || 0) - (i.prijsIn || 0)) : '—'}</span></div>`).join('');
    return accordion('c-' + idx, esc(cat), `${its.length} artikelen · ${verkocht} verkocht`, rows, winst);
  }).join('');
}

/* ---------- Sheets ---------- */
function openSheet(id) { $(id).classList.add('open'); }
function closeSheet(id) { $(id).classList.remove('open'); }

/* ---------- Export / import / migratie ---------- */
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON() {
  if (!state.items.length) { toast('Geen data om te exporteren'); return; }
  download('marktplaats_backup_' + new Date().toISOString().slice(0, 10) + '.json',
    JSON.stringify(state.items, null, 2), 'application/json');
  toast('Backup gedownload');
}

function exportCSV() {
  if (!state.items.length) { toast('Geen data om te exporteren'); return; }
  const header = ['Naam', 'Categorie', 'Winkel', 'Datum inkoop', 'Inkoopprijs', 'Verkoopprijs', 'Winst', 'Status', 'Datum verkoop', 'Notitie'];
  const rows = state.items.map((i) => [
    i.naam, i.categorie, i.winkel, i.datumInkoop,
    Number(i.prijsIn || 0).toFixed(2), i.prijsUit ? Number(i.prijsUit).toFixed(2) : '',
    i.prijsUit ? ((i.prijsUit || 0) - (i.prijsIn || 0)).toFixed(2) : '',
    i.status, i.datumVerkoop, i.notitie,
  ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  download('marktplaats_' + new Date().toISOString().slice(0, 10) + '.csv',
    '﻿' + [header.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  toast('CSV gedownload');
}

async function bulkImport(arr, bron) {
  if (!Array.isArray(arr) || !arr.length) { toast('Geen artikelen gevonden'); return; }
  if (!confirm(`${arr.length} artikelen uit ${bron} overzetten naar de database?`)) return;
  try {
    const r = await api('items.php', { method: 'POST', body: JSON.stringify({ items: arr }) });
    toast(`✓ ${r.imported} artikelen overgezet`);
    await loadItems();
  } catch (ex) {
    toast(ex.message);
  }
}

function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      bulkImport(data, 'het backup-bestand');
    } catch (err) {
      toast('Ongeldig bestand');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function migrateLocal() {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem('mp_items') || '[]'); } catch (_) {}
  if (!arr.length) {
    toast('Geen oude browser-data gevonden');
    return;
  }
  bulkImport(arr, 'je oude browser-opslag');
}

/* ---------- Marktplaats-sync ---------- */
async function syncMarktplaats() {
  const btn = $('mp-sync-btn');
  if (!confirm('Je actuele Marktplaats-aanbod ophalen en de tracker bijwerken?')) return;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Bezig met synchroniseren…';
  try {
    const r = await api('mp_sync.php', { method: 'POST' });
    closeSheet('settings-overlay');
    toast(`✓ ${r.gevonden} ads · ${r.toegevoegd} nieuw · ${r.prijs_bijgewerkt} prijs · ${r.vermoedelijk_verkocht} verkocht?`);
    await loadItems();
  } catch (ex) {
    toast(ex.message === 'auth' ? 'Niet ingelogd' : ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

/* ---------- Init ---------- */
function init() {
  initTheme();
  fillCategories();
  $('datum-inkoop').value = new Date().toISOString().slice(0, 10);

  // login
  $('login-form').addEventListener('submit', doLogin);

  // topbar
  $('theme-btn').addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  $('settings-btn').addEventListener('click', () => openSheet('settings-overlay'));

  // nav
  document.querySelectorAll('.nav-btn').forEach((b) =>
    b.addEventListener('click', () => switchView(b.dataset.view)));

  // form
  $('prijs-in').addEventListener('input', updateProfit);
  $('prijs-uit').addEventListener('input', updateProfit);
  $('save-btn').addEventListener('click', saveItem);

  // filters
  document.querySelectorAll('.chip').forEach((b) =>
    b.addEventListener('click', () => setFilter(b.dataset.f, b)));

  // zoeken
  const searchEl = $('search');
  searchEl.addEventListener('input', () => {
    state.search = searchEl.value.trim().toLowerCase();
    $('search-clear').classList.toggle('hidden', !searchEl.value);
    renderList();
  });
  $('search-clear').addEventListener('click', () => {
    searchEl.value = '';
    state.search = '';
    $('search-clear').classList.add('hidden');
    renderList();
    searchEl.focus();
  });

  // sorteren & categoriefilter
  $('sort').addEventListener('change', () => setSort($('sort').value));
  $('cat-filter').addEventListener('change', () => setCategory($('cat-filter').value));

  // actiemenu
  $('act-edit').addEventListener('click', () => { closeSheet('actions-overlay'); editItem(actionsId); });
  $('act-sold').addEventListener('click', () => { closeSheet('actions-overlay'); openSold(actionsId); });
  $('act-link').addEventListener('click', () => {
    const it = state.items.find((i) => i.id === actionsId);
    if (it && it.advertentieUrl) window.open(it.advertentieUrl, '_blank', 'noopener');
  });
  $('act-adtext').addEventListener('click', () => { closeSheet('actions-overlay'); openAdText(actionsId); });
  $('act-delete').addEventListener('click', () => { closeSheet('actions-overlay'); deleteItem(actionsId); });

  // edit
  $('edit-save').addEventListener('click', saveEdit);

  // snel verkocht & advertentietekst
  $('sold-save').addEventListener('click', saveSold);
  $('adtext-copy').addEventListener('click', copyAdText);

  // settings actions
  $('export-json').addEventListener('click', exportJSON);
  $('export-csv').addEventListener('click', exportCSV);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', function () { importFile(this); });
  $('migrate-btn').addEventListener('click', migrateLocal);
  $('mp-sync-btn').addEventListener('click', syncMarktplaats);
  $('logout-btn').addEventListener('click', doLogout);

  // maanddoel
  const goalInput = $('goal-input');
  try { goalInput.value = localStorage.getItem('mp_goal') || ''; } catch (_) {}
  goalInput.addEventListener('input', () => {
    try { localStorage.setItem('mp_goal', goalInput.value); } catch (_) {}
    renderGoal();
  });

  // close sheets
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => closeSheet(b.dataset.close)));
  document.querySelectorAll('.overlay').forEach((o) =>
    o.addEventListener('click', (e) => { if (e.target === o) closeSheet(o.id); }));

  // default view = overzicht
  switchView('list');
  checkSession();
}

document.addEventListener('DOMContentLoaded', init);
