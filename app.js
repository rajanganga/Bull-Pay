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
  createOrder: (o) => API.req('order', o)
};

const state = { slots: [], settings: {}, banks: [], orders: [], selectedSlot: null };
const $ = (sel) => document.querySelector(sel);

function toast(msg, type = 'ok') { 
  const el = document.createElement('div'); 
  el.className = 'toast ' + type; 
  el.textContent = msg; 
  const wrap = $('#toastWrap');
  if(wrap) wrap.appendChild(el); 
  setTimeout(() => el.remove(), 3500); 
}

function getRate(amount) {
  const isOffer = state.settings.isOfferActive;
  const base = isOffer ? (state.settings.offerRate || 126) : (state.settings.baseRate || 125);
  const step = state.settings.rateStep || 1;
  if (!amount || amount < 100) return 0;
  if (amount <= 500) return base;
  return base + Math.floor((amount - 500) / 100) * step;
}

// Page Load
window.addEventListener('DOMContentLoaded', () => {
  if (API.token) loadData();
});

// Login
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
    
    // UI Show
    const l = $('#loginScreen'); if(l) l.style.display = 'none'; 
    const m = $('#mainApp'); if(m) m.style.display = 'block'; 
    
    renderSlots(); 
    updateRate(); 
    renderBanks();
  } catch (err) { 
    localStorage.removeItem('bp_token'); API.token = ''; 
    const l = $('#loginScreen'); if(l) l.style.display = 'flex'; 
    const m = $('#mainApp'); if(m) m.style.display = 'none'; 
  }
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
    return `<div class="slot ${isSelected ? 'selected' : ''}" data-slot="${s}" style="padding:10px; border:1px solid #00FF41; margin:5px; display:inline-block; cursor:pointer; color:#fff;">
      <span>$${s}</span><br><small style="color:#00FF41;">₹${rate}</small>
    </div>`;
  }).join('');
  
  grid.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => {
    state.selectedSlot = Number(el.dataset.slot); 
    renderSlots(); 
    updateRate();  
  }));
}

function renderBanks() {
  const list = $('#banksList');
  if (!list) return;
  if (!state.banks.length) { list.innerHTML = '<p>No banks added yet</p>'; return; }
  list.innerHTML = state.banks.map(b => `
    <div style="border:1px solid #333; padding:10px; margin-bottom:5px;">
      <strong>${b.bank}</strong><br>
      <small>A/C: ${b.number}</small>
    </div>
  `).join('');

  const sel = $('#bankSelect');
  if(sel) sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${b.bank} - ${b.number}</option>`).join('');
}

// Add Bank
const newBankForm = $('#newBankForm');
if (newBankForm) {
  newBankForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';
    try { 
      await API.addBank({ 
        type: 'Savings', 
        number: form.number.value.trim(), 
        bank: form.bank.value.trim(), 
        ifsc: form.ifsc.value.trim().toUpperCase(),
        holder: form.holder.value.trim() 
      }); 
      toast('✅ Bank added'); form.reset(); await loadData(); 
    } catch (err) { toast('❌ ' + err.message, 'err'); }
    btn.disabled = false; btn.textContent = 'Save Bank';
  });
}

// Logout
const logoutBtn = $('#logoutBtn');
if(logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('bp_token'); location.reload(); });

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); 
    tab.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none'); 
    const target = document.getElementById('tab-' + tab.dataset.tab); 
    if(target) target.style.display = 'block';
  });
});
