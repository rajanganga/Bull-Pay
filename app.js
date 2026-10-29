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
  readNotif: () => API.req('notif/read', {}),
};

const state = { slots: [], settings: {}, banks: [], orders: [], notifs: [], selectedSlot: null };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const INDIAN_BANKS = [
  { name: "State Bank of India (SBI)", domain: "sbi.co.in" }, { name: "HDFC Bank", domain: "hdfcbank.com" },
  { name: "ICICI Bank", domain: "icicibank.com" }, { name: "Axis Bank", domain: "axisbank.com" },
  { name: "Kotak Mahindra Bank", domain: "kotak.com" }, { name: "Punjab National Bank (PNB)", domain: "pnbindia.in" },
  { name: "Bank of Baroda", domain: "bankofbaroda.in" }, { name: "Canara Bank", domain: "canarabank.com" },
  { name: "Union Bank of India", domain: "unionbankofindia.co.in" }, { name: "IndusInd Bank", domain: "indusind.com" },
  { name: "Yes Bank", domain: "yesbank.in" }, { name: "IDFC First Bank", domain: "idfcfirstbank.com" },
  { name: "Bank of India", domain: "bankofindia.co.in" }, { name: "Central Bank of India", domain: "centralbankofindia.co.in" },
  { name: "Indian Bank", domain: "indianbank.in" }, { name: "Indian Overseas Bank", domain: "iob.in" },
  { name: "UCO Bank", domain: "ucobank.com" }, { name: "Bank of Maharashtra", domain: "bankofmaharashtra.in" },
  { name: "Punjab & Sind Bank", domain: "psbindia.com" }, { name: "Federal Bank", domain: "federalbank.co.in" },
  { name: "Other Bank", domain: "generic" }
].sort((a, b) => { if (a.name === "Other Bank") return 1; if (b.name === "Other Bank") return -1; return a.name.localeCompare(b.name); });

function getBankLogo(domain) {
  if (domain === "generic") return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjQjVGRjRBIiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTQuNDEgOC04IDh6Ii8+PC9zdmc+";
  return `https://logo.clearbit.com/${domain}`;
}

function toast(msg, type = 'ok') { const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; $('#toastWrap').appendChild(el); setTimeout(() => el.remove(), 3500); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function getRate(amount) { if (!amount) return 0; return 125 + ((amount - 500) / 100) * 2; }

function showLogin() { $('#loadingScreen').classList.add('hidden'); $('#loginScreen').classList.remove('hidden'); $('#mainApp').classList.add('hidden'); }
function showMain() { $('#loadingScreen').classList.add('hidden'); $('#loginScreen').classList.add('hidden'); $('#mainApp').classList.remove('hidden'); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Authenticating...';
  try { 
    const { t } = await API.login(e.target.u.value.trim(), e.target.p.value); 
    API.token = t; localStorage.setItem('bp_token', t); toast('✅ Login successful'); await loadData(); 
  } catch (err) { toast('❌ ' + err.message, 'err'); btn.disabled = false; btn.textContent = 'Login →'; }
});

async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || []; state.settings = d.settings || {};
    state.banks = d.banks || []; state.orders = d.orders || []; state.notifs = d.notifications || [];
    if (state.selectedSlot === null && state.slots.length) state.selectedSlot = state.slots[0];
    showMain(); renderAll();
  } catch (err) { API.token = ''; localStorage.removeItem('bp_token'); showLogin(); if (err.message !== 'Login karein') toast('❌ ' + err.message, 'err'); }
}

function renderAll() { 
  renderBalance(); renderSlots(); updateLiveRateCard(); renderPaymentAddress(); 
  renderBanks(); renderBankSelect(); renderOrders(); drawChart(); renderNotifs(); 
}

function updateLiveRateCard() {
  const amountEl = $('#liveRateAmount'); const priceEl = $('#liveRatePrice');
  if (!amountEl || !priceEl) return;
  if (state.selectedSlot === null) { amountEl.textContent = '$0'; priceEl.textContent = '₹0/USDT'; }
  else { const rate = getRate(state.selectedSlot); amountEl.textContent = `$${state.selectedSlot}`; priceEl.textContent = `₹${rate}/USDT`; }
}

function renderSlots() {
  const grid = $('#slotGrid'); if (!grid) return;
  grid.innerHTML = state.slots.map(s => {
    const rate = getRate(s); const isSelected = state.selectedSlot === s;
    return `<div class="slot ${isSelected ? 'selected' : ''}" data-slot="${s}"><span class="slot-amt">$${s}</span><span class="slot-rate">₹${rate}</span></div>`;
  }).join('');
  grid.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => {
    state.selectedSlot = Number(el.dataset.slot); renderSlots(); updateLiveRateCard();  
  }));
}

function renderBalance() {
  const total = state.orders.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.slot || 0), 0);
  $('#totalDeposits').textContent = money(total); $('#orderCount').textContent = state.orders.length;
  $('#approvedCount').textContent = state.orders.filter(o => o.status === 'approved').length;
  $('#pendingCount').textContent = state.orders.filter(o => o.status === 'pending').length;
}

function drawChart() {
  const canvas = $('#walletChart'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const w = canvas.width = canvas.offsetWidth; const h = canvas.height = 120;
  ctx.clearRect(0, 0, w, h);
  const data = state.orders.slice(0, 7).reverse();
  if (data.length < 2) { ctx.fillStyle = 'rgba(181,255,74,0.5)'; ctx.font = '14px Inter'; ctx.textAlign = 'center'; ctx.fillText('Not enough data', w/2, h/2); return; }
  const max = Math.max(...data.map(o => o.slot), 100); const stepX = w / (data.length - 1);
  ctx.beginPath(); ctx.moveTo(0, h - (data[0].slot / max) * (h - 20));
  for (let i = 1; i < data.length; i++) ctx.lineTo(i * stepX, h - (data[i].slot / max) * (h - 20));
  ctx.strokeStyle = '#B5FF4A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(181, 255, 74, 0.2)'); grad.addColorStop(1, 'rgba(181, 255, 74, 0)');
  ctx.fillStyle = grad; ctx.fill();
}

function renderPaymentAddress() { $('#payNetwork').textContent = state.settings.network || 'TRC20'; $('#payAddress').textContent = state.settings.address || 'Address not set by admin'; }
$('#copyAddrBtn').addEventListener('click', () => { const addr = state.settings.address || ''; if (!addr) return toast('Address not set', 'err'); navigator.clipboard.writeText(addr).then(() => toast('✅ Copied')); });

function renderBanks() {
  const list = $('#banksList');
  if (!state.banks.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No banks added yet</p>'; return; }
  list.innerHTML = state.banks.map(b => `
    <div class="list-item">
      <div class="info"><strong>${escape(b.bank)} • ${escape(b.type)}</strong><small>A/C ${escape(b.number)} • IFSC ${escape(b.ifsc)}</small></div>
      <div class="row"><button class="btn btn-ghost btn-sm" data-copy="${b.number}">Copy A/C</button><button class="btn btn-danger btn-sm" data-del-bank="${b.id}">Delete</button></div>
    </div>
  `).join('');
  list.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => { navigator.clipboard.writeText(btn.dataset.copy); toast('✅ A/C Copied'); }));
  list.querySelectorAll('[data-del-bank]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete?')) return;
    try { await API.delBank(btn.dataset.delBank); toast('✅ Deleted'); await loadData(); } catch (e) { toast('❌ ' + e.message, 'err'); }
  }));
}

function renderBankSelect() {
  const sel = $('#bankSelect');
  if (!state.banks.length) { sel.innerHTML = '<option value="">No banks</option>'; sel.disabled = true; }
  else { sel.disabled = false; sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${escape(b.bank)} - A/C ${escape(b.number)}</option>`).join(''); }
}

const bankSearchInput = $('#bankSearch');
const bankDropdown = $('#bankDropdown');
const selectedBankInput = $('#selectedBank');
const otherBankField = $('#otherBankField');
const otherBankInput = $('#otherBankInput');

if (bankSearchInput) {
  function renderDropdown(query) {
    const filtered = INDIAN_BANKS.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) { bankDropdown.innerHTML = '<div style="padding:10px; font-size:13px; color:var(--text-dim);">No bank found</div>'; return; }
    bankDropdown.innerHTML = filtered.map(b => `
      <div class="bank-option" data-name="${b.name}">
        <img src="${getBankLogo(b.domain)}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjY2NjIiBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAxOGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTQuNDEgOC04IDh6Ii8+PC9zdmc+'" alt="Logo">
        <span>${b.name}</span>
      </div>
    `).join('');
    bankDropdown.querySelectorAll('.bank-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const bankName = opt.dataset.name;
        bankSearchInput.value = bankName; selectedBankInput.value = bankName; bankDropdown.classList.remove('active');
        if (bankName === 'Other Bank') { otherBankField.classList.remove('hidden'); otherBankInput.required = true; otherBankInput.focus(); }
        else { otherBankField.classList.add('hidden'); otherBankInput.required = false; otherBankInput.value = ''; }
      });
    });
  }
  bankSearchInput.addEventListener('focus', () => { renderDropdown(bankSearchInput.value); bankDropdown.classList.add('active'); });
  bankSearchInput.addEventListener('input', (e) => { renderDropdown(e.target.value); bankDropdown.classList.add('active'); });
  document.addEventListener('click', (e) => { if (!bankSearchInput.contains(e.target) && !bankDropdown.contains(e.target)) bankDropdown.classList.remove('active'); });
}

$('#helpBtn').addEventListener('click', () => { $('#helpMenu').classList.toggle('active'); });

$('#orderForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
  if (state.selectedSlot === null) return toast('Select amount', 'err');
  if (!form.bankId.value) return toast('Add bank first', 'err');
  const file = form.receipt.files[0]; if (!file) return toast('Upload screenshot', 'err');
  if (file.size > 2.5 * 1024 * 1024) return toast('Image too large (Max 2MB)', 'err');
  
  btn.disabled = true; btn.textContent = 'Uploading...';
  const reader = new FileReader();
  reader.onload = async (event) => {
    try { await API.createOrder({ bankId: form.bankId.value, slot: state.selectedSlot, txid: form.txid.value.trim(), receipt: event.target.result }); toast('✅ Submitted'); form.reset(); await loadData(); } 
    catch (err) { toast('❌ ' + err.message, 'err'); }
    btn.disabled = false; btn.textContent = 'Submit Order →';
  };
  reader.readAsDataURL(file);
});

$('#addBankBtn').addEventListener('click', () => $('#addBankForm').classList.toggle('hidden'));
$('#cancelBankBtn').addEventListener('click', () => $('#addBankForm').classList.add('hidden'));
$('#newBankForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
  let finalBankName = selectedBankInput.value;
  if (finalBankName === 'Other Bank') { if (!otherBankInput.value.trim()) return toast('Please enter your bank name', 'err'); finalBankName = otherBankInput.value.trim(); } 
  else if (!finalBankName) { return toast('Please select a bank', 'err'); }

  btn.disabled = true; btn.textContent = 'Saving...';
  try { 
    await API.addBank({ type: form.type.value, number: form.number.value.trim(), bank: finalBankName, ifsc: form.ifsc.value.trim().toUpperCase() }); 
    toast('✅ Bank added'); form.reset(); selectedBankInput.value = ''; otherBankField.classList.add('hidden'); otherBankInput.value = ''; $('#addBankForm').classList.add('hidden'); await loadData(); 
  } catch (err) { toast('❌ ' + err.message, 'err'); }
  btn.disabled = false; btn.textContent = 'Save Bank';
});

$('#logoutBtn').addEventListener('click', () => { localStorage.removeItem('bp_token'); API.token = ''; location.reload(); });

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
  $$('.tab-content').forEach(c => c.classList.add('hidden')); $('#tab-' + tab.dataset.tab).classList.remove('hidden');
}));

function renderOrders() {
  const list = $('#ordersList');
  if (!state.orders.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No orders yet</p>'; return; }
  list.innerHTML = state.orders.map(o => {
    const rate = getRate(o.slot); 
    return `
    <div class="list-item" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <div class="info"><strong>$${money(o.slot)} (@ ₹${rate}) — ${escape(o.status)}</strong><small>TXN: ${escape(o.txid)}</small></div>
        <span class="badge badge-${o.status}">${o.status}</span>
      </div>
      ${o.receipt ? `<img src="${o.receipt}" style="max-height:60px; border-radius:4px; margin-top:8px;" />` : ''}
    </div>
  `}).join('');
}

function renderNotifs() {
  const unread = state.notifs.filter(n => !n.read).length;
  const badge = $('#notifBadge');
  if (unread > 0) { badge.classList.remove('hidden'); badge.textContent = unread > 9 ? '9+' : unread; } else badge.classList.add('hidden');
  $('#notifList').innerHTML = state.notifs.length ? state.notifs.map(n => `
    <div style="padding:10px 0; border-bottom:1px solid var(--border-soft); opacity:${n.read ? '0.6' : '1'};">
      <strong style="font-size:13px; display:block; color:var(--neon);">${escape(n.title)}</strong>
      <span style="font-size:12px; color:var(--text-dim);">${escape(n.msg)}</span>
    </div>
  `).join('') : '<p class="text-dim text-sm text-center" style="padding:10px;">No notifications</p>';
}
$('#notifBtn').onclick = () => { $('#notifPanel').classList.toggle('hidden'); if (!state.notifs.every(n => n.read)) { API.readNotif(); setTimeout(() => loadData(), 500); } };

// AUTO UPDATE PWA LOGIC
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      setInterval(() => { reg.update(); }, 60000);
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            toast('✨ New update available! Reloading...');
            setTimeout(() => window.location.reload(), 2000);
          }
        };
      };
    });
  });
}

(function boot() { if (API.token) loadData(); else showLogin(); })();
