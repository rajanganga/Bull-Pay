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
      showLogin();
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

const state = { slots: [], settings: {}, banks: [], orders: [], user: {} };
const $ = (sel) => document.querySelector(sel);

function toast(msg, type = 'ok') { 
  const el = document.createElement('div'); 
  el.className = 'toast ' + type; 
  el.innerText = msg; 
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#0A0E17;border:1px solid #00FF41;padding:10px 20px;border-radius:8px;color:#fff;z-index:9999;font-weight:bold;';
  document.body.appendChild(el); 
  setTimeout(() => el.remove(), 3000); 
}

window.addEventListener('DOMContentLoaded', () => {
  if (API.token) loadData();
  else showLogin();
});

function showLogin() { $('#loginScreen').style.display = 'grid'; $('#mainApp').style.display = 'none'; }
function showMain() { $('#loginScreen').style.display = 'none'; $('#mainApp').style.display = 'block'; }

$('#loginForm').addEventListener('submit', async (e) => {
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

function renderAll() { 
  // 1. Wallet Balance
  const totalApproved = state.orders.filter(o => o.status === 'approved').reduce((sum, o) => sum + Number(o.slot), 0);
  $('#totalDeposits').innerText = totalApproved;
  
  // 2. Dynamic Rate Calculation
  const isOffer = state.settings.isOfferActive;
  const base = isOffer ? (state.settings.offerRate || 126) : (state.settings.baseRate || 125);
  $('#liveRatePrice').innerText = base;

  // 3. Update Live Orders Amount
  const inr100 = document.getElementById('inr-100');
  const inr300 = document.getElementById('inr-300');
  const inr500 = document.getElementById('inr-500');

  if (inr100) inr100.innerHTML = `₹${(100 * base).toLocaleString('en-IN')} <small>You Receive</small>`;
  if (inr300) inr300.innerHTML = `₹${(300 * base).toLocaleString('en-IN')} <small>You Receive</small>`;
  if (inr500) inr500.innerHTML = `₹${(500 * base).toLocaleString('en-IN')} <small>You Receive</small>`;

  // 4. Profile Data
  $('#profileMobile').innerText = state.user.mobile || 'Not set';

  // 5. Render Banks
  renderBanks();
}

function renderBanks() {
  const listHome = $('#savedBanksList');
  const listProfile = $('#profileBanksList');
  const sel = $('#bankSelect');
  
  if (!state.banks.length) {
    if(listHome) listHome.innerHTML = '<p style="color:#FF003C; font-size:12px;">No banks added yet.</p>';
    if(listProfile) listProfile.innerHTML = '<p style="color:#6C7A8F; font-size:12px;">No banks saved.</p>';
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
  if(listProfile) listProfile.innerHTML = html;
  if(sel) sel.innerHTML = state.banks.map(b => `<option value="${b.id}">${b.bank} - ${b.number}</option>`).join('');
}

// TAB SWITCHING
window.switchTab = function(tab) {
  $('#section-home').style.display = 'none';
  $('#section-order').style.display = 'none';
  $('#section-profile').style.display = 'none';
  
  $('#nav-home').classList.remove('active');
  $('#nav-order').classList.remove('active');
  $('#nav-profile').classList.remove('active');

  if (tab === 'home') {
    $('#section-home').style.display = 'block';
    $('#nav-home').classList.add('active');
  } else if (tab === 'order') {
    $('#section-order').style.display = 'block';
    $('#nav-order').classList.add('active');
  } else if (tab === 'profile') {
    $('#section-profile').style.display = 'block';
    $('#nav-profile').classList.add('active');
  }
  window.scrollTo(0,0);
}

// ADD BANK
$('#newBankForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.target; const btn = form.querySelector('button');
  if (form.number.value.trim() !== form.confirmNumber.value.trim()) return toast('Account numbers do not match!');
  
  btn.innerText = 'SAVING...';
  try { 
    await API.addBank({ 
      type: 'Savings', number: form.number.value.trim(), 
      bank: form.bank.value.trim(), ifsc: form.ifsc.value.trim().toUpperCase(), holder: form.holder.value.trim() 
    }); 
    toast('✅ Bank Added Successfully'); 
    form.reset(); 
    await loadData(); 
  } catch (err) { toast('❌ ' + err.message); }
  btn.innerText = 'SAVE BANK ACCOUNT';
});

// BOOK ORDER
window.bookOrder = function(amount) {
  $('#selectedSlot').value = amount;
  $('#payAmountText').innerText = `$${amount} USDT`;
  
  const paySec = $('#paymentSection');
  paySec.style.display = 'block';
  paySec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  $('#addressBox').style.display = 'none';
  $('#networkSelect').value = '';
}

$('#networkSelect').addEventListener('change', (e) => {
  const net = e.target.value;
  const addrBox = $('#addressBox');
  const addrText = $('#addressText');

  if (!net) { addrBox.style.display = 'none'; return; }

  let address = '';
  if (net === 'TRC20') address = state.settings.trc20 || 'TYWTuvc8kCBbYm98frNgAkVhVrdR7hXPrh';
  else if (net === 'BEP20') address = state.settings.bep20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';
  else if (net === 'ERC20') address = state.settings.erc20 || '0x7e0de6e0949cd79fbf87c38dd2b6b4ac49e6f28f';

  addrText.innerText = address;
  addrBox.style.display = 'block';
});

window.copyAddress = function() {
  const addr = $('#addressText').innerText;
  if (!addr || addr === '-') return;
  navigator.clipboard.writeText(addr).then(() => toast('✅ Address Copied'));
}

$('#finalOrderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const slot = Number($('#selectedSlot').value);
  const bankId = $('#bankSelect').value;
  const txid = $('#txid').value.trim();
  const file = $('#receipt').files[0];

  if (!slot) return toast('Please select an order first');
  if (!bankId) return toast('Please add a bank account');
  if (!txid || !file) return toast('Please fill all details');

  const btn = e.target.querySelector('button');
  btn.innerText = 'UPLOADING...';

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      await API.createOrder({ bankId, slot, txid, receipt: event.target.result });
      toast('✅ Order Submitted! Admin will verify.');
      $('#finalOrderForm').reset();
      $('#paymentSection').style.display = 'none';
      await loadData();
    } catch (err) { toast('❌ ' + err.message); }
    btn.innerText = 'SUBMIT ORDER';
  };
  reader.readAsDataURL(file);
});

// UPDATE PASSWORD
$('#updatePassForm').addEventListener('submit', async (e) => {
  e.preventDefault(); const form = e.target;
  try {
    await API.updatePass(form.oldP.value, form.newP.value);
    toast('✅ Password updated successfully');
    form.reset();
  } catch (err) { toast('❌ ' + err.message); }
});

$('#logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('bp_token');
  location.reload();
});
