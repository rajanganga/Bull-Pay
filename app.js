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
  updatePass: (oldP, newP) => API.req('user/pass', { oldP, newP }) 
};

const state = { slots: [], settings: {}, banks: [], orders: [], selectedSlot: null };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = 'ok') { 
  const el = document.createElement('div'); 
  el.className = 'toast ' + type; 
  el.textContent = msg; 
  const wrap = $('#toastWrap');
  if(wrap) wrap.appendChild(el); 
  setTimeout(() => el.remove(), 3500); 
}
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function getRate(amount) {
  const isOffer = state.settings.isOfferActive;
  const base = isOffer ? (state.settings.offerRate || 126) : (state.settings.baseRate || 125);
  const step = state.settings.rateStep || 1;
  if (!amount || amount < 100) return 0;
  if (amount <= 500) return base;
  return base + Math.floor((amount - 500) / 100) * step;
}

window.addEventListener('DOMContentLoaded', () => {
  if (API.token) loadData();
});

function showLogin() { 
  const li = $('#loginScreen'); if(li) li.style.display = 'flex'; 
  const m = $('#mainApp'); if(m) m.style.display = 'none'; 
}
function showMain() { 
  const li = $('#loginScreen'); if(li) li.style.display = 'none'; 
  const m = $('#mainApp'); if(m) m.style.display = 'block'; 
}

const loginForm = $('#loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Logging in...';
    try { 
      const { t } = await API.login(e.target.u.value.trim(), e.target.p.value); 
      API.token = t; localStorage.setItem('bp_token', t); 
      toast('✅ Login successful'); await loadData(); 
    } catch (err) { 
      toast('❌ ' + err.message, 'err'); btn.disabled = false; btn.textContent = 'Login →'; 
    }
  });
}

async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || []; state.settings = d.settings || {};
    state.banks = d.banks || []; state.orders = d.orders || [];
    if (state.selectedSlot === null && state.slots.length) state.selectedSlot = state.slots[0];
    showMain(); 
    renderAll();
  } catch (err) { 
    API.token = ''; localStorage.removeItem('bp_token'); showLogin(); 
    if (err.message !== 'Please login') toast('❌ ' + err.message, 'err'); 
  }
}

function renderAll() { 
  renderSlots(); 
  updateRate(); 
  renderBanks(); 
  renderBankSelect(); 
  setupNetworkSelect(); // Network Dropdown Setup
}

function updateRate() {
  const amountEl = $('#liveRateAmount'); 
  const priceEl = $('#liveRatePrice');
  if (!amountEl || !priceEl) return;
  
  if (!state.selectedSlot || state.selectedSlot < 100) { 
    amountEl.textContent = '$0'; 
    priceEl.textContent = '₹0/USDT'; 
  } else { 
    const rate = getRate(state.selectedSlot); 
    amountEl.textContent = `$${state.selectedSlot}`; 
    priceEl.textContent = `₹${rate}/USDT`; 
  }
}

function renderSlots() {
  const grid = $('#slotGrid'); if (!grid) return;
  grid.innerHTML = state.slots.map(s => {
    const rate = getRate(s); const isSelected = state.selectedSlot === s;
    return `<div class="slot ${isSelected ? 'selected' : ''}" data-slot="${s}">
      <span class="slot-amt">$${s}</span>
      <span class="slot-rate">₹${rate}</span>
    </div>`;
  }).join('');
  
  grid.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => {
    state.selectedSlot = Number(el.dataset.slot); 
    renderSlots(); 
    updateRate();  
  }));
}

// --- NETWORK SELECT & ADDRESS SHOW ---
function setupNetworkSelect() {
  const select = $('#networkSelect');
  const details = $('#paymentDetails');
  const addrText = $('#addressText');
  const badge = $('#networkBadge');

  if (select) {
    select.addEventListener('change', (e) => {
      const net = e.target.value;
      if (!net) { details.style.display = 'none'; return; }
      
      let address = '';
      if (net === 'TRC20') address = state.settings.trc20 || 'TYWTuvc8kCBbYm98frNgAkVhVrdR7hXPrh';
      else if (net === 'BEP20') address = state.settings.bep20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
      else if (net === 'ERC20') address = state.settings.erc20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
      
      addrText.textContent = address; 
      badge.textContent = net; 
      details.style.display = 'block'; // Address box open
    });
  }
}

const copyAddrBtn = $('#copyAddrBtn');
if (copyAddrBtn) {
  copyAddrBtn.addEventListener('click', () => {
    const addr = $('#addressText').textContent;
    if (!addr || addr === '-') return toast('Select network first', 'err');
    navigator.clipboard.writeText(addr).then(() => toast('✅ Address Copied'));
  });
}

function renderBanks() {
  const list = $('#banksList');
  if (!list) return;
  if (!state.banks.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No banks added yet</p>'; return; }
  list.innerHTML = state.banks.map(b => `
    <div class="list-item">
      <div class="info"><strong>${escape(b.bank)} • ${escape(b.type)}</strong><small>${b.holder ? 'Name: ' + escape(b.holder) + ' | ' : ''}A/C ${escape(b.number)} • IFSC ${escape(b.ifsc)}</small></div>
      <div class="row"><button class="btn btn-danger btn-sm" data-del-bank="${b.id}">Delete</button></div>
    </div>
  `).join('');
  
  list.querySelectorAll('[data-del-bank]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete?')) return;
    try { await API.delBank(btn.dataset.delBank); toast('✅ Deleted'); await loadData(); } catch (e) { toast('❌ ' + e.message, 'err'); }
  }));
}

function renderBankSelect() {
  const sel = $('#bankSelect');
  if (!sel) return;
  if (!state.banks.length) { sel.innerHTML = '<option value="">No banks added. Add one first!</option>'; sel.disabled = true; }
  else { sel.disabled = false; sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${escape(b.bank)} - A/C ${escape(b.number)}</option>`).join(''); }
}

// --- ADD BANK FORM SHOW/HIDE ---
const addBankBtn = $('#addBankBtn');
const cancelBankBtn = $('#cancelBankBtn');
if (addBankBtn) {
  addBankBtn.addEventListener('click', () => { 
    const f = $('#addBankForm'); 
    f.style.display = (f.style.display === 'none' || f.style.display === '') ? 'block' : 'none'; 
  });
}
if (cancelBankBtn) {
  cancelBankBtn.addEventListener('click', () => { 
    $('#addBankForm').style.display = 'none'; 
  });
}

// --- SAVE NEW BANK ---
const newBankForm = $('#newBankForm');
if (newBankForm) {
  newBankForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    let bankName = form.bank.value.trim();
    
    if (!bankName) return toast('Please enter bank name', 'err');
    if (form.number.value.trim() !== form.confirmNumber.value.trim()) return toast('Account numbers do not match!', 'err');

    btn.disabled = true; btn.textContent = 'Saving...';
    try { 
      await API.addBank({ 
        type: form.type.value, 
        number: form.number.value.trim(), 
        bank: bankName, 
        ifsc: form.ifsc.value.trim().toUpperCase(),
        holder: form.holder.value.trim() 
      }); 
      toast('✅ Bank added'); 
      form.reset(); 
      $('#addBankForm').style.display = 'none'; 
      await loadData(); 
    } catch (err) { 
      toast('❌ ' + err.message, 'err'); 
    }
    btn.disabled = false; btn.textContent = 'Save Bank';
  });
}

// --- SUBMIT ORDER ---
const orderForm = $('#orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    if (state.selectedSlot === null) return toast(`Select amount`, 'err');
    if (!form.bankId.value) return toast('Add bank first', 'err');
    const file = form.receipt.files[0]; if (!file) return toast('Upload screenshot', 'err');
    
    btn.disabled = true; btn.textContent = 'Uploading...';
    const reader = new FileReader();
    reader.onload = async (event) => {
      try { 
        await API.createOrder({ bankId: form.bankId.value, slot: state.selectedSlot, txid: form.txid.value.trim(), receipt: event.target.result }); 
        toast('✅ Submitted'); form.reset(); await loadData(); 
      } catch (err) { toast('❌ ' + err.message, 'err'); }
      btn.disabled = false; btn.textContent = 'Submit Order →';
    };
    reader.readAsDataURL(file);
  });
}

// --- UPDATE PASSWORD ---
const updatePassForm = $('#updatePassForm');
if (updatePassForm) {
  updatePassForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Updating...';
    try {
      await API.updatePass(form.oldP.value, form.newP.value);
      toast('✅ Password updated successfully');
      form.reset();
    } catch (err) {
      toast('❌ ' + err.message, 'err');
    }
    btn.disabled = false; btn.textContent = 'Update Password';
  });
}

// --- LOGOUT & TABS ---
const logoutBtn = $('#logoutBtn');
if(logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('bp_token'); location.reload(); });

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
  $$('.tab-content').forEach(c => c.style.display = 'none'); 
  const target = $('#tab-' + tab.dataset.tab); if(target) target.style.display = 'block';
}));
