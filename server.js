// BullPay server - Node 18+, koi npm install nahi chahiye.  Run: ADMIN_PASS=apna_password node server.js
const http = require('http'), fs = require('fs'), c = require('crypto'), path = require('path');
const FILE = path.join(process.env.DATA_DIR || __dirname, 'data.json'); // hosting par DATA_DIR=/data set karein
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const PORT = process.env.PORT || 3000;
const SLOTS = Array.from({ length: 11 }, (_, i) => 500 + i * 100); // 500, 600 ... 1500

const DEF = { users: [], banks: [], orders: [], settings: { address: '', network: 'TRC20' } };
let D = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : DEF;
// Free hosting par data bachane ke liye Supabase (SUPABASE_URL + SUPABASE_KEY set karein)
const SU = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SK = process.env.SUPABASE_KEY || '';
const H = { apikey: SK, 'content-type': 'application/json' };
if (SK.startsWith('eyJ')) H.Authorization = 'Bearer ' + SK; // purani service_role key (JWT) ke liye; nayi sb_secret_ key me sirf apikey chalti hai
let q = Promise.resolve();
const save = () => {
  if (!SU) return fs.writeFileSync(FILE, JSON.stringify(D, null, 1));
  const body = JSON.stringify({ id: 1, data: D });
  q = q.then(() => fetch(SU + '/rest/v1/store', { method: 'POST', body, headers: { ...H, Prefer: 'resolution=merge-duplicates' } })
    .then(r => { if (!r.ok) return r.text().then(t => console.error('DB save fail', t)); }))
    .catch(e => console.error('DB save fail', e.message));
};
async function init() {
  if (!SU) return;
  const r = await fetch(SU + '/rest/v1/store?id=eq.1&select=data', { headers: H });
  if (!r.ok) throw new Error('Supabase connect nahi hua: ' + await r.text());
  const j = await r.json(); if (j[0]) D = j[0].data; else save();
}
const uid = () => c.randomBytes(6).toString('hex');
const hash = (p, s) => c.scryptSync(p, s, 32).toString('hex');
const eq = (a, b) => a.length === b.length && c.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const sessions = {}, fails = {};
const clean = (s, n = 60) => String(s ?? '').trim().slice(0, n);

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function page(res, f) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  const p = [path.join(__dirname, 'public', f), path.join(__dirname, f)].find(x => fs.existsSync(x)); // public/ ya same folder dono chalenge
  res.end(fs.readFileSync(p));
}
function throttle(ip) { // 10 galat login ke baad 5 min block
  const f = fails[ip];
  return f && f.n >= 10 && Date.now() - f.t < 300000;
}
function bad(ip) { const f = fails[ip] || { n: 0 }; fails[ip] = { n: f.n + 1, t: Date.now() }; }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/') return page(res, 'app.html');
  if (req.method === 'GET' && url.pathname === '/admin') return page(res, 'admin.html');
  if (!url.pathname.startsWith('/api/')) return send(res, 404, { e: 'Not found' });

  let body = '';
  req.on('data', d => { body += d; if (body.length > 1e5) req.destroy(); });
  req.on('end', () => {
    let b = {}; try { b = body ? JSON.parse(body) : {}; } catch { return send(res, 400, { e: 'Bad request' }); }
    const r = url.pathname.slice(5), ip = req.socket.remoteAddress;
    const s = sessions[req.headers['x-token']];

    if (r === 'login') {
      if (throttle(ip)) return send(res, 429, { e: 'Thodi der baad try karein' });
      const u = D.users.find(x => x.username === clean(b.u));
      if (!u || u.disabled || !eq(hash(String(b.p), u.salt), u.hash)) { bad(ip); return send(res, 401, { e: 'ID ya password galat hai' }); }
      const t = uid() + uid(); sessions[t] = { role: 'user', id: u.id };
      return send(res, 200, { t });
    }
    if (r === 'admin/login') {
      if (throttle(ip)) return send(res, 429, { e: 'Thodi der baad try karein' });
      if (!eq(String(b.p), ADMIN_PASS)) { bad(ip); return send(res, 401, { e: 'Password galat hai' }); }
      const t = uid() + uid(); sessions[t] = { role: 'admin' };
      return send(res, 200, { t });
    }
    if (!s) return send(res, 401, { e: 'Login karein' });

    if (s.role === 'admin') {
      if (r === 'admin/all') return send(res, 200, {
        users: D.users.map(({ id, username, disabled }) => ({ id, username, disabled })),
        banks: D.banks, orders: D.orders, settings: D.settings
      });
      if (r === 'admin/user/add') {
        const u = clean(b.u, 30), p = String(b.p || '');
        if (u.length < 3 || p.length < 6) return send(res, 400, { e: 'ID min 3, password min 6 characters' });
        if (D.users.some(x => x.username === u)) return send(res, 400, { e: 'Ye ID pehle se hai' });
        const salt = uid(); D.users.push({ id: uid(), username: u, salt, hash: hash(p, salt), disabled: false });
        save(); return send(res, 200, {});
      }
      if (r === 'admin/user/pass') {
        const u = D.users.find(x => x.id === b.id);
        if (!u || String(b.p || '').length < 6) return send(res, 400, { e: 'Password min 6 characters' });
        u.salt = uid(); u.hash = hash(b.p, u.salt); save();
        for (const k in sessions) if (sessions[k].id === u.id) delete sessions[k];
        return send(res, 200, {});
      }
      if (r === 'admin/user/toggle') {
        const u = D.users.find(x => x.id === b.id); if (!u) return send(res, 404, { e: 'Nahi mila' });
        u.disabled = !u.disabled; save();
        if (u.disabled) for (const k in sessions) if (sessions[k].id === u.id) delete sessions[k];
        return send(res, 200, {});
      }
      if (r === 'admin/user/del') {
        D.users = D.users.filter(x => x.id !== b.id); D.banks = D.banks.filter(x => x.userId !== b.id); save();
        for (const k in sessions) if (sessions[k].id === b.id) delete sessions[k];
        return send(res, 200, {});
      }
      if (r === 'admin/order') {
        const o = D.orders.find(x => x.id === b.id);
        if (!o || !['approved', 'rejected'].includes(b.status)) return send(res, 400, { e: 'Invalid' });
        o.status = b.status; save(); return send(res, 200, {});
      }
      if (r === 'admin/settings') {
        D.settings = { address: clean(b.address, 120), network: clean(b.network, 20) || 'TRC20' };
        save(); return send(res, 200, {});
      }
      return send(res, 404, { e: 'Not found' });
    }

    // ---- user routes ----
    const me = s.id;
    if (r === 'me') return send(res, 200, {
      slots: SLOTS, settings: D.settings,
      banks: D.banks.filter(x => x.userId === me),
      orders: D.orders.filter(x => x.userId === me).reverse()
    });
    if (r === 'bank/add') {
      const t = clean(b.type, 20), n = clean(b.number, 30), bk = clean(b.bank, 60), i = clean(b.ifsc, 11).toUpperCase();
      if (!t || !/^\d{6,25}$/.test(n) || !bk || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(i)) return send(res, 400, { e: 'Details sahi se bharein (IFSC format: SBIN0001234)' });
      D.banks.push({ id: uid(), userId: me, type: t, number: n, bank: bk, ifsc: i }); save(); return send(res, 200, {});
    }
    if (r === 'bank/del') { D.banks = D.banks.filter(x => !(x.id === b.id && x.userId === me)); save(); return send(res, 200, {}); }
    if (r === 'order') {
      const bank = D.banks.find(x => x.id === b.bankId && x.userId === me), tx = clean(b.txid, 100);
      if (!SLOTS.includes(b.slot) || !bank) return send(res, 400, { e: 'Slot ya bank chunein' });
      if (tx.length < 8) return send(res, 400, { e: 'Sahi Transaction ID daalein' });
      if (D.orders.some(x => x.txid.toLowerCase() === tx.toLowerCase())) return send(res, 400, { e: 'Ye Transaction ID pehle use ho chuki hai' });
      D.orders.push({ id: uid(), userId: me, username: D.users.find(x => x.id === me)?.username, slot: b.slot, bank, txid: tx, status: 'pending', ts: Date.now() });
      save(); return send(res, 200, {});
    }
    send(res, 404, { e: 'Not found' });
  });
});
init().then(() => server.listen(PORT, () => console.log('BullPay chal raha hai, port ' + PORT))).catch(e => { console.error(e.message); process.exit(1); });
