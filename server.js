// THRONE FRAGRANCE — backend
// Node.js + Express + SQLite (better-sqlite3)
// Storefront and Admin both read/write the SAME database (data/throne.db),
// so an Admin change shows on the storefront immediately — no export needed.
// First run: creates tables and seeds real data. Later runs: never overwrites.

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createHash, timingSafeEqual, randomInt } = require('crypto');
const orderDiscount = require('./public/js/order-discount');
const registerStoreManagement = require('./store-management');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
const adminPassword = process.env.ADMIN_PASSWORD;
const adminUser = process.env.ADMIN_USER || 'admin';
const digest = (value) => createHash('sha256').update(value).digest();
const credentials = adminPassword && digest(adminUser + ':' + adminPassword);

function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!credentials) return res.status(503).send('Set ADMIN_PASSWORD and restart the server to enable admin access.');
  const match = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(req.get('Authorization') || '');
  if (!match || !timingSafeEqual(digest(Buffer.from(match[1], 'base64')), credentials)) {
    res.set('WWW-Authenticate', 'Basic realm="Throne Fragrance Admin", charset="UTF-8"');
    return res.status(401).send('Admin sign-in required.');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      ['cross-site', 'same-site'].includes(req.get('Sec-Fetch-Site'))) {
    return res.status(403).json({ error: 'Use the admin panel to make this change.' });
  }
  next();
}

app.use(['/admin', '/admin.html', '/api/admin'], requireAdmin);
app.get(/^\/admin(?:\.html)?\/$/i, (req, res) => res.redirect('/admin'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database ----------
const dataDir = process.env.THRONE_DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'throne.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  notes TEXT NOT NULL,
  blurb TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  price_is_placeholder INTEGER NOT NULL DEFAULT 0,
  stock INTEGER,
  is_live INTEGER NOT NULL DEFAULT 1,
  longevity INTEGER NOT NULL DEFAULT 85,
  sillage INTEGER NOT NULL DEFAULT 80,
  image_key TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  province TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  area TEXT DEFAULT '',
  address TEXT NOT NULL,
  note TEXT DEFAULT '',
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT DEFAULT '',
  delivery_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  shipping_method TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  advance_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipping_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  eta TEXT NOT NULL DEFAULT '',
  fee INTEGER NOT NULL,
  free_over INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payment_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  account_title TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  bank_name TEXT DEFAULT '',
  iban TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
`);

// Migration for databases created before the province column existed
try { db.exec(`ALTER TABLE orders ADD COLUMN province TEXT NOT NULL DEFAULT ''`); } catch (e) { /* column already exists */ }
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return; // already seeded — never overwrite
  console.log('Seeding database with real Throne Fragrance data...');
  const ins = db.prepare(`INSERT INTO products
    (slug,name,family,notes,blurb,description,price,price_is_placeholder,stock,is_live,longevity,sillage,image_key,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  ins.run('glory', 'Glory', 'Woody', 'Bergamot · clary sage · cedarwood & amber',
    'The scent of arrival — bold, polished and impossible to ignore.',
    'Glory is made for the one who walks in and owns the room. A bright bergamot opening settles into aromatic sage and a deep, woody amber base that holds on skin and fabric for hours. Housed in our signature faceted bottle and presented in the Throne gift bag — ready to wear, ready to gift.',
    2199, 0, null, 1, 90, 88, 'glory', 1);
  ins.run('midnight', 'Midnight Crown', 'Oriental', 'Black pepper · lavender · dark musk',
    'After-dark royalty — dark, smooth and quietly commanding.',
    'Midnight Crown is the night, bottled. Spiced black pepper and cool lavender melt into a dark musk base that projects with quiet authority — the fragrance of late evenings, sharp tailoring and impressions that last long after you have gone. A 50ml Eau de Parfum in the signature Throne gift bag.',
    1799, 0, null, 1, 92, 90, 'midnight-crown', 2);
  ins.run('velora', 'Velora', 'Floral', 'Peony · rose · vanilla musk',
    'Soft power — a floral that glows rather than shouts.',
    'Velora is grace with presence. Fresh peony and rose bloom over a silky vanilla-musk base, leaving a soft, elegant trail that draws people closer. Feminine, luminous and effortlessly giftable — a 50ml Eau de Parfum in the signature Throne gift bag.',
    1999, 0, null, 1, 80, 72, 'velora', 3);

  const set = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const settings = {
    announcement: 'Complimentary shipping on orders over Rs. 5,000 · Cash on delivery available · Authentic parfum, sealed',
    whatsapp: '03020682098',
    instagram: 'https://www.instagram.com/thronefragrance2235',
    checkout_title: 'Secure Checkout',
    checkout_note: 'Cash on Delivery is available across Pakistan. For advance payment, send to the account shown at checkout and share the screenshot on WhatsApp.',
    success_message: 'Thank you — your order is confirmed. Our team will call or WhatsApp you shortly to confirm delivery.',
    cities: 'Lahore, Karachi, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Hyderabad, Sialkot, Gujranwala, Bahawalpur, Sargodha, Other',
    free_ship_threshold: '5000',
    delivery_fee: '300',
    express_fee: '499',
    local_fee: '150',
    promo_code: 'THRONE10',
    promo_percent: '10',
    bundle_discount_percent: '20',
    min_order_amount: '0',
  };
  for (const [k, v] of Object.entries(settings)) set.run(k, v);

  const ship = db.prepare('INSERT INTO shipping_methods (name, eta, fee, free_over, is_active, sort_order) VALUES (?,?,?,?,?,?)');
  ship.run('Standard Delivery', '3–5 working days', 300, 5000, 1, 1);
  ship.run('Express Delivery', '1–2 working days', 499, null, 1, 2);
  ship.run('Local Delivery (Base City)', 'Same / next day', 150, 5000, 1, 3);

  const acc = db.prepare(`INSERT INTO payment_accounts
    (type,label,account_title,account_number,bank_name,iban,instructions,is_active,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  acc.run('jazzcash', 'JazzCash', 'Muhammad Saim', '0301-0746622', 'JazzCash', '', 'Send the advance and share the payment screenshot on WhatsApp.', 1, 1);
  console.log('Seeded: 3 products, 3 shipping methods, 1 JazzCash account.');
}
seedIfEmpty();

// ---------- Helpers ----------
const rowProduct = (r) => r ? { ...r, price_is_placeholder: !!r.price_is_placeholder, is_live: !!r.is_live } : null;
function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}
function getStore() {
  return {
    products: db.prepare('SELECT * FROM products WHERE is_live = 1 ORDER BY sort_order').all().map(rowProduct),
    settings: getSettings(),
    shippingMethods: db.prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY sort_order').all()
      .map((r) => ({ ...r, is_active: !!r.is_active })),
    paymentAccounts: db.prepare('SELECT * FROM payment_accounts WHERE is_active = 1 ORDER BY sort_order').all()
      .map((r) => ({ ...r, is_active: !!r.is_active })),
  };
}
function getAdminState() {
  return {
    products: db.prepare('SELECT * FROM products ORDER BY sort_order').all().map(rowProduct),
    orders: db.prepare(`SELECT o.*, EXISTS (SELECT 1 FROM courier_labels l
      WHERE l.order_id = o.id AND l.tracking = o.courier_tracking) AS has_courier_label
      FROM orders o ORDER BY id DESC`).all()
      .map((r) => ({ ...r, items: JSON.parse(r.items) })),
    settings: getSettings(),
    shippingMethods: db.prepare('SELECT * FROM shipping_methods ORDER BY sort_order').all(),
    paymentAccounts: db.prepare('SELECT * FROM payment_accounts ORDER BY sort_order').all(),
    reviews: db.prepare('SELECT * FROM reviews ORDER BY id DESC').all(),
    postexConfigured: Boolean(process.env.POSTEX_TOKEN),
  };
}
function money(n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-PK'); }

// ---------- Phone + province validation ----------
// Pakistani mobile: exactly 11 digits, must start with 03.
// Accepts 03xx-xxxxxxx, spaces/dashes, or +92 3xx xxxxxxx (normalised to 03...).
const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir', 'Islamabad Capital Territory'];
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2);
  if (d.length === 11 && d.startsWith('03')) return d;
  return null;
}
function formatPhone(digits) { // 03020682098 -> 0302-0682098
  return digits.slice(0, 4) + '-' + digits.slice(4);
}
function phoneError(raw) {
  if (!normalizePhone(raw)) return 'Phone number must be exactly 11 digits and start with 03 (e.g. 0302-0682098).';
  return null;
}

// ---------- Storefront API (live — reads the same DB as Admin) ----------
const lookupPostEx = registerStoreManagement({ app, db, normalizePhone });
app.get('/api/store', (req, res) => res.json(getStore()));
app.get('/api/admin', (req, res) => res.json(getAdminState()));

const insertOrder = db.prepare(`INSERT INTO orders
    (ref,customer_name,phone,email,province,city,area,address,note,items,subtotal,discount,promo_code,delivery_fee,total,shipping_method,payment_method,advance_paid,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const reserveStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
const restoreStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL');
const productBySlug = db.prepare('SELECT * FROM products WHERE slug = ? AND is_live = 1');
const activeShipping = db.prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY sort_order, id');
const refExists = db.prepare('SELECT 1 FROM orders WHERE ref = ?');

function orderError(status, message) {
  throw Object.assign(new Error(message), { status });
}

const createOrder = db.transaction((body, manual) => {
  const field = (key) => typeof body[key] === 'string' ? body[key].trim() : '';
  const name = field('name');
  const phone = normalizePhone(body.phone);
  const province = field('province');
  const city = field('city');
  const address = field('address');
  if (!name || !city || !address || !Array.isArray(body.items) || !body.items.length) {
    orderError(400, 'Name, phone, province, city, address and at least one item are required.');
  }
  if (!phone) orderError(400, phoneError(body.phone));
  if (!PROVINCES.includes(province)) orderError(400, 'Please select your province.');

  const quantities = new Map();
  for (const item of body.items) {
    const qty = Number(item?.qty ?? 1);
    if (typeof item?.slug !== 'string' || !Number.isSafeInteger(qty) || qty < 1) {
      orderError(400, 'Enter a whole quantity of at least 1 for each item.');
    }
    const combined = (quantities.get(item.slug) || 0) + qty;
    if (!Number.isSafeInteger(combined) || (!manual && combined > 99)) {
      orderError(400, 'Quantity exceeds the order limit.');
    }
    quantities.set(item.slug, combined);
  }

  const lines = [];
  let subtotal = 0;
  for (const [slug, qty] of quantities) {
    const product = productBySlug.get(slug);
    if (!product) orderError(400, 'Unknown product: ' + slug);
    const line = { slug, name: product.name, price: product.price, qty };
    if (product.stock != null) {
      if (!reserveStock.run(qty, product.id, qty).changes) {
        orderError(409, 'Only ' + product.stock + ' in stock for ' + product.name + '.');
      }
      line.stockProductId = product.id;
    }
    subtotal += product.price * qty;
    lines.push(line);
  }

  const promo = manual ? '' : field('promo').toUpperCase();
  const discount = manual ? 0 : orderDiscount(lines, promo, getSettings());
  const shipping = activeShipping.all();
  const ship = shipping.find((method) => method.id === Number(body.shipping_id)) || shipping[0];
  if (!ship) orderError(409, 'No delivery methods are currently available.');
  const afterDiscount = subtotal - discount;
  const deliveryFee = ship.free_over != null && afterDiscount >= ship.free_over ? 0 : ship.fee;
  const total = afterDiscount + deliveryFee;
  const advance = manual ? Number(body.advance_paid ?? 0) : 0;
  if (!Number.isSafeInteger(advance) || advance < 0 || advance > total) orderError(400, 'Invalid advance payment.');

  let ref;
  do { ref = 'TF-' + randomInt(100000, 1000000); } while (refExists.get(ref));
  const result = insertOrder.run(ref, name, phone, field('email'), province, city, field('area'),
    address, field('note'), JSON.stringify(lines), subtotal, discount, promo, deliveryFee, total,
    ship.name, field('payment') || 'cod', advance, 'new', new Date().toISOString());
  return { ok: true, id: result.lastInsertRowid, ref, subtotal, discount, delivery_fee: deliveryFee, total };
});

function placeOrder(manual) {
  return (req, res) => res.json(createOrder.immediate(req.body || {}, manual));
}
app.post('/api/orders', placeOrder(false));

app.get('/api/orders', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM orders ORDER BY id DESC').all()
    .map((r) => ({ ...r, items: JSON.parse(r.items) })));
});

// Track an order — customer enters TF- ref + the 11-digit phone used at checkout.
// Wrong phone returns found:false, so nobody can peek at someone else's order.
app.post('/api/track-order', async (req, res, next) => {
  try {
    const b = req.body || {};
    const ref = String(b.ref || '').trim().toUpperCase();
    const perr = phoneError(b.phone);
    if (!ref || perr) return res.status(400).json({ error: perr || 'Order reference (TF-XXXXXX) is required.' });
    const phone = normalizePhone(b.phone);
    const row = db.prepare('SELECT * FROM orders WHERE UPPER(ref) = ? AND phone = ?').get(ref, phone);
    if (!row) return res.json({ found: false });
    const { status, total, city, province, courier_name, courier_tracking } = row;
    let courier_status = row.courier_status;
    let courier_live = false;
    if (courier_name === 'PostEx' && courier_tracking) {
      const result = await lookupPostEx(courier_tracking, 4000);
      if (result.status) {
        courier_status = result.status;
        courier_live = true;
      }
    }
    const items = JSON.parse(row.items).map(({ slug, name, price, qty }) => ({ slug, name, price, qty }));
    res.set('Cache-Control', 'no-store');
    res.json({ found: true, order: { ref: row.ref, status, total, city, province, courier_name, courier_tracking, courier_status, courier_live, items } });
  } catch (error) {
    next(error);
  }
});
const findOrder = db.prepare('SELECT * FROM orders WHERE id = ?');
const updateOrderStatus = db.transaction((id, status) => {
  const order = findOrder.get(id);
  if (!order) orderError(404, 'Order not found.');
  if (status === order.status) return;
  for (const line of JSON.parse(order.items)) {
    if (!line.stockProductId) continue;
    if (status === 'cancelled') restoreStock.run(line.qty, line.stockProductId);
    if (order.status === 'cancelled' && !reserveStock.run(line.qty, line.stockProductId, line.qty).changes) {
      orderError(409, 'Stock is unavailable for ' + line.name + '.');
    }
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const allowed = ['new', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
  const status = req.body?.status;
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  updateOrderStatus.immediate(req.params.id, status);
  res.json({ ok: true });
});
app.patch('/api/orders/:id/advance', requireAdmin, (req, res) => {
  const order = findOrder.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const advance = Number(req.body?.advance_paid);
  if (!Number.isSafeInteger(advance) || advance < 0 || advance > order.total) {
    return res.status(400).json({ error: 'Invalid advance payment.' });
  }
  db.prepare('UPDATE orders SET advance_paid = ? WHERE id = ?').run(advance, order.id);
  res.json({ ok: true });
});

app.post('/api/admin/orders', placeOrder(true));

function validateProductNumbers(body) {
  for (const key of ['price', 'stock']) {
    const value = Number(body[key]);
    if (body[key] != null && (!Number.isSafeInteger(value) || value < 0)) {
      orderError(400, key + ' must be a non-negative whole number.');
    }
  }
}

app.post('/api/admin/products', (req, res) => {
  const b = req.body || {};
  validateProductNumbers(b);
  if (!b.name || !b.family || !b.notes || b.price == null) return res.status(400).json({ error: 'name, family, notes and price are required' });
  const ins = db.prepare(`INSERT INTO products
    (slug,name,family,notes,blurb,description,price,price_is_placeholder,stock,is_live,longevity,sillage,image_key,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const slug = (b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/^-|-$/g, '');
  const r = ins.run(slug, b.name, b.family, b.notes, b.blurb || '', b.description || '', Number(b.price),
    b.price_is_placeholder ? 1 : 0, b.stock == null ? null : Number(b.stock), b.is_live === false ? 0 : 1,
    Number(b.longevity) || 85, Number(b.sillage) || 80, b.image_key || slug,
    Number(b.sort_order) || 99);
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.put('/api/admin/products/:id', (req, res) => {
  const b = req.body || {};
  validateProductNumbers(b);
  const cur = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Product not found' });
  db.prepare(`UPDATE products SET name=?, family=?, notes=?, blurb=?, description=?, price=?,
    price_is_placeholder=?, stock=?, is_live=?, longevity=?, sillage=?, image_key=? WHERE id=?`)
    .run(b.name ?? cur.name, b.family ?? cur.family, b.notes ?? cur.notes, b.blurb ?? cur.blurb,
      b.description ?? cur.description, b.price != null ? Number(b.price) : cur.price,
      b.price_is_placeholder != null ? (b.price_is_placeholder ? 1 : 0) : cur.price_is_placeholder,
      b.stock === undefined ? cur.stock : (b.stock == null ? null : Number(b.stock)),
      b.is_live != null ? (b.is_live ? 1 : 0) : cur.is_live,
      b.longevity != null ? Number(b.longevity) : cur.longevity,
      b.sillage != null ? Number(b.sillage) : cur.sillage,
      b.image_key ?? cur.image_key, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/settings', (req, res) => {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const settings = req.body || {};
  if (settings.meta_pixel_id && !/^\d{5,30}$/.test(String(settings.meta_pixel_id))) {
    return res.status(400).json({ error: 'Enter a numeric Meta Pixel ID.' });
  }
  if (settings.promo_minimum != null && (!Number.isSafeInteger(Number(settings.promo_minimum)) || Number(settings.promo_minimum) < 0)) {
    return res.status(400).json({ error: 'Enter a valid minimum subtotal.' });
  }
  for (const key of ['promo_percent', 'bundle_discount_percent']) {
    const value = Number(settings[key]);
    if (settings[key] != null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      return res.status(400).json({ error: key + ' must be between 0 and 100.' });
    }
  }
  for (const [k, v] of Object.entries(settings)) up.run(k, String(v));
  res.json({ ok: true });
});
app.post('/api/admin/shipping', (req, res) => {
  const b = req.body || {};
  if (b.id) {
    db.prepare('UPDATE shipping_methods SET name=?, eta=?, fee=?, free_over=?, is_active=? WHERE id=?')
      .run(b.name, b.eta || '', Number(b.fee) || 0, b.free_over == null ? null : Number(b.free_over), b.is_active === false ? 0 : 1, b.id);
  } else {
    db.prepare('INSERT INTO shipping_methods (name, eta, fee, free_over, is_active, sort_order) VALUES (?,?,?,?,?,?)')
      .run(b.name, b.eta || '', Number(b.fee) || 0, b.free_over == null ? null : Number(b.free_over), 1, 99);
  }
  res.json({ ok: true });
});
app.delete('/api/admin/shipping/:id', (req, res) => {
  db.prepare('DELETE FROM shipping_methods WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
app.post('/api/admin/accounts', (req, res) => {
  const b = req.body || {};
  if (b.type === 'bank') {
    for (const key of ['bank_name', 'account_title', 'account_number', 'iban']) {
      b[key] = typeof b[key] === 'string' ? b[key].trim() : '';
    }
    if (!b.bank_name || !b.account_title || (!b.account_number && !b.iban)) {
      return res.status(400).json({ error: 'Enter the bank name, account holder name, and an account number or IBAN.' });
    }
    b.label = b.bank_name;
  }
  if (b.id) {
    db.prepare('UPDATE payment_accounts SET type=?, label=?, account_title=?, account_number=?, bank_name=?, iban=?, instructions=?, is_active=? WHERE id=?')
      .run(b.type, b.label, b.account_title || '', b.account_number || '', b.bank_name || '', b.iban || '', b.instructions || '', b.is_active === false ? 0 : 1, b.id);
  } else {
    db.prepare('INSERT INTO payment_accounts (type,label,account_title,account_number,bank_name,iban,instructions,is_active,sort_order) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(b.type, b.label, b.account_title || '', b.account_number || '', b.bank_name || '', b.iban || '', b.instructions || '', 1, 99);
  }
  res.json({ ok: true });
});
app.delete('/api/admin/accounts/:id', (req, res) => {
  db.prepare('DELETE FROM payment_accounts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : error.message });
});

app.listen(PORT, () => {
  console.log(`THRONE FRAGRANCE running at http://localhost:${PORT}`);
  console.log(`Storefront: http://localhost:${PORT}/`);
  console.log(`Admin:     http://localhost:${PORT}/admin`);
});
