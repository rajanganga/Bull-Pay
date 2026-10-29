/* ============================================================
   BullPay Frontend — matches server.js exactly
   ============================================================ */

const API = {
  token: localStorage.getItem('bp_token') || '',

  async req(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['x-token'] = this.token;
    const res = await fetch('/api/' + path, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.e || 'Request failed');
    return data;
  },

  login: (u, p) => API.req('login', { u, p }),
  me: () => API.req('me', {}),
  addBank: (b) => API.req('bank/add', b),
  delBank: (id) => API.req('bank/del', { id }),
  createOrder: (o) => API.req('order', o),
};

/* ---------- State ---------- */
const state = {
  slots: [],
  settings: {},
  banks: [],
  orders: [],
  selectedSlot: null,
};

/* ---------- Helpers ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function escape(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- Views ---------- */
function showLogin() {
  $('#loadingScreen').classList.add('hidden');
  $('#loginScreen').classList.remove('hidden');
  $('#mainApp').classList.add('hidden');
}

function showMain() {
  $('#loadingScreen').classList.add('hidden');
  $('#loginScreen').classList.add('hidden');
  $('#mainApp').classList.remove('hidden');
}

/* ---------- Login ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Authenticating...';
  try {
    const { t } = await API.login(form.u.value.trim(), form.p.value);
    API.token = t;
    localStorage.setItem('bp_token', t);
    toast('✅ Login successful');
    await loadData();
  } catch (err) {
    toast('❌ ' + err.message, 'err');
    btn.disabled = false; btn.textContent = 'Login →';
  }
});

/* ---------- Load user data ---------- */
async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || [];
    state.settings = d.settings || {};
    state.banks = d.banks || [];
    state.orders = d.orders || [];
    if (state.selectedSlot === null && state.slots.length) {
      state.selectedSlot = state.slots[0];
    }
    showMain();
    renderAll();
  } catch (err) {
    API.token = '';
    localStorage.removeItem('bp_token');
    showLogin();
    if (err.message !== 'Login karein') toast('❌ ' + err.message, 'err');
  }
}

/* ---------- Render all ---------- */
function renderAll() {
  renderBalance();
  renderSlots();
  renderPaymentAddress();
  renderBanks();
  renderBankSelect();
  renderOrders();
}

function renderBalance() {
  const total = state.orders
    .filter(o => o.status === 'approved')
    .reduce((s, o) => s + Number(o.slot || 0), 0);
  $('#totalDeposits').textContent = money(total);
  $('#orderCount').textContent = state.orders.length;
  $('#approvedCount').textContent = state.orders.filter(o => o.status === 'approved').length;
  $('#pendingCount').textContent = state.orders.filter(o => o.status === 'pending').length;
}

function renderSlots() {
  const grid = $('#slotGrid');
  grid.innerHTML = state.slots.map(s =>
    `<div class="slot ${state.selectedSlot === s ? 'selected' : ''}" data-slot="${s}">₹${s}</div>`
  ).join('');
  grid.querySelectorAll('.slot').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedSlot = Number(el.dataset.slot);
      renderSlots();
    });
  });
}

function renderPaymentAddress() {
  $('#payNetwork').textContent = state.settings.network || 'TRC20';
  $('#payAddress').textContent = state.settings.address ||
