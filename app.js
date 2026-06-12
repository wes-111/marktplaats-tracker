/* ============================================================
   Marktplaats Tracker — frontend logica
   ============================================================ */

const API = '';
const CATEGORIES = ['Kleding', 'Meubels', 'Decoratie', 'Keuken', 'Speelgoed',
  'Elektronica', 'Boeken', 'Sieraden / Accessoires', 'Kunst', 'Overig'];

const state = {
  items: [],
  filter: 'alle',
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => '€ ' + Number(n || 0).toFixed(2).replace('.', ',');

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
  ['naam', 'winkel', 'notitie', 'prijs-in', 'prijs-uit', 'datum-verkoop'].forEach((id) => ($(id).value = ''));
  $('categorie').value = '';
  $('status').value = 'te-koop';
  $('profit').classList.remove('show');
  $('datum-inkoop').value = new Date().toISOString().slice(0, 10);
}

/* ---------- Lijst renderen ---------- */
function renderList() {
  const list = $('items-list');
  const items = state.filter === 'alle'
    ? state.items
    : state.items.filter((i) => i.status === state.filter);

  if (!items.length) {
    list.innerHTML = `<div class="empty"><div class="ico">📭</div><p>Nog geen artikelen hier</p></div>`;
    return;
  }

  const label = { verkocht: 'Verkocht', 'te-koop': 'Te koop', gereserveerd: 'Gereserveerd' };

  list.innerHTML = items.map((item) => {
    const winst = (item.prijsUit || 0) - (item.prijsIn || 0);
    const meta = [];
    if (item.categorie) meta.push(`<span>📂 ${esc(item.categorie)}</span>`);
    if (item.winkel) meta.push(`<span>📍 ${esc(item.winkel)}</span>`);
    if (item.datumInkoop) meta.push(`<span>🗓️ ${esc(item.datumInkoop)}</span>`);

    const winstHtml = item.prijsUit
      ? `<span class="winst ${winst >= 0 ? 'pos' : 'neg'} tnum">${winst >= 0 ? '+' : ''}${fmt(winst)}</span>`
      : `<span class="price-line">nog niet verkocht</span>`;

    return `<div class="item ${item.status}">
      <div class="item-top">
        <div class="item-name">${esc(item.naam)}</div>
        <span class="badge ${item.status}">${label[item.status] || esc(item.status)}</span>
      </div>
      ${meta.length ? `<div class="item-meta">${meta.join('')}</div>` : ''}
      ${item.notitie ? `<div class="item-note">${esc(item.notitie)}</div>` : ''}
      <div class="item-foot">
        <div>
          <div class="price-line">In: <strong class="tnum">${fmt(item.prijsIn)}</strong>${item.prijsUit ? ` · Uit: <strong class="tnum">${fmt(item.prijsUit)}</strong>` : ''}</div>
          ${winstHtml}
        </div>
        <div class="item-actions">
          <button class="mini-btn" onclick="editItem('${item.id}')" title="Bewerken">✏️</button>
          <button class="mini-btn del" onclick="deleteItem('${item.id}')" title="Verwijderen">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

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
  openSheet('edit-overlay');
}

async function saveEdit() {
  const id = $('edit-id').value;
  const naam = $('edit-naam').value.trim();
  if (!naam) { toast('Vul eerst een artikelnaam in'); return; }
  const btn = $('edit-save');
  btn.disabled = true;
  const payload = {
    naam,
    categorie: $('edit-categorie').value,
    winkel: $('edit-winkel').value.trim(),
    datumInkoop: $('edit-datum-inkoop').value,
    prijsIn: parseFloat($('edit-prijs-in').value) || 0,
    prijsUit: parseFloat($('edit-prijs-uit').value) || 0,
    status: $('edit-status').value,
    datumVerkoop: $('edit-datum-verkoop').value,
    notitie: $('edit-notitie').value.trim(),
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

  renderMaand();
  renderCategorie();
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

  // edit
  $('edit-save').addEventListener('click', saveEdit);

  // settings actions
  $('export-json').addEventListener('click', exportJSON);
  $('export-csv').addEventListener('click', exportCSV);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', function () { importFile(this); });
  $('migrate-btn').addEventListener('click', migrateLocal);
  $('logout-btn').addEventListener('click', doLogout);

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
