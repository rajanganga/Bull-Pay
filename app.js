const API_URL = '/api/';

// LOGIN
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = document.getElementById('userId').value;
  const p = document.getElementById('password').value;
  const err = document.getElementById('loginError');
  
  err.innerText = 'Loading...';
  try {
    const res = await fetch(API_URL + 'login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ u, p })
    });
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('bp_token', data.t);
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      loadData();
    } else {
      err.innerText = data.e || 'Login failed';
    }
  } catch (error) {
    err.innerText = 'Server error';
  }
});

// LOAD DATA
async function loadData() {
  const token = localStorage.getItem('bp_token');
  if (!token) return;

  try {
    const res = await fetch(API_URL + 'me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token }
    });
    const data = await res.json();
    
    if (res.ok) {
      // Calculate Balance
      const total = (data.orders || []).filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.slot), 0);
      document.getElementById('balance').innerText = total;
    } else {
      logout();
    }
  } catch (error) {
    console.error(error);
  }
}

// ADD BANK
document.getElementById('bankForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('bp_token');
  const msg = document.getElementById('bankMsg');
  
  const body = {
    type: 'Savings',
    bank: document.getElementById('bankName').value,
    holder: document.getElementById('holderName').value,
    number: document.getElementById('accountNumber').value,
    ifsc: document.getElementById('ifscCode').value
  };

  msg.innerText = 'Saving...';
  try {
    const res = await fetch(API_URL + 'bank/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-token': token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    
    if (res.ok) {
      msg.innerText = '✅ Bank Added Successfully!';
      document.getElementById('bankForm').reset();
    } else {
      msg.style.color = '#FF003C';
      msg.innerText = '❌ ' + (data.e || 'Error');
    }
  } catch (error) {
    msg.innerText = 'Server error';
  }
});

// LOGOUT
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('bp_token');
  location.reload();
});

function logout() {
  localStorage.removeItem('bp_token');
  location.reload();
}

// INIT
if (localStorage.getItem('bp_token')) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  loadData();
}
