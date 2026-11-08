const API = {
  token: localStorage.getItem('bp_token') || '',
  async req(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const currentToken = localStorage.getItem('bp_token');
    if (currentToken) headers['x-token'] = currentToken;
    const res = await fetch('/api/' + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    
    if (res.status === 401) {
      localStorage.removeItem('bp_token');
      const l = document.getElementById('loginScreen'); if(l) l.style.display = 'flex';
      const m = document.getElementById('mainApp'); if(m) m.style.display = 'none';
      throw new Error("Session expired. Login again.");
    }
    if (!res.ok) throw new Error(data.e || 'Request failed');
    return data;
  },
  login: (u, p) => API.req('login', { u, p }),
  me: () => API.req('me', {}),
  addBank: (b) => API.req('bank/add', b),
  createOrder: (o) => API.req('order', o),
  updatePass: (oldP, newP) => API.req('user/pass', { oldP, newP }) 
};

const state = { slots: [], settings: {}, banks: [], orders: [], user: {}, currentFund: 'Clean' };
const $ = (sel) => document.querySelector(sel);

function toast(msg) { 
  const el = document.createElement('div'); 
  el.innerText = msg; 
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0A0E17;border:1px solid #00FF41;padding:10px 20px;border-radius:8px;color:#fff;z-index:9999;font-weight:bold;';
  document.body.appendChild(el); 
  setTimeout(() => el.remove(), 3000); 
}

window.addEventListener('DOMContentLoaded', () => {
  if (API.token) loadData();
  else showLogin();
});

function showLogin() { 
  const l = $('#loginScreen'); if(l) l.style.display = 'flex'; 
  const m = $('#mainApp'); if(m) m.style.display = 'none'; 
}
function showMain() { 
  const l = $('#loginScreen'); if(l) l.style.display = 'none'; 
  const m = $('#mainApp'); if(m) m.style.display = 'block'; 
}

const loginForm = $('#loginForm');
if(loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button');
    btn.innerText = 'WAIT...';
    try { 
      const { t } = await API.login(e.target.u.value.trim(), e.target.p.value); 
      localStorage.setItem('bp_token', t); 
      await loadData(); 
    } catch (err) { 
      toast('❌ ' + err.message); btn.innerText = 'LOGIN';
    }
  });
}

async function loadData() {
  try {
    const d = await API.me();
    state.slots = d.slots || []; state.settings = d.settings || {};
    state.banks = d.banks || []; state.orders = d.orders || [];
    state.user = d.user || {};
    
    showMain(); 
    renderAll();
  } catch (err) { 
    showLogin(); 
  }
}

// RATE CALCULATION LOGIC
function getRate(amount) {
  const isOffer = state.settings.isOfferActive;
  const cleanBase = isOffer ? (state.settings.offerRate || 126) : (state.settings.baseRate || 125);
  const cleanStep = state.settings.rateStep || 1;
  
  const mixBase = state.settings.mixBase || 135;
  const mixStep = state.settings.mixStep || 2;
  
  const xxxBase = state.settings.xxxBase || 150;
  const xxxStep = state.settings.xxxStep || 3;

  if (!amount) return 0;

  if (state.currentFund === 'Clean') {
    if (amount <= 500) return cleanBase;
    return cleanBase + Math.floor((amount - 500) / 100) * cleanStep;
  } 
  else if (state.currentFund === 'Mix') {
    if (amount <= 500) return mixBase;
    return mixBase + Math.floor((amount - 500) / 100) * mixStep;
  } 
  else if (state.currentFund === 'XXX') {
    if (amount <= 500) return xxxBase;
    return xxxBase + Math.floor((amount - 500) / 100) * xxxStep;
  }
  return 0;
}

function renderAll() { 
  const totalApproved = state.orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + Number(o.slot), 0);
  const walletEl = $('#totalDeposits'); if (walletEl) walletEl.innerText = totalApproved;

  const mobEl = $('#profileMobile');
  if (mobEl) mobEl.innerText = (state.user && state.user.mobile) ? state.user.mobile : 'Not set';

  renderBanks();
  switchFund(state.currentFund); // Default fund tab render
}

function renderBanks() {
  const listHome = $('#savedBanksList');
  const sel = $('#bankSelect');
  
  if (!state.banks.length) {
    if(listHome) listHome.innerHTML = '<p style="color:#FF003C; font-size:12px;">No banks added yet.</p>';
    if(sel) sel.innerHTML = '<option value="">No banks added</option>';
    return;
  }

  const html = state.banks.map(b => `
    <div style="background:rgba(0,255,65,0.1); padding:10px; border-radius:8px; margin-bottom:5px; border:1px solid rgba(0,255,65,0.3);">
      <strong style="color:#00FF41;">${b.bank}</strong> - ${b.number}<br>
      <small style="color:#aaa;">${b.holder}</small>
    </div>
  `).join('');

  if(listHome) listHome.innerHTML = html;
  if(sel) sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${b.bank} - ${b.number}</option>`).join('');
}

// TABS LOGIC
window.switchTab = function(tab) {
  const sHome = $('#section-home'); if(sHome) sHome.style.display = 'none';
  const sOrder = $('#section-order'); if(sOrder) sOrder.style.display = 'none';
  const sProfile = $('#section-profile'); if(sProfile) sProfile.style.display = 'none';
  
  const nHome = $('#nav-home'); if(nHome) nHome.style.color = '#6C7A8F';
  const nOrder = $('#nav-order'); if(nOrder) nOrder.style.color = '#6C7A8F';
  const nProfile = $('#nav-profile'); if(nProfile) nProfile.style.color = '#6C7A8F';

  if (tab === 'home') {
    if(sHome) sHome.style.display = 'block';
    if(nHome) nHome.style.color = '#00FF41';
  } else if (tab === 'order') {
    if(sOrder) sOrder.style.display = 'block';
    if(nOrder) nOrder.style.color = '#00FF41';
  } else if (tab === 'profile') {
    if(sProfile) sProfile.style.display = 'block';
    if(nProfile) nProfile.style.color = '#00FF41';
  }
  window.scrollTo(0,0);
}

// FUND TABS LOGIC
window.switchFund = function(fund) {
  state.currentFund = fund;
  
  // Buttons active style
  const cBtn = $('#btn-tab-clean'); const mBtn = $('#btn-tab-mix'); const xBtn = $('#btn-tab-xxx');
  if(cBtn) { cBtn.style.background = 'transparent'; cBtn.style.color = '#6C7A8F'; }
  if(mBtn) { mBtn.style.background = 'transparent'; mBtn.style.color = '#6C7A8F'; }
  if(xBtn) { xBtn.style.background = 'transparent'; xBtn.style.color = '#6C7A8F'; }

  if(fund === 'Clean' && cBtn) { cBtn.style.background = '#00FF41'; cBtn.style.color = '#000'; }
  if(fund === 'Mix' && mBtn) { mBtn.style.background = '#00FF41'; mBtn.style.color = '#000'; }
  if(fund === 'XXX' && xBtn) { xBtn.style.background = '#00FF41'; xBtn.style.color = '#000'; }

  // Update Live Rate Display
  const rateEl = $('#liveRatePrice');
  const dummyAmt = 100; 
  if(rateEl) rateEl.innerText = getRate(dummyAmt);

  renderOrderCards();
}

function renderOrderCards() {
  const container = $('#orders-container');
  if(!container) return;

  const amounts = [100, 300, 500, 1000];
  const names = ["PARIMATCH", "1XBET", "1WIN", "BC.GAME"];

  container.innerHTML = amounts.map((amt, i) => {
    const rate = getRate(amt);
    const inr = amt * rate;
    return `
      <div style="background: #0A0E17; border: 1px solid #333; border-radius: 12px; padding: 15px; margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #333; padding-bottom: 10px;">
          <div style="font-size: 12px; color: #6C7A8F;">Order ID: 58654508${i}</div>
          <div style="background: #FF003C; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${state.currentFund.toUpperCase()}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="font-family: 'Orbitron'; font-size: 20px; font-weight: bold;">${amt.toFixed(2)} <span style="font-size: 12px; color: #00FF41;">USDT</span></div>
          <div style="text-align: right;">
            <div style="font-family: 'Orbitron'; font-size: 16px; color: #00FF41;">₹${inr.toLocaleString('en-IN')}</div>
            <div style="font-size: 10px; color: #6C7A8F;">You Receive</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 12px; color: #6C7A8F;">Payout: <span style="background: #222; padding: 2px 6px; border-radius: 4px; color: #fff;">${names[i]}</span></div>
          <button onclick="bookOrder(${amt}, '${state.currentFund}')" style="background: #00FF41; color: #000; font-family: 'Orbitron'; font-weight: bold; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer;">BOOK</button>
        </div>
      </div>
    `;
  }).join('');
}

// UPDATED: Dynamic MinSell check
window.updateManualRate = function() {
  const amt = Number($('#manualAmt').value);
  const minSell = state.settings.minSell || 100; // Admin Panel Setting
  
  const inrEl = $('#manualInr');
  if (!amt || amt < minSell) {
    if(inrEl) inrEl.innerText = '₹0';
    return;
  }
  const rate = getRate(amt);
  if(inrEl) inrEl.innerText = `₹${(amt * rate).toLocaleString('en-IN')}`;
}

window.bookOrder = function(amount, fundType) {
  $('#selectedSlot').value = amount;
  $('#selectedFundType').value = fundType;
  $('#payAmountText').innerText = `$${amount} USDT (${fundType} Fund)`;
  
  const paySec = $('#paymentSection');
  if(paySec) {
    paySec.style.display = 'block';
    paySec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// UPDATED: Dynamic MinSell check
window.bookManual = function() {
  const amt = Number($('#manualAmt').value);
  const minSell = state.settings.minSell || 100; // Admin Panel Setting
  
  if (!amt || amt < minSell) return toast(`Minimum $${minSell} required`);
  bookOrder(amt, state.currentFund);
}

const netSelect = $('#networkSelect');
if(netSelect) {
  netSelect.addEventListener('change', (e) => {
    const net = e.target.value;
    const addrBox = $('#addressBox');
    const addrText = $('#addressText');
  
    if (!net) { if(addrBox) addrBox.style.display = 'none'; return; }
  
    let address = '';
    if (net === 'TRC20') address = state.settings.trc20 || 'TYWTuvc8kCBbYm98frNgAkVhVrdR7hXPrh';
    else if (net === 'BEP20') address = state.settings.bep20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
    else if (net === 'ERC20') address = state.settings.erc20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
  
    if(addrText) addrText.innerText = address;
    if(addrBox) addrBox.style.display = 'block';
  });
}

window.copyAddress = function() {
  const addrText = $('#addressText');
  if (!addrText) return;
  const addr = addrText.innerText;
  if (!addr || addr === '-') return;
  navigator.clipboard.writeText(addr).then(() => toast('✅ Address Copied'));
}

const finalOrderForm = $('#finalOrderForm');
if(finalOrderForm) {
  finalOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const slot = Number($('#selectedSlot').value);
    const fundType = $('#selectedFundType').value;
    const bankId = $('#bankSelect').value;
    const txid = $('#txid').value.trim();
    const file = $('#receipt').files[0];
    
    const minSell = state.settings.minSell || 100; // Admin Panel Setting
  
    if (!slot) return toast('Please select an order first');
    if (slot < minSell) return toast(`Minimum sell is $${minSell}`);
    if (!bankId) return toast('Please add a bank account');
    if (!txid || !file) return toast('Please fill all details');
  
    const btn = e.target.querySelector('button');
    btn.innerText = 'UPLOADING...';
  
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await API.createOrder({ bankId, slot, txid, fundType, receipt: event.target.result });
        toast('✅ Order Submitted!');
        $('#finalOrderForm').reset();
        $('#paymentSection').style.display = 'none';
        await loadData();
      } catch (err) { toast('❌ ' + err.message); }
      btn.innerText = 'SUBMIT ORDER';
    };
    reader.readAsDataURL(file);
  });
}

const newBankForm = $('#newBankForm');
if(newBankForm) {
  newBankForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button');
    if (form.number.value.trim() !== form.confirmNumber.value.trim()) return toast('Account numbers do not match!');
    
    btn.innerText = 'SAVING...';
    try { 
      await API.addBank({ 
        type: 'Savings', number: form.number.value.trim(), 
        bank: form.bank.value.trim(), ifsc: form.ifsc.value.trim().toUpperCase(), holder: form.holder.value.trim() 
      }); 
      toast('✅ Bank Added'); 
      form.reset(); 
      await loadData(); 
    } catch (err) { toast('❌ ' + err.message); }
    btn.innerText = 'SAVE BANK';
  });
}

const updatePassForm = $('#updatePassForm');
if(updatePassForm) {
  updatePassForm.addEventListener('submit', async (e) => {
    e.preventDefault(); const form = e.target;
    try {
      await API.updatePass(form.oldP.value, form.newP.value);
      toast('✅ Password updated successfully');
      form.reset();
    } catch (err) { toast('❌ ' + err.message); }
  });
}

const logoutBtn = $('#logoutBtn');
if(logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('bp_token');
    location.reload();
  });
  }
