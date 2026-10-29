const API = {
  token: localStorage.getItem('bp_token') || '',
  async req(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['x-token'] = this.token;
    const res = await fetch('/api/' + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
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

const state = { slots: [], settings: {}, banks: [], orders: [], selectedSlot: null };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('#toastWrap').appendChild(el); setTimeout(() => el.remove(), 3500);
}
function money(n) { return Number(n || 0).toLocaleString('en-US'); } // US Format for $
function escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function showLogin() { $('#loadingScreen').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); $('#mainApp').classList.add('hidden'); }
function showMain() { $('#loadingScreen').classList.add('hidden'); $('#loginScreen').classList.add('hidden'); $('#mainApp').classList.remove('hidden'); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Authenticating...';
  try {
    const { t } = await API.login(e.target.u.value.trim(), e.target.p.value);
    API.token = t; localStorage.setItem('bp_token', t);
    toast('✅ Login successful'); await loadData();
  } catch (err) {
    toast('❌ ' + err.message, 'err'); btn.disabled = false; btn.textContent = 'Login →';
  }
});

async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || []; state.settings = d.settings || {};
    state.banks = d.banks || []; state.orders = d.orders || [];
    if (state.selectedSlot === null && state.slots.length) state.selectedSlot = state.slots[0];
    showMain(); renderAll();
  } catch (err) {
    API.token = ''; localStorage.removeItem('bp_token'); showLogin();
    if (err.message !== 'Login karein') toast('❌ ' + err.message, 'err');
  }
}

function renderAll() {
  renderBalance(); renderSlots(); renderPaymentAddress(); renderBanks(); renderBankSelect(); renderOrders(); drawChart();
}

function renderBalance() {
  const total = state.orders.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.slot || 0), 0);
  $('#totalDeposits').textContent = money(total);
  $('#orderCount').textContent = state.orders.length;
  $('#approvedCount').textContent = state.orders.filter(o => o.status === 'approved').length;
  $('#pendingCount').textContent = state.orders.filter(o => o.status === 'pending').length;
}

// Custom Mini Graph logic using Canvas
function drawChart() {
  const canvas = $('#walletChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height = 120;
  ctx.clearRect(0, 0, w, h);

  const data = state.orders.slice(0, 7).reverse();
  if (data.length < 2) {
    ctx.fillStyle = 'rgba(181,255,74,0.5)'; ctx.font = '14px Inter'; ctx.textAlign = 'center';
    ctx.fillText('Not enough data for graph', w/2, h/2);
    return;
  }

  const max = Math.max(...data.map(o => o.slot), 100);
  const stepX = w / (data.length - 1);
  
  ctx.beginPath();
  ctx.moveTo(0, h - (data[0].slot / max) * (h - 20));
  for (let i = 1; i < data.length; i++) {
    ctx.lineTo(i * stepX, h - (data[i].slot / max) * (h - 20));
  }
  ctx.strokeStyle = '#B5FF4A'; ctx.lineWidth = 2; ctx.stroke();

  // Fill under line
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(181, 255, 74, 0.2)');
  grad.addColorStop(1, 'rgba(181, 255, 74, 0)');
  ctx.fillStyle = grad; ctx.fill();
}

function renderSlots() {
  const grid = $('#slotGrid');
  grid.innerHTML = state.slots.map(s => `<div class="slot ${state.selectedSlot === s ? 'selected' : ''}" data-slot="${s}">$${s}</div>`).join('');
  grid.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => { state.selectedSlot = Number(el.dataset.slot); renderSlots(); }));
}

function renderPaymentAddress() {
  $('#payNetwork').textContent = state.settings.network || 'TRC20';
  $('#payAddress').textContent = state.settings.address || 'Address not set by admin';
}
$('#copyAddrBtn').addEventListener('click', () => {
  const addr = state.settings.address || '';
  if (!addr) return toast('Address not set', 'err');
  navigator.clipboard.writeText(addr).then(() => toast('✅ Address copied'));
});

function renderBanks() {
  const list = $('#banksList');
  if (!state.banks.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No banks added yet</p>'; return; }
  list.innerHTML = state.banks.map(b => `
    <div class="list-item">
      <div class="info"><strong>${escape(b.bank)} • ${escape(b.type)}</strong><small>A/C ${escape(b.number)} • IFSC ${escape(b.ifsc)}</small></div>
      <button class="btn btn-danger btn-sm" data-del-bank="${b.id}">Delete</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-del-bank]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this bank?')) return;
    try { await API.delBank(btn.dataset.delBank); toast('✅ Bank deleted'); await loadData(); } catch (e) { toast('❌ ' + e.message, 'err'); }
  }));
}

function renderBankSelect() {
  const sel = $('#bankSelect');
  if (!state.banks.length) { sel.innerHTML = '<option value="">No banks — add one first</option>'; sel.disabled = true; }
  else {
    sel.disabled = false;
    sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${escape(b.bank)} — A/C ${escape(b.number)}</option>`).join('');
  }
}

function renderOrders() {
  const list = $('#ordersList');
  if (!state.orders.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No orders yet</p>'; return; }
  list.innerHTML = state.orders.map(o => `
    <div class="list-item">
      <div class="info">
        <strong>$${money(o.slot)} — ${escape(o.status)}</strong>
        <small>TXN: ${escape(o.txid)} • ${new Date(o.ts).toLocaleString()}</small>
      </div>
      <span class="badge badge-${o.status}">${o.status}</span>
    </div>
  `).join('');
}

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  $$('.tab-content').forEach(c => c.classList.add('hidden'));
  $('#tab-' + tab.dataset.tab).classList.remove('hidden');
}));

// Order Form with Image Upload logic
$('#orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  if (state.selectedSlot === null) return toast('Select an amount first', 'err');
  if (!form.bankId.value) return toast('Add a bank first', 'err');
  
  const file = form.receipt.files[0];
  if (!file) return toast('Please upload a payment screenshot', 'err');
  if (file.size > 2.5 * 1024 * 1024) return toast('Image too large (Max 2MB)', 'err');

  btn.disabled = true; btn.textContent = 'Uploading...';

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      await API.createOrder({
        bankId: form.bankId.value,
        slot: state.selectedSlot,
        txid: form.txid.value.trim(),
        receipt: event.target.result // base64 string
      });
      toast('✅ Order submitted — awaiting approval');
      form.reset(); await loadData();
    } catch (err) {
      toast('❌ ' + err.message, 'err');
    }
    btn.disabled = false; btn.textContent = 'Submit Order →';
  };
  reader.readAsDataURL(file);
});

$('#addBankBtn').addEventListener('click', () => $('#addBankForm').classList.toggle('hidden'));
$('#cancelBankBtn').addEventListener('click', () => $('#addBankForm').classList.add('hidden'));
$('#newBankForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await API.addBank({ type: form.type.value, number: form.number.value.trim(), bank: form.bank.value.trim(), ifsc: form.ifsc.value.trim().toUpperCase() });
    toast('✅ Bank added'); form.reset(); $('#addBankForm').classList.add('hidden'); await loadData();
  } catch (err) { toast('❌ ' + err.message, 'err'); }
  btn.disabled = false; btn.textContent = 'Save Bank';
});

$('#logoutBtn').addEventListener('click', () => { localStorage.removeItem('bp_token'); API.token = ''; location.reload(); });

(function boot() { if (API.token) loadData(); else showLogin(); })();
