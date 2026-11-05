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
  updatePass: (oldP, newP) => API.req('user/pass', { oldP, newP }) 
};

const state = { slots: [], settings: {}, banks: [], orders: [], notifs: [], selectedSlot: null };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// BANK LIST (Saare Indian Banks)
const INDIAN_BANKS = [
  "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", 
  "Punjab National Bank (PNB)", "Bank of Baroda", "Canara Bank", "Union Bank of India", 
  "IndusInd Bank", "Yes Bank", "IDFC First Bank", "Bank of India", "Central Bank of India", 
  "Indian Bank", "Indian Overseas Bank", "UCO Bank", "Bank of Maharashtra", "Punjab & Sind Bank", 
  "Federal Bank", "Other Bank"
];

// Bank Logo Fetcher
function getBankDomain(bankName) {
  const map = {
    "State Bank of India (SBI)": "sbi.co.in", "HDFC Bank": "hdfcbank.com", "ICICI Bank": "icicibank.com",
    "Axis Bank": "axisbank.com", "Kotak Mahindra Bank": "kotak.com", "Punjab National Bank (PNB)": "pnbindia.in",
    "Bank of Baroda": "bankofbaroda.in", "Canara Bank": "canarabank.com", "Union Bank of India": "unionbankofindia.co.in",
    "IndusInd Bank": "indusind.com", "Yes Bank": "yesbank.in", "IDFC First Bank": "idfcfirstbank.com",
    "Bank of India": "bankofindia.co.in", "Central Bank of India": "centralbankofindia.co.in", "Indian Bank": "indianbank.in",
    "Indian Overseas Bank": "iob.in", "UCO Bank": "ucobank.com", "Bank of Maharashtra": "bankofmaharashtra.in",
    "Punjab & Sind Bank": "psbindia.com", "Federal Bank": "federalbank.co.in"
  };
  return map[bankName] || "generic";
}

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
  if (!amount || amount < (state.settings.minSell || 100)) return 0;
  if (amount <= 500) return base;
  return base + Math.floor((amount - 500) / 100) * step;
}

window.addEventListener('load', () => {
  const loader = document.getElementById('loadingScreen');
  if(loader) loader.classList.add('hidden');
  
  if (API.token) {
    loadData().catch(() => {
      const login = document.getElementById('loginScreen');
      if(login) login.classList.remove('hidden');
    });
  } else {
    const login = document.getElementById('loginScreen');
    if(login) login.classList.remove('hidden');
  }
});

function showLogin() { 
  const l = $('#loadingScreen'); if(l) l.classList.add('hidden'); 
  const li = $('#loginScreen'); if(li) li.classList.remove('hidden'); 
  const m = $('#mainApp'); if(m) m.classList.add('hidden'); 
}
function showMain() { 
  const l = $('#loadingScreen'); if(l) l.classList.add('hidden'); 
  const li = $('#loginScreen'); if(li) li.classList.add('hidden'); 
  const m = $('#mainApp'); if(m) m.classList.remove('hidden'); 
}

const loginForm = $('#loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Authenticating...';
    try { 
      const { t } = await API.login(e.target.u.value.trim(), e.target.p.value); 
      API.token = t; localStorage.setItem('bp_token', t); toast('✅ Login successful'); await loadData(); 
    } catch (err) { 
      toast('❌ ' + err.message, 'err'); btn.disabled = false; btn.textContent = 'Login →'; 
    }
  });
}

async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || []; state.settings = d.settings || {};
    state.banks = d.banks || []; state.orders = d.orders || []; state.notifs = d.notifications || [];
    if (state.selectedSlot === null && state.slots.length) state.selectedSlot = state.slots[0];
    showMain(); renderAll();
  } catch (err) { 
    API.token = ''; localStorage.removeItem('bp_token'); showLogin(); 
    if (err.message !== 'Please login') toast('❌ ' + err.message, 'err'); 
  }
}

function renderAll() { 
  renderBalance(); renderSlots(); updateLiveRateCard(); renderPaymentAddress(); 
  renderBanks(); renderBankSelect(); renderOrders(); drawChart(); renderNotifs(); 
}

function updateLiveRateCard() {
  const amountEl = $('#liveRateAmount'); 
  const priceEl = $('#liveRatePrice');
  const calcSend = $('#calcSend');
  const calcReceive = $('#calcReceive');
  const calcRateText = $('#calcRateText');
  
  if (!amountEl || !priceEl) return;
  
  if (!state.selectedSlot || state.selectedSlot < 100) { 
    amountEl.textContent = '$0'; 
    priceEl.textContent = '₹0/USDT'; 
    if(calcSend) calcSend.textContent = '0 USDT';
    if(calcReceive) calcReceive.textContent = '₹0';
    if(calcRateText) calcRateText.textContent = 'Rate: ₹0/USDT';
  } else { 
    const rate = getRate(state.selectedSlot); 
    const totalInr = state.selectedSlot * rate;
    amountEl.textContent = `$${state.selectedSlot}`; 
    priceEl.textContent = `₹${rate}/USDT`; 
    if(calcSend) calcSend.textContent = `${state.selectedSlot} USDT`;
    if(calcReceive) calcReceive.textContent = `₹${money(totalInr)}`;
    if(calcRateText) calcRateText.textContent = `Rate: ₹${rate}/USDT`;
  }
}

function renderSlots() {
  const grid = $('#slotGrid'); if (!grid) return;
  grid.innerHTML = state.slots.map(s => {
    const rate = getRate(s); const isSelected = state.selectedSlot === s;
    return `<div class="slot ${isSelected ? 'selected' : ''}" data-slot="${s}"><span class="slot-amt">$${s}</span><span class="slot-rate">₹${rate}</span></div>`;
  }).join('');
  
  grid.querySelectorAll('.slot').forEach(el => el.addEventListener('click', () => {
    state.selectedSlot = Number(el.dataset.slot); 
    const mInput = $('#manualAmount'); if(mInput) mInput.value = ''; 
    renderSlots(); 
    updateLiveRateCard();  
  }));
}

const manualInput = $('#manualAmount');
if (manualInput) {
  manualInput.addEventListener('input', (e) => {
    let val = Number(e.target.value);
    if (val > 0) {
      if (val < (state.settings.minSell || 100)) {
        toast(`Minimum $${state.settings.minSell} required`, 'err');
        state.selectedSlot = null;
      } else {
        state.selectedSlot = val;
      }
      renderSlots(); 
      updateLiveRateCard();
    } else {
      state.selectedSlot = state.slots[0] || null;
      renderSlots();
      updateLiveRateCard();
    }
  });
}

function renderBalance() {
  const total = state.orders.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.slot || 0), 0);
  const td = $('#totalDeposits'); if(td) td.textContent = money(total); 
  const oc = $('#orderCount'); if(oc) oc.textContent = state.orders.length;
  const ac = $('#approvedCount'); if(ac) ac.textContent = state.orders.filter(o => o.status === 'approved').length;
  const pc = $('#pendingCount'); if(pc) pc.textContent = state.orders.filter(o => o.status === 'pending').length;
}

function drawChart() {
  const canvas = $('#walletChart'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); 
  const w = canvas.width = canvas.offsetWidth; 
  const h = canvas.height = 120;
  ctx.clearRect(0, 0, w, h);
  const data = state.orders.slice(0, 7).reverse();
  if (data.length < 2) { 
    ctx.fillStyle = 'rgba(0,255,65,0.5)'; ctx.font = '14px Orbitron'; ctx.textAlign = 'center'; 
    ctx.fillText('Not enough data', w/2, h/2); return; 
  }
  const max = Math.max(...data.map(o => o.slot), 100); const stepX = w / (data.length - 1);
  ctx.beginPath(); ctx.moveTo(0, h - (data[0].slot / max) * (h - 20));
  for (let i = 1; i < data.length; i++) ctx.lineTo(i * stepX, h - (data[i].slot / max) * (h - 20));
  ctx.strokeStyle = '#00FF41'; ctx.lineWidth = 2; ctx.stroke();
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(0, 255, 65, 0.2)'); grad.addColorStop(1, 'rgba(0, 255, 65, 0)');
  ctx.fillStyle = grad; ctx.fill();
}

function renderPaymentAddress() {
  const select = $('#networkSelect');
  const details = $('#paymentDetails');
  const addrText = $('#addressText');
  const badge = $('#networkBadge');

  if (select) {
    select.addEventListener('change', (e) => {
      const net = e.target.value;
      if (!net) { details.classList.add('hidden'); return; }
      let address = '';
      if (net === 'TRC20') address = state.settings.trc20 || 'TYWTuvc8kCBbYm98frNgAkVhVrdR7hXPrh';
      else if (net === 'BEP20') address = state.settings.bep20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
      else if (net === 'ERC20') address = state.settings.erc20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
      addrText.textContent = address; badge.textContent = net; details.classList.remove('hidden');
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
  if (!sel) return;
  if (!state.banks.length) { sel.innerHTML = '<option value="">No banks added. Add one first!</option>'; sel.disabled = true; }
  else { sel.disabled = false; sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${escape(b.bank)} - A/C ${escape(b.number)}</option>`).join(''); }
}

// ==========================================
// NAYA BANK SEARCH DROPDOWN LOGIC
// ==========================================
const bankSearchInput = $('#bankSearch');
const bankDropdown = $('#bankDropdown');
const selectedBankInput = $('#selectedBank');
const otherBankField = $('#otherBankField');
const otherBankInput = $('#otherBankInput');

if (bankSearchInput) {
  // 1. Input field me type karte hi list dikhao
  bankSearchInput.addEventListener('input', function() {
    const val = this.value.toLowerCase();
    bankDropdown.innerHTML = ''; // Purani list clear karo
    bankDropdown.classList.add('active'); // List show karo

    // Filter banks
    const filtered = INDIAN_BANKS.filter(b => b.toLowerCase().includes(val));

    if (filtered.length === 0) {
      bankDropdown.innerHTML = '<div style="padding:10px; font-size:13px; color:var(--text-dim);">No bank found</div>';
      selectedBankInput.value = ''; // Reset
      return;
    }

    // Dropdown me items add karo
    filtered.forEach(bankName => {
      const div = document.createElement('div');
      div.className = 'bank-option';
      
      // Logo logic
      const domain = getBankDomain(bankName);
      let logoUrl = domain === 'generic' ? 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png' : `https://logo.clearbit.com/${domain}`;
      
      div.innerHTML = `<img src="${logoUrl}" alt="logo" onerror="this.src='https://cdn-icons-png.flaticon.com/512/2830/2830284.png'"> <span>${bankName}</span>`;
      
      // Jab item par click karein
      div.addEventListener('click', () => {
        bankSearchInput.value = bankName; // Input me bank ka naam daalo
        selectedBankInput.value = bankName; // Hidden input me value save karo
        bankDropdown.classList.remove('active'); // List band karo

        // Agar Other Bank select kiya hai to extra input dikhao
        if (bankName === 'Other Bank') {
          otherBankField.classList.remove('hidden');
          otherBankInput.required = true;
          otherBankInput.focus();
        } else {
          otherBankField.classList.add('hidden');
          otherBankInput.required = false;
          otherBankInput.value = '';
        }
      });

      bankDropdown.appendChild(div);
    });
  });

  // 2. Jab input field par focus karein, tab bhi list dikhao
  bankSearchInput.addEventListener('focus', function() {
    if (this.value === '') {
      this.dispatchEvent(new Event('input')); // Trigger input event to show all banks
    } else {
      bankDropdown.classList.add('active');
    }
  });

  // 3. Agar kahin bahar click karein to list band ho jaye
  document.addEventListener('click', (e) => {
    if (!bankSearchInput.contains(e.target) && !bankDropdown.contains(e.target)) {
      bankDropdown.classList.remove('active');
    }
  });
}

// ==========================================
// FORM SUBMIT
// ==========================================

const helpBtn = $('#helpBtn');
if (helpBtn) helpBtn.addEventListener('click', () => { $('#helpMenu').classList.toggle('active'); });

const orderForm = $('#orderForm');
if (orderForm) {
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    if (state.selectedSlot === null || state.selectedSlot < (state.settings.minSell || 100)) return toast(`Select amount or enter min $${state.settings.minSell}`, 'err');
    if (!form.bankId.value) return toast('Add bank first', 'err');
    const file = form.receipt.files[0]; if (!file) return toast('Upload screenshot', 'err');
    if (file.size > 2.5 * 1024 * 1024) return toast('Image too large (Max 2MB)', 'err');
    
    btn.disabled = true; btn.textContent = 'Uploading...';
    const reader = new FileReader();
    reader.onload = async (event) => {
      try { 
        await API.createOrder({ bankId: form.bankId.value, slot: state.selectedSlot, txid: form.txid.value.trim(), receipt: event.target.result }); 
        toast('✅ Submitted'); form.reset(); const mInput = $('#manualAmount'); if(mInput) mInput.value = ''; await loadData(); 
      } catch (err) { toast('❌ ' + err.message, 'err'); }
      btn.disabled = false; btn.textContent = 'Submit Order →';
    };
    reader.readAsDataURL(file);
  });
}

const addBankBtn = $('#addBankBtn');
const cancelBankBtn = $('#cancelBankBtn');
if (addBankBtn) addBankBtn.addEventListener('click', () => $('#addBankForm').classList.toggle('hidden'));
if (cancelBankBtn) cancelBankBtn.addEventListener('click', () => $('#addBankForm').classList.add('hidden'));

const newBankForm = $('#newBankForm');
if (newBankForm) {
  newBankForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]');
    
    let finalBankName = selectedBankInput.value || bankSearchInput.value.trim();
    
    if (finalBankName === 'Other Bank') { 
      if (!otherBankInput.value.trim()) return toast('Please enter your bank name', 'err'); 
      finalBankName = otherBankInput.value.trim(); 
    } 
    else if (!finalBankName) { 
      return toast('Please select or type a bank name', 'err'); 
    }

    if (form.number.value.trim() !== form.confirmNumber.value.trim()) {
      return toast('Account numbers do not match!', 'err');
    }

    btn.disabled = true; btn.textContent = 'Saving...';
    try { 
      await API.addBank({ 
        type: form.type.value, 
        number: form.number.value.trim(), 
        bank: finalBankName, 
        ifsc: form.ifsc.value.trim().toUpperCase(),
        holder: form.holder.value.trim() 
      }); 
      toast('✅ Bank added'); form.reset(); selectedBankInput.value = ''; bankSearchInput.value = ''; otherBankField.classList.add('hidden'); otherBankInput.value = ''; $('#addBankForm').classList.add('hidden'); await loadData(); 
    } catch (err) { toast('❌ ' + err.message, 'err'); }
    btn.disabled = false; btn.textContent = 'Save Bank';
  });
}

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

const logoutBtn = $('#logoutBtn');
if(logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('bp_token'); API.token = ''; location.reload(); });

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
  $$('.tab-content').forEach(c => c.classList.add('hidden')); 
  const target = $('#tab-' + tab.dataset.tab); if(target) target.classList.remove('hidden');
}));

function renderOrders() {
  const list = $('#ordersList');
  if (!list) return;
  if (!state.orders.length) { list.innerHTML = '<p class="text-dim center-text text-sm" style="padding:20px 0;">No orders yet</p>'; return; }
  list.innerHTML = state.orders.map(o => {
    const rate = getRate(o.slot); 
    return `
    <div class="list-item" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <div class="info"><strong>$${money(o.slot)} (@ ₹${rate}) — ${escape(o.status)}</strong><small>TXN: ${escape(o.txid)}</small></div>
        <span class="badge badge-${o.status}">${o.status}</span>
      </div>
      ${o.receipt ? `<img src="${o.receipt}" style="max-height:60px; border-radius:2px; margin-top:8px; border:1px solid var(--border);" />` : ''}
    </div>
  `}).join('');
}

function renderNotifs() {
  const unread = state.notifs.filter(n => !n.read).length;
  const badge = $('#notifBadge');
  if (!badge) return;
  if (unread > 0) { badge.classList.remove('hidden'); badge.textContent = unread > 9 ? '9+' : unread; } else badge.classList.add('hidden');
  const list = $('#notifList');
  if(list) {
    list.innerHTML = state.notifs.length ? state.no
