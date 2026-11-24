// THRONE FRAGRANCE — storefront (plain JS, no framework)
// Reads live data from /api/store — the same database the Admin writes to.
let STORE = { products: [], settings: {}, shippingMethods: [], paymentAccounts: [] };
let bag = JSON.parse(localStorage.getItem('throne-bag') || '[]');
let promo = localStorage.getItem('throne-promo') || '';
let search = '', maxPrice = Infinity, family = 'All', sort = 'featured';
let checkout = { payment: 'cod', shippingId: 1 };

const $ = (s) => document.querySelector(s);
const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir', 'Islamabad Capital Territory'];
const CITY_PROVINCE = {
  Lahore:'Punjab', Faisalabad:'Punjab', Rawalpindi:'Punjab', Multan:'Punjab', Sialkot:'Punjab', Gujranwala:'Punjab', Bahawalpur:'Punjab', Sargodha:'Punjab', Sheikhupura:'Punjab', Jhelum:'Punjab', Gujrat:'Punjab', Kasur:'Punjab', Okara:'Punjab', Sahiwal:'Punjab', 'Dera Ghazi Khan':'Punjab', Muzaffargarh:'Punjab', 'Rahim Yar Khan':'Punjab', Attock:'Punjab', Chakwal:'Punjab', Mianwali:'Punjab', Bhakkar:'Punjab', Khushab:'Punjab', Hafizabad:'Punjab', Narowal:'Punjab', 'Mandi Bahauddin':'Punjab', 'Toba Tek Singh':'Punjab', Khanewal:'Punjab', Lodhran:'Punjab', Vehari:'Punjab', Pakpattan:'Punjab', Jhang:'Punjab', Chiniot:'Punjab', 'Nankana Sahib':'Punjab', Murree:'Punjab', Karachi:'Sindh', Hyderabad:'Sindh', Sukkur:'Sindh', Larkana:'Sindh', Nawabshah:'Sindh', 'Mirpur Khas':'Sindh', Jacobabad:'Sindh', Shikarpur:'Sindh', Khairpur:'Sindh', Dadu:'Sindh', Thatta:'Sindh', Badin:'Sindh', 'Tando Adam':'Sindh', 'Tando Allahyar':'Sindh', Peshawar:'Khyber Pakhtunkhwa', Mardan:'Khyber Pakhtunkhwa', Mingora:'Khyber Pakhtunkhwa', Abbottabad:'Khyber Pakhtunkhwa', Kohat:'Khyber Pakhtunkhwa', 'Dera Ismail Khan':'Khyber Pakhtunkhwa', Swabi:'Khyber Pakhtunkhwa', Nowshera:'Khyber Pakhtunkhwa', Mansehra:'Khyber Pakhtunkhwa', Charsadda:'Khyber Pakhtunkhwa', Bannu:'Khyber Pakhtunkhwa', Haripur:'Khyber Pakhtunkhwa', Quetta:'Balochistan', Turbat:'Balochistan', Khuzdar:'Balochistan', Chaman:'Balochistan', Gwadar:'Balochistan', Sibi:'Balochistan', Zhob:'Balochistan', 'Dera Bugti':'Balochistan', Gilgit:'Gilgit-Baltistan', Skardu:'Gilgit-Baltistan', Chilas:'Gilgit-Baltistan', Hunza:'Gilgit-Baltistan', Ghizer:'Gilgit-Baltistan', Muzaffarabad:'Azad Jammu & Kashmir', Mirpur:'Azad Jammu & Kashmir', Kotli:'Azad Jammu & Kashmir', Rawalakot:'Azad Jammu & Kashmir', Bagh:'Azad Jammu & Kashmir', Islamabad:'Islamabad Capital Territory'
};
// Phone: exactly 11 digits, must start with 03. Accepts dashes/spaces or +92.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('92')) d = '0' + d.slice(2);
  return (d.length === 11 && d.startsWith('03')) ? d : null;
}
function formatPhoneInput(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  return d.slice(0, 4) + '-' + d.slice(4);
}
function phoneIsValid(raw) { return !!normalizePhone(raw); }
function imgFor(product, eager) {
  const base = '/images/' + encodeURIComponent(product.image_key);
  return `<img src="${base}.webp" data-fallback="${base}.jpg" alt="${esc(product.name)}" width="800" height="864" loading="${eager ? 'eager' : 'lazy'}" decoding="async" ${eager ? 'fetchpriority="high"' : ''}>`;
}

async function loadStore() {
  const r = await fetch('/api/store');
  if (!r.ok) throw new Error('Store request failed');
  STORE = await r.json();
  window.thronePixel.configure(STORE.settings.meta_pixel_id);
  window.thronePixel.track('PageView');
  const announcement = document.getElementById('announcement');
  announcement.textContent = STORE.settings.announcement?.trim() || announcement.textContent.trim();
  document.getElementById('announcementRepeat').textContent = announcement.textContent;
  const wa = STORE.settings.whatsapp || '03020682098';
  document.getElementById('waLink').textContent = wa;
  document.getElementById('waLink').href = 'https://wa.me/92' + wa.replace(/^0/, '').replace(/\D/g, '');
  document.getElementById('igLink').href = STORE.settings.instagram || 'https://www.instagram.com/thronefragrance2235';
  renderRoute();
}

function saveBag() {
  localStorage.setItem('throne-bag', JSON.stringify(bag));
  localStorage.setItem('throne-promo', promo);
  updateBagCount(); renderBag();
}
function bagLines() {
  return bag.map((it) => {
    const p = STORE.products.find((x) => x.slug === it.slug);
    return p ? { ...p, qty: it.qty } : null;
  }).filter(Boolean);
}
function bagSubtotal() { return bagLines().reduce((s, l) => s + l.price * l.qty, 0); }
function bagDiscount() {
  return window.orderDiscount(bagLines(), promo, STORE.settings);
}
function canAddQuantity(slug, qty) {
  const product = STORE.products.find((item) => item.slug === slug);
  if (!product) return false;
  const stock = product.stock;
  if (stock != null && qty > stock) { alert('Only ' + stock + ' in stock for ' + product.name + '.'); return false; }
  if (qty > 99) { alert('Maximum quantity per item is 99.'); return false; }
  return true;
}
function addToBag(slug, qty = 1) {
  const ex = bag.find((i) => i.slug === slug);
  if (!canAddQuantity(slug, (ex?.qty || 0) + qty)) return;
  if (ex) ex.qty += qty; else bag.push({ slug, qty });
  saveBag(); openDrawer();
}
function updateBagCount() {
  document.getElementById('bagCount').textContent = bag.reduce((s, i) => s + i.qty, 0);
}
const drawer = document.getElementById('drawer');
function openDrawer() {
  renderBag();
  if (!drawer.open) drawer.showModal();
}
function closeDrawer() {
  if (drawer.open) drawer.close();
}
drawer.addEventListener('click', (event) => {
  if (event.target !== drawer) return;
  const rect = drawer.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer();
});

function renderBag() {
  const lines = bagLines();
  document.getElementById('promoInput').value = promo;
  const applied = window.orderDiscount.promoAvailable(lines, promo, STORE.settings);
  document.getElementById('promoStatus').textContent = !promo ? '' : applied
    ? 'Promo code applied.'
    : 'This promo code does not apply to the current subtotal.';
  document.getElementById('checkoutBtn').disabled = !lines.length;
  if (!lines.length) {
    document.getElementById('bagItems').innerHTML = '<p class="muted">Your bag is empty.</p>';
    document.getElementById('bagSummary').innerHTML = '';
    return;
  }
  document.getElementById('bagItems').innerHTML = lines.map((l) => `
    <div class="bag-item">
      <div><strong>${esc(l.name)}</strong><br><span class="muted">${money(l.price)} × ${l.qty}</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="icon-btn" onclick="changeQty('${l.slug}',-1)">−</button>
        <strong>${l.qty}</strong>
        <button class="icon-btn" onclick="changeQty('${l.slug}',1)">+</button>
        <button class="icon-btn" title="Remove" onclick="removeFromBag('${l.slug}')">🗑</button>
      </div>
    </div>`).join('');
  const sub = bagSubtotal(), disc = bagDiscount();
  const threshold = Number(STORE.settings.free_ship_threshold || 5000);
  const left = Math.max(0, threshold - (sub - disc));
  const pct = Math.min(100, Math.round((sub - disc) / threshold * 100));
  document.getElementById('bagSummary').innerHTML = `
    <div class="delivery-note" role="note"><strong>Delivery charges must be paid in advance.</strong><br><span>Cash on delivery is available for the product amount; delivery charges must be paid when confirming the order.</span></div>
    <div class="progress"><i style="width:${pct}%"></i></div>
    <p class="muted">${left > 0 ? 'Add ' + money(left) + ' more for free shipping' : '🎉 Free shipping unlocked!'}</p>
    <p style="margin-top:10px">Subtotal: <strong>${money(sub)}</strong>${disc ? `<br>Discount: <strong style="color:var(--gold)">− ${money(disc)}</strong>` : ''}</p>`;
}
window.changeQty = (slug, d) => {
  const it = bag.find((i) => i.slug === slug); if (!it) return;
  if (d > 0 && !canAddQuantity(slug, it.qty + d)) return;
  it.qty += d; if (it.qty <= 0) bag = bag.filter((i) => i.slug !== slug);
  saveBag();
};
window.removeFromBag = (slug) => { bag = bag.filter((i) => i.slug !== slug); saveBag(); };

function productCard(p) {
  const url = '#/product/' + encodeURIComponent(p.slug);
  const soldOut = p.stock != null && p.stock <= 0;
  return `<article class="card">
    <a class="bottle card-image" href="${url}" aria-label="View ${esc(p.name)}">${imgFor(p)}</a>
    <div class="card-body">
      <p class="eyebrow">${esc(p.family)} · 50 ml</p>
      <h3><a href="${url}">${esc(p.name)}</a></h3>
      <p class="muted card-notes">${esc(p.notes)}</p>
      <div class="card-actions">
        <p class="price">${money(p.price)}</p>
        <button class="btn small" type="button" data-add-product="${esc(p.slug)}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Sold out' : 'Add to bag'}</button>
      </div>
    </div>
  </article>`;
}

function collectionCards() {
  let list = STORE.products.filter((p) =>
    (!search || (p.name + ' ' + p.family + ' ' + p.notes).toLowerCase().includes(search.toLowerCase())) &&
    p.price <= maxPrice && (family === 'All' || p.family === family));
  if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
  if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
  return list.length ? list.map(productCard).join('') : '<p class="store-message">No fragrances match these filters.</p>';
}

function homeView() {
  const trio = ['glory', 'midnight', 'velora'].map((slug) => STORE.products.find((product) => product.slug === slug));
  const hasTrio = STORE.settings.bundle_enabled !== '0' && trio.every(Boolean);
  const trioTotal = hasTrio ? trio.reduce((total, product) => total + product.price, 0) : 0;
  const trioPrice = hasTrio ? trioTotal - window.orderDiscount(trio.map((product) => ({ ...product, qty: 1 })), '', STORE.settings) : 0;
  const featured = trio[0] || STORE.products[0];
  const promoCode = STORE.settings.promo_code || 'THRONE10';
  const promoPercent = Number(STORE.settings.promo_percent || 10);
  return `
  <section class="hero" aria-labelledby="heroTitle">
    <div class="hero-copy">
      <p class="eyebrow">Throne Fragrance · Eau de Parfum</p>
      <h1 id="heroTitle">Rule your<br><em>scent.</em></h1>
      <p>From bright woods to soft florals, find the fragrance that feels like yours.</p>
      <div class="hero-actions">
        <a class="btn gold" href="#/collection">Shop the collection</a>
        <a class="text-link" href="#/finder">Find your scent</a>
      </div>
    </div>
    ${featured ? `<a class="hero-image bottle" href="#/product/${encodeURIComponent(featured.slug)}" aria-label="Discover ${esc(featured.name)}">
      ${imgFor(featured, true)}
      <span class="hero-caption"><strong>${esc(featured.name)}</strong><span>${esc(featured.family)} · 50 ml</span></span>
    </a>` : ''}
  </section>
  <ul class="service-strip" aria-label="Shopping information">
    <li>Cash on delivery across Pakistan</li><li>Signature gift bag included</li><li>7-day returns</li>
  </ul>

  <section class="section collection" id="collection">
    <div class="section-heading">
      <h2>The collection</h2>
      <p>50 ml Eau de Parfum</p>
    </div>
    <div class="toolbar">
      <input id="q" aria-label="Search fragrances" placeholder="Search — e.g. woody, rose, Glory…" value="${esc(search)}">
      <select id="maxP" aria-label="Maximum price">
        <option value="Infinity" ${maxPrice === Infinity ? 'selected' : ''}>Any price</option>
        <option value="2000" ${maxPrice === 2000 ? 'selected' : ''}>Up to Rs. 2,000</option>
        <option value="2500" ${maxPrice === 2500 ? 'selected' : ''}>Up to Rs. 2,500</option>
      </select>
      <select id="sortSel" aria-label="Sort fragrances">
        <option value="featured" ${sort === 'featured' ? 'selected' : ''}>Featured</option>
        <option value="low" ${sort === 'low' ? 'selected' : ''}>Price: low to high</option>
        <option value="high" ${sort === 'high' ? 'selected' : ''}>Price: high to low</option>
      </select>
    </div>
    <div class="toolbar">
      ${['All', ...new Set(STORE.products.map((product) => product.family))].map((f) => `<button class="chip ${family === f ? 'active' : ''}" aria-pressed="${family === f}" data-fam="${esc(f)}">${esc(f)}</button>`).join('')}
    </div>
    <div class="grid" id="collectionGrid" aria-live="polite">${collectionCards()}</div>
  </section>

  <section class="section" id="offers">
    <div class="section-heading"><h2>Offers</h2></div>
    <div class="offers">
      ${hasTrio ? `<article class="offer offer-trio">
        <h3>The signature trio</h3>
        <p>Glory, Midnight Crown and Velora in one set.</p>
        <p class="price">${money(trioPrice)} ${trioPrice < trioTotal ? `<s>${money(trioTotal)}</s>` : ''}</p>
        <button class="btn gold" type="button" onclick="addTrio()" ${trio.some((product) => product.stock === 0) ? 'disabled' : ''}>Add trio to bag</button>
      </article>` : ''}
      ${STORE.settings.promo_enabled !== '0' ? `<article class="offer">
        <h3>${promoPercent}% off with ${esc(promoCode)}</h3>
        <p>Apply this code to your bag to use it in place of the trio discount.</p>
        ${Number(STORE.settings.promo_minimum) > 0 ? `<p class="muted">Minimum subtotal: ${money(STORE.settings.promo_minimum)}</p>` : ''}
        <button class="btn" type="button" id="offerPromo">Apply ${esc(promoCode)}</button>
      </article>` : ''}
      ${!hasTrio && STORE.settings.promo_enabled === '0' ? '<p class="muted">No offers are active right now.</p>' : ''}
    </div>
  </section>

  <section class="section" id="finder">
    <div class="section-heading"><h2>Find your scent</h2></div>
    <div class="scent-grid">
      ${[
        ['Bold and woody', trio[0]],
        ['Dark and smooth', trio[1]],
        ['Soft and floral', trio[2]],
      ].filter(([, product]) => product).map(([profile, product]) => `
        <a class="scent-option" href="#/product/${encodeURIComponent(product.slug)}">
          <p class="eyebrow">${profile}</p>
          <h3>${esc(product.name)}</h3>
          <p class="muted">${esc(product.notes)}</p>
        </a>`).join('') || '<p class="store-message">No recommendations are available right now.</p>'}
    </div>
  </section>

  <section class="section story" id="story">
    <h2>Our story</h2>
    <div>
      <p>Throne Fragrance started with a simple idea: the right scent changes how you enter a room. Glory, Midnight Crown and Velora are our three signature Eau de Parfums, each presented in a Throne gift bag.</p>
      <a class="text-link" href="#/contact">Contact us</a>
    </div>
  </section>`;
}
window.addTrio = () => {
  const slugs = ['glory', 'midnight', 'velora'];
  const quantities = slugs.map((slug) => (bag.find((item) => item.slug === slug)?.qty || 0) + 1);
  if (!slugs.every((slug, index) => canAddQuantity(slug, quantities[index]))) return;
  slugs.forEach((slug, index) => {
    const existing = bag.find((item) => item.slug === slug);
    if (existing) existing.qty = quantities[index];
    else bag.push({ slug, qty: 1 });
  });
  saveBag();
  openDrawer();
};

function productView(slug) {
  const p = STORE.products.find((x) => x.slug === slug);
  if (!p) return '<p style="padding:40px 0">Product not found. <a href="#/" style="color:var(--gold)">Back to Collection</a></p>';
  const others = STORE.products.filter((x) => x.slug !== slug);
  const meter = (v) => `<div class="progress"><i style="width:${v}%"></i></div>`;
  return `<section class="section">
    <a class="text-link" href="#/collection">Back to collection</a>
    <div class="form-grid" style="margin-top:16px">
      <div class="bottle product-image">${imgFor(p, true)}</div>
      <div>
        <h1 class="product-title">${esc(p.name)}</h1>
        <p class="muted">${esc(p.family)} · Eau De Parfum · 50ml · Gift bag included</p>
        <p class="price" style="font-size:26px">${money(p.price)}</p>
        <p>${esc(p.description)}</p>
        <p class="muted" style="margin-top:10px"><strong>Notes:</strong> ${esc(p.notes)}</p>
        <p style="margin-top:12px">Longevity ${p.longevity}%</p>${meter(p.longevity)}
        <p>Sillage ${p.sillage}%</p>${meter(p.sillage)}
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="btn gold" type="button" data-add-product="${esc(p.slug)}" ${p.stock === 0 ? 'disabled' : ''}>${p.stock === 0 ? 'Sold out' : 'Add to bag'}</button>
          <a class="btn green" href="https://wa.me/923020682098?text=${encodeURIComponent('Hi Throne Fragrance, I want to order ' + p.name + ' (' + money(p.price) + ')')}" target="_blank" rel="noopener">Order on WhatsApp</a>
        </div>
      </div>
    </div>
    <section class="section" aria-labelledby="reviewsTitle">
      <h2 id="reviewsTitle">Customer reviews</h2>
      <div id="productReviews" aria-live="polite">Loading reviews…</div>
      <details class="panel-box"><summary>Write a review for a delivered order</summary>
        <form id="reviewForm" class="settings-form" data-product="${esc(p.slug)}">
          <div class="field"><label for="reviewRef">Order reference</label><input id="reviewRef" name="ref" placeholder="TF-123456" required></div>
          <div class="field"><label for="reviewPhone">Order phone number</label><input id="reviewPhone" name="phone" type="tel" required></div>
          <div class="field"><label for="reviewName">Public display name</label><input id="reviewName" name="display_name" maxlength="60" required></div>
          <div class="field"><label for="reviewRating">Rating</label><select id="reviewRating" name="rating">${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}">${rating}/5</option>`).join('')}</select></div>
          <div class="field"><label for="reviewComment">Review</label><textarea id="reviewComment" name="comment" maxlength="1000" required></textarea></div>
          <button class="btn gold" type="submit">Submit review</button><p role="status" class="muted"></p>
        </form>
      </details>
    </section>
    <h3 style="margin-top:30px">You may also like</h3>
    <div class="grid">${others.map(productCard).join('')}</div>
  </section>`;
}

function trackView() {
  return `<section class="section info-page"><h2>TRACK YOUR ORDER</h2>
    <p class="muted">Enter your order reference (TF-XXXXXX) and the phone number you used at checkout.</p>
    <form id="trackForm" style="margin-top:16px">
      <div class="field"><label>Order reference *</label><input name="ref" required placeholder="TF-123456"></div>
      <div class="field"><label>Phone (WhatsApp) *</label><input name="phone" id="trackPhone" required placeholder="03xx-xxxxxxx" inputmode="tel" maxlength="12"><div class="field-error" id="trackPhoneError">Phone number must be exactly 11 digits and start with 03.</div></div>
      <button class="btn gold" type="submit">Track Order</button>
    </form><div id="trackResult" aria-live="polite" style="margin-top:16px"></div></section>`;
}
function faqView() {
  const m = STORE.shippingMethods || [];
  const std = m.find((x) => /standard/i.test(x.name)); const exp = m.find((x) => /express/i.test(x.name)); const loc = m.find((x) => /local/i.test(x.name));
  const acc = (STORE.paymentAccounts || []).find((a) => a.type === 'jazzcash');
  const shipLine = (x) => x ? `${esc(x.name)} — ${money(x.fee)}${x.free_over ? ' · Free over ' + money(x.free_over) : ''} · ${esc(x.eta)}` : '';
  const faqs = [
    ['How long does delivery take?', 'Standard delivery takes 3–5 working days, Express 1–2 working days, Local (base city) same / next day.'],
    ['Can I pay Cash on Delivery?', 'Yes — COD is available across Pakistan. You pay when your order arrives.'],
    ['How do I pay in advance?', acc ? `Send the advance to ${esc(acc.label)} — ${esc(acc.account_title)} · ${esc(acc.account_number)} — and share the payment screenshot on WhatsApp (03020682098).` : 'Advance payment details are shown at checkout when you choose JazzCash / EasyPaisa.'],
    ['What are the delivery charges?', [shipLine(std), shipLine(exp), shipLine(loc)].filter(Boolean).join('<br>') + `<br>Free shipping on orders over ${money(Number(STORE.settings.free_ship_threshold || 5000))}.`],
    ['Can I return a perfume?', 'Yes — 7-day easy returns on sealed, unused bottles. See the Return & Refund Policy in the footer.'],
    ['Are your perfumes original?', 'Yes — 100% original and sealed. Every order comes with our Throne gift bag.'],
    ['How do I order on WhatsApp?', 'Add perfumes to your bag, go to checkout and tap “Order on WhatsApp Instead”, or message us directly on 03020682098.'],
  ];
  return `<section class="section info-page"><h2>HELP / FAQ</h2>
    ${faqs.map(([q, a]) => `<div class="faq-item"><h3>${q}</h3><p>${a}</p></div>`).join('')}
    <p style="margin-top:14px">Still stuck? <a href="#/contact">Contact us →</a></p></section>`;
}
function contactView() {
  return `<section class="section info-page"><h2>CONTACT US</h2>
    <p class="muted">We reply on WhatsApp, usually within a few hours.</p>
    <div class="offers" style="margin-top:16px">
      <div class="offer"><h3>WHATSAPP</h3><p><a href="https://wa.me/923020682098" target="_blank" rel="noopener">03020682098</a></p><p class="muted">Orders, tracking and support</p></div>
      <div class="offer"><h3>INSTAGRAM</h3><p><a href="https://www.instagram.com/thronefragrance2235" target="_blank" rel="noopener">@thronefragrance2235</a></p><p class="muted">New drops and offers</p></div>
    </div>
    <form id="contactForm" style="margin-top:16px">
      <div class="field"><label>Your name</label><input name="name" required></div>
      <div class="field"><label>Your message</label><textarea name="message" rows="4" required placeholder="Hi Throne Fragrance, …"></textarea></div>
      <button class="btn gold" type="submit">Send on WhatsApp</button>
    </form></section>`;
}
function policyView(kind) {
  const pages = {
    return: ['Return & Refund Policy', `<p>We want you to love your scent. If something is wrong, here is how returns work for THRONE FRAGRANCE in Pakistan.</p>
      <h3>7-day returns</h3><p>You can return a sealed, unused bottle within 7 days of delivery for a replacement or refund.</p>
      <h3>Damaged or wrong item</h3><p>If your order arrives damaged or is the wrong perfume, contact us on WhatsApp (03020682098) within 7 days with photos. We will replace it or refund you.</p>
      <h3>Refunds</h3><p>Refunds for advance payments are sent back to the same JazzCash / bank account within 3–5 working days after we receive the return. COD orders are refunded after the returned bottle reaches us.</p>
      <h3>What cannot be returned</h3><p>Opened or used bottles cannot be returned, for hygiene reasons.</p>`],
    privacy: ['Privacy Policy', `<p>We use your order details to process delivery. If you submit a review, your display name, rating and review may be published after moderation.</p>
      <h3>Marketing cookies</h3><p>If you enable marketing cookies, we use Meta Pixel to measure store visits and purchases. You can change your preference in the footer.</p>
      <h3>How we use it</h3><p>To confirm, pack and deliver your order, and to contact you about it on WhatsApp or phone. We never sell your details.</p>
      <h3>Payments</h3><p>Advance payments go to our JazzCash account (Muhammad Saim · 0301-0746622). We never ask for your bank password or OTP.</p>`],
    terms: ['Terms & Conditions', `<p>By ordering from THRONE FRAGRANCE you agree to these terms.</p>
      <h3>Orders</h3><p>Prices are in Pakistani Rupees. We confirm every order by call or WhatsApp before dispatch.</p>
      <h3>Delivery</h3><p>Delivery times are estimates (Standard 3–5 working days, Express 1–2 days, Local same / next day). Free shipping over Rs. 5,000 on Standard and Local.</p>
      <h3>Payment</h3><p>Cash on Delivery, Bank Transfer, and JazzCash / EasyPaisa are accepted. No extra fee is charged on any payment method — you only pay the product price and delivery charges.</p>`],
  };
  const [title, body] = pages[kind] || pages.return;
  return `<section class="section info-page"><h2>${title.toUpperCase()}</h2>${body}<p style="margin-top:16px"><a href="#/faq">Back to FAQ →</a></p></section>`;
}

function bankDetails() {
  const accounts = STORE.paymentAccounts.filter((account) => account.type === 'bank');
  if (!accounts.length) return '<div class="gold-note">Bank details will be shared on the confirmation call.</div>';
  return `<div class="gold-note"><strong>Bank transfer details</strong>
    ${accounts.map((account) => `<div class="bank-details">
      <strong>${esc(account.bank_name || account.label)}</strong>
      <div>Account holder: ${esc(account.account_title)}</div>
      ${account.account_number ? `<div>Account number: ${esc(account.account_number)}</div>` : ''}
      ${account.iban ? `<div>IBAN: ${esc(account.iban)}</div>` : ''}
    </div>`).join('')}
  </div>`;
}

function checkoutView() {
  const lines = bagLines();
  if (!lines.length) return '<section class="section"><h2>Your bag is empty</h2><p class="muted">Add a perfume first, then come back to checkout.</p><a class="btn gold" href="#/" style="margin-top:12px;display:inline-block">Shop the Collection</a></section>';
  const sub = bagSubtotal(), disc = bagDiscount();
  const methods = STORE.shippingMethods;
  const ship = methods.find((m) => m.id === Number(checkout.shippingId)) || methods[0];
  const after = sub - disc;
  const fee = ship && ship.free_over != null && after >= ship.free_over ? 0 : (ship ? ship.fee : 300);
  const total = after + fee;
  // Keep the admin-configured list when present, but always include the
  // complete Pakistan city list so checkout never falls back to only 3 cities.
  const configuredCities = (STORE.settings.cities || '').split(',').map((c) => c.trim()).filter(Boolean);
  const cities = [...new Set([...Object.keys(CITY_PROVINCE), ...configuredCities, 'Other'])];
  const accounts = STORE.paymentAccounts.filter((a) => a.type === 'jazzcash' || a.type === 'easypaisa');
  window._cities = cities;
  window._province = '';
  window._city = cities[0] || 'Other';
  return `<section class="section">
    <h1 class="product-title">${esc(STORE.settings.checkout_title || 'Checkout')}</h1>
    <p class="muted">Your total includes the products and delivery. Payment methods carry no additional fee.</p>
    <form id="orderForm" class="form-grid" style="margin-top:18px">
      <div>
        <div class="panel-box"><h3>Delivery Details</h3>
          <div class="field"><label for="customerName">Full name *</label><input id="customerName" name="name" autocomplete="name" required></div>
          <div class="field"><label for="phoneInput">Phone (WhatsApp) *</label><input name="phone" id="phoneInput" autocomplete="tel-national" aria-describedby="phoneError" required placeholder="03xx-xxxxxxx" inputmode="tel" maxlength="12"><div class="field-error" id="phoneError">Phone number must be exactly 11 digits and start with 03 (e.g. 0302-0682098).</div></div>
          <div class="field"><label for="customerEmail">Email (optional)</label><input id="customerEmail" name="email" type="email" autocomplete="email"></div>
          <div class="field"><label for="provinceSelect">Province *</label><select name="province" id="provinceSelect" autocomplete="address-level1" aria-describedby="provinceError" required><option value="">Choose your province…</option>${PROVINCES.map((p) => `<option>${esc(p)}</option>`).join('')}</select><div class="field-error" id="provinceError">Please select your province.</div></div>
          <div class="field"><label for="citySelect">City *</label><select name="city" id="citySelect" autocomplete="address-level2" required>${cities.map((c) => `<option>${esc(c)}</option>`).join('')}</select><input id="customCity" name="custom_city" autocomplete="address-level2" placeholder="Enter your city" hidden></div>
          <div class="field"><label for="customerArea">Area</label><input id="customerArea" name="area" autocomplete="address-level3"></div>
          <div class="field"><label for="customerAddress">Complete address *</label><textarea id="customerAddress" name="address" autocomplete="street-address" rows="2" required></textarea></div>
          <div class="field"><label for="orderNote">Order note (optional)</label><input id="orderNote" name="note"></div>
        </div>
        <div class="panel-box"><h3>Delivery Speed</h3>
          ${methods.map((m) => `<label style="display:block;padding:8px 0"><input type="radio" name="shipping" value="${m.id}" ${ship && m.id === ship.id ? 'checked' : ''} onchange="setShip(${m.id})"> <strong>${esc(m.name)}</strong> — ${money(m.fee)}${m.free_over ? ' · Free over ' + money(m.free_over) : ''} · ${esc(m.eta)}</label>`).join('')}
        </div>
        <div class="panel-box"><h3>Payment Method — No extra fee</h3>
          <div class="pay-cards">
            <button type="button" class="pay-card ${checkout.payment === 'cod' ? 'active' : ''}" aria-pressed="${checkout.payment === 'cod'}" onclick="setPay('cod')">Cash on Delivery</button>
            <button type="button" class="pay-card ${checkout.payment === 'bank' ? 'active' : ''}" aria-pressed="${checkout.payment === 'bank'}" onclick="setPay('bank')">Bank Transfer</button>
            <button type="button" class="pay-card ${checkout.payment === 'wallet' ? 'active' : ''}" aria-pressed="${checkout.payment === 'wallet'}" onclick="setPay('wallet')">JazzCash / EasyPaisa</button>
          </div>
          ${checkout.payment === 'wallet' && accounts.length ? `<div class="gold-note">
            <strong>Send advance to:</strong><br>
            ${accounts.map((a) => `${esc(a.label)} — ${esc(a.account_title)} · <strong>${esc(a.account_number)}</strong> <button type="button" class="btn small" onclick="navigator.clipboard.writeText('${esc(a.account_number)}');alert('Copied')">Copy</button>`).join('<br>')}
            <br><span class="muted">Share the payment screenshot on WhatsApp so we can dispatch faster.</span>
          </div>` : ''}
          ${checkout.payment === 'bank' ? bankDetails() : ''}
        </div>
      </div>
      <div class="panel-box checkout-summary"><h3>Order summary</h3><div class="delivery-note" role="note"><strong>Delivery charges must be paid in advance.</strong><br><span>Cash on delivery is available for the product amount only.</span></div>
        ${lines.map((l) => `<div class="bag-item"><span>${esc(l.name)} × ${l.qty}</span><strong>${money(l.price * l.qty)}</strong></div>`).join('')}
        <p style="margin-top:10px">Subtotal: <strong>${money(sub)}</strong></p>
        ${disc ? `<p>Discount: <strong style="color:var(--gold)">− ${money(disc)}</strong></p>` : ''}
        <p>Delivery (${esc(ship ? ship.name : '')}): <strong>${fee === 0 ? 'FREE' : money(fee)}</strong></p>
        <p style="font-size:18px">Total: <strong style="color:var(--gold)">${money(total)}</strong></p>
        ${ship ? '' : '<p class="muted">Delivery is currently unavailable. Contact us for help.</p>'}
        <button class="btn gold" type="submit" ${ship ? '' : 'disabled'} style="width:100%;margin-top:12px">Place Order · ${money(total)}</button>
        <button class="btn green" type="button" style="width:100%;text-align:center;margin-top:10px" onclick="orderOnWhatsApp()">Order on WhatsApp Instead</button>
      </div>
    </form>
  </section>`;
}
function refreshCheckout(focusSelector) {
  const previousForm = document.getElementById('orderForm');
  const details = previousForm ? new FormData(previousForm) : null;
  render();
  const form = document.getElementById('orderForm');
  if (!form || !details) return;
  for (const name of ['name', 'phone', 'email', 'province', 'city', 'area', 'address', 'note']) {
    const field = form.elements.namedItem(name);
    field.value = details.get(name) || '';
    if (name === 'province' && field.value) field.dispatchEvent(new Event('change'));
  }
  form.querySelector(focusSelector)?.focus({ preventScroll: true });
}
window.setShip = (id) => { checkout.shippingId = id; refreshCheckout('input[name="shipping"]:checked'); };
window.setPay = (payment) => { checkout.payment = payment; refreshCheckout('.pay-card.active'); };

function render() {
  const hash = location.hash || '#/';
  const view = document.getElementById('view');
  if (hash.startsWith('#/product/')) view.innerHTML = productView(hash.replace('#/product/', ''));
  else if (hash === '#/checkout') view.innerHTML = checkoutView();
  else if (hash === '#/track') view.innerHTML = trackView();
  else if (hash === '#/faq') view.innerHTML = faqView();
  else if (hash === '#/contact') view.innerHTML = contactView();
  else if (hash.startsWith('#/policies/')) view.innerHTML = policyView(hash.replace('#/policies/', ''));
  else view.innerHTML = homeView();
  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) {
    const list = document.getElementById('productReviews');
    const endpoint = '/api/reviews/' + encodeURIComponent(reviewForm.dataset.product);
    fetch(endpoint).then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((reviews) => {
      list.innerHTML = reviews.map((review) => `<article class="review-entry"><strong>${esc(review.display_name)}</strong>
        <p class="muted">${review.rating}/5 · Verified purchase</p><p>${esc(review.comment)}</p></article>`).join('') || '<p class="muted">No reviews yet.</p>';
    }).catch(() => { list.textContent = 'Reviews are temporarily unavailable.'; });
    reviewForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const feedback = reviewForm.querySelector('[role="status"]');
      const button = reviewForm.querySelector('button');
      button.disabled = true;
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(reviewForm))) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        feedback.textContent = 'Review submitted for approval.';
        reviewForm.reset();
      } catch (error) {
        feedback.textContent = error.message || 'Review could not be submitted.';
      } finally {
        button.disabled = false;
      }
    });
  }
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.hash === hash) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('offerPromo')?.addEventListener('click', () => {
    promo = STORE.settings.promo_code || 'THRONE10';
    saveBag();
    openDrawer();
  });
  // Phone auto-format + validation (checkout)
  const phoneInput = document.getElementById('phoneInput');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = formatPhoneInput(phoneInput.value);
      const ok = phoneIsValid(phoneInput.value) || phoneInput.value.length < 11;
      phoneInput.classList.toggle('invalid', !ok && phoneInput.value.length > 0);
      document.getElementById('phoneError')?.classList.toggle('show', !phoneIsValid(phoneInput.value) && phoneInput.value.length > 0);
    });
    phoneInput.addEventListener('blur', () => {
      const ok = phoneIsValid(phoneInput.value);
      phoneInput.classList.toggle('invalid', !ok);
      document.getElementById('phoneError')?.classList.toggle('show', !ok);
    });
  }
  // Province <-> City wiring
  const prov = document.getElementById('provinceSelect');
  const citySel = document.getElementById('citySelect');
  if (prov && citySel) {
    const reorderCities = (province) => {
      const all = window._cities || [];
      const first = all.filter((c) => CITY_PROVINCE[c] === province);
      const rest = all.filter((c) => CITY_PROVINCE[c] !== province);
      const ordered = [...first, ...rest];
      const cur = citySel.value;
      citySel.innerHTML = ordered.map((c) => `<option>${esc(c)}</option>`).join('');
      if (ordered.includes(cur)) citySel.value = cur;
    };
    prov.addEventListener('change', () => {
      window._province = prov.value;
      document.getElementById('provinceError')?.classList.remove('show');
      reorderCities(prov.value);
    });
    citySel.addEventListener('change', () => {
      const customCity = document.getElementById('customCity');
      const isOther = citySel.value === 'Other';
      if (customCity) { customCity.hidden = !isOther; customCity.required = isOther; if (!isOther) customCity.value = ''; }
      const p = CITY_PROVINCE[citySel.value];
      if (p) { prov.value = p; window._province = p; reorderCities(p); }
    });
    citySel.dispatchEvent(new Event('change'));
  }
  // Track order form
  const trackForm = document.getElementById('trackForm');
  if (trackForm) trackForm.addEventListener('submit', trackOrderSubmit);
  const trackPhone = document.getElementById('trackPhone');
  if (trackPhone) trackPhone.addEventListener('input', () => { trackPhone.value = formatPhoneInput(trackPhone.value); });
  // Contact form -> WhatsApp
  const contactForm = document.getElementById('contactForm');
  if (contactForm) contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const text = `Hi Throne Fragrance, I am ${fd.get('name')}. ${fd.get('message')}`;
    window.open('https://wa.me/923020682098?text=' + encodeURIComponent(text), '_blank');
  });
  const form = document.getElementById('orderForm');
  if (form) form.addEventListener('submit', placeOrder);
  updateBagCount();
  const collection = document.getElementById('collectionGrid');
  if (!collection) return;
  const updateCollection = () => { collection.innerHTML = collectionCards(); };
  document.getElementById('q').addEventListener('input', (event) => { search = event.target.value; updateCollection(); });
  document.getElementById('maxP').addEventListener('change', (event) => { maxPrice = Number(event.target.value); updateCollection(); });
  document.getElementById('sortSel').addEventListener('change', (event) => { sort = event.target.value; updateCollection(); });
  const filters = document.querySelectorAll('[data-fam]');
  filters.forEach((button) => button.addEventListener('click', () => {
    family = button.dataset.fam;
    filters.forEach((filter) => {
      filter.classList.toggle('active', filter === button);
      filter.setAttribute('aria-pressed', filter === button);
    });
    updateCollection();
  }));
}

async function trackOrderSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const phone = fd.get('phone');
  if (!phoneIsValid(phone)) { document.getElementById('trackPhoneError')?.classList.add('show'); return; }
  const box = document.getElementById('trackResult');
  const button = e.currentTarget.querySelector('button[type="submit"]');
  let r, d;
  button.disabled = true;
  box.textContent = 'Checking your order and shipment status…';
  try {
    r = await fetch('/api/track-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: fd.get('ref'), phone }) });
    d = await r.json();
  } catch {
    box.textContent = 'Tracking is temporarily unavailable. Please try again.';
    return;
  } finally {
    button.disabled = false;
  }
  if (!r.ok) { box.innerHTML = `<p style="color:var(--red)">${esc(d.error || 'Could not track this order.')}</p>`; return; }
  if (!d.found) { box.innerHTML = '<p><strong>Order not found.</strong> Check your TF- reference and phone number and try again.</p>'; return; }
  const o = d.order;
  const steps = ['new', 'confirmed', 'dispatched', 'delivered'];
  const idx = steps.indexOf(o.status);
  box.innerHTML = `<div class="panel-box"><h3>${esc(o.ref)} — ${esc(o.status.toUpperCase())}</h3>
    <div class="status-steps">${steps.map((s, i) => `<span class="${i <= idx ? 'done' : ''}">${s}</span>`).join('')}</div>
    <p>Items: ${o.items.map((i) => esc(i.name) + ' × ' + i.qty).join(', ')}</p>
    <p>Total: <strong>${money(o.total)}</strong></p>
    <p>Deliver to: <strong>${esc(o.city)}${o.province ? ', ' + esc(o.province) : ''}</strong></p>
    ${o.courier_tracking ? `<p>${esc(o.courier_name)} tracking: <strong>${esc(o.courier_tracking)}</strong></p>` : ''}
    ${o.courier_status ? `<p>${o.courier_live ? 'Live PostEx status' : 'Last saved courier status'}: <strong>${esc(o.courier_status)}</strong></p>` : ''}
    ${o.courier_tracking && !o.courier_live ? '<p class="muted">Live courier status is currently unavailable. Try Track Order again shortly.</p>' : ''}
    ${!o.courier_tracking ? '<p class="muted">Courier tracking will appear after a shipment number is added.</p>' : ''}</div>`;
}
window.orderOnWhatsApp = () => {
  const phoneInput = document.getElementById('phoneInput');
  const phone = phoneInput ? phoneInput.value : '';
  if (!phoneIsValid(phone)) {
    phoneInput?.classList.add('invalid');
    document.getElementById('phoneError')?.classList.add('show');
    phoneInput?.focus();
    return;
  }
  const lines = bagLines();
  const sub = bagSubtotal(), disc = bagDiscount();
  const ship = STORE.shippingMethods.find((m) => m.id === Number(checkout.shippingId)) || STORE.shippingMethods[0];
  const after = sub - disc;
  const fee = ship && ship.free_over != null && after >= ship.free_over ? 0 : (ship ? ship.fee : 300);
  const province = document.getElementById('provinceSelect')?.value || '';
  const city = document.getElementById('citySelect')?.value === 'Other'
    ? (document.getElementById('customCity')?.value || '')
    : (document.getElementById('citySelect')?.value || '');
  const text = `Hi Throne Fragrance, I want to order: ${lines.map((l) => l.name + ' x' + l.qty).join(', ')} — Total ${money(after + fee)} · Phone ${normalizePhone(phone)}${province ? ' · ' + province : ''}${city ? ', ' + city : ''}`;
  window.open('https://wa.me/923020682098?text=' + encodeURIComponent(text), '_blank');
};

async function placeOrder(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const phone = fd.get('phone');
  const province = fd.get('province');
  if (!phoneIsValid(phone)) {
    document.getElementById('phoneInput')?.classList.add('invalid');
    document.getElementById('phoneError')?.classList.add('show');
    return;
  }
  if (!province) { document.getElementById('provinceError')?.classList.add('show'); return; }
  const shipId = Number(document.querySelector('input[name="shipping"]:checked')?.value || checkout.shippingId || 1);
  const city = fd.get('city') === 'Other' ? String(fd.get('custom_city') || '').trim() : String(fd.get('city') || '');
  if (!city) { document.getElementById('customCity')?.focus(); return; }
  const payload = {
    name: fd.get('name'), phone: normalizePhone(phone), email: fd.get('email'), province, city,
    area: fd.get('area'), address: fd.get('address'), note: fd.get('note'),
    items: bagLines().map((i) => ({ slug: i.slug, qty: i.qty })),
    promo, shipping_id: shipId, payment: checkout.payment,
  };
  const submit = e.target.querySelector('[type=submit]');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  let d;
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    d = await r.json();
    if (!r.ok) { alert(d.error || 'Order failed'); return; }
  } catch {
    alert('Could not confirm the order. Please contact us before trying again.');
    return;
  } finally {
    if (submit) submit.disabled = false;
  }
  const lines = bagLines();
  const total = d.total;
  window.thronePixel.track('Purchase', { currency: 'PKR', value: total });
  bag = []; promo = ''; saveBag(); closeDrawer();
  document.getElementById('view').innerHTML = `<section class="confirm">
    <div class="tick">✓</div>
    <h2>Shukriya! Your order is placed.</h2>
    <div class="ref">${esc(d.ref)}</div>
    <p class="muted">${esc(STORE.settings.success_message || '')}</p>
    <div class="summary-box" style="margin-top:18px">
      <div><span>Name</span><strong>${esc(payload.name)}</strong></div>
      <div><span>Phone</span><strong>${esc(payload.phone)}</strong></div>
      <div><span>Deliver to</span><strong>${esc(payload.city)}${payload.province ? ', ' + esc(payload.province) : ''}</strong></div>
      <div><span>Items</span><strong>${lines.map((l) => esc(l.name) + ' × ' + l.qty).join(', ')}</strong></div>
      <div><span>Payment</span><strong>${checkout.payment === 'cod' ? 'Cash on Delivery' : checkout.payment === 'bank' ? 'Bank Transfer' : 'JazzCash / EasyPaisa'}</strong></div>
      <div><span>Total to pay</span><strong style="color:var(--gold)">${money(total)}</strong></div>
    </div>
    <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="btn green" href="https://wa.me/923020682098?text=${encodeURIComponent('Hi, my order ' + d.ref + ' is placed. Please confirm.')}" target="_blank" rel="noopener">Confirm on WhatsApp</a>
      <a class="btn gold" href="#/">Continue Shopping</a>
    </div>
  </section>`;
  window.scrollTo(0, 0);
}

const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const mobileNav = document.getElementById('mobileNav');
mobileNav.append(...Array.from(document.querySelectorAll('#siteNav a'), (link) => link.cloneNode(true)));
menuToggle.addEventListener('click', () => {
  if (mobileMenu.open) return;
  mobileMenu.showModal();
  menuToggle.setAttribute('aria-expanded', 'true');
});
document.getElementById('mobileMenuClose').addEventListener('click', () => mobileMenu.close());
mobileNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) mobileMenu.close();
});
mobileMenu.addEventListener('click', (event) => {
  if (event.target === mobileMenu && event.clientX >= mobileMenu.getBoundingClientRect().right) mobileMenu.close();
});
mobileMenu.addEventListener('close', () => menuToggle.setAttribute('aria-expanded', 'false'));
window.matchMedia('(max-width: 900px)').addEventListener('change', (event) => {
  if (!event.matches && mobileMenu.open) mobileMenu.close();
});
document.getElementById('bagBtn').addEventListener('click', openDrawer);
document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
document.getElementById('checkoutBtn').addEventListener('click', () => {
  closeDrawer();
  if (location.hash === '#/checkout') refreshCheckout('button[type="submit"]');
  else location.hash = '#/checkout';
});
document.getElementById('promoBtn').addEventListener('click', () => {
  const code = document.getElementById('promoInput').value.trim().toUpperCase();
  const isValid = window.orderDiscount.promoAvailable(bagLines(), code, STORE.settings);
  promo = isValid ? code : '';
  saveBag();
  document.getElementById('promoStatus').textContent = code ? (isValid ? 'Promo code applied.' : 'Check the promo code and minimum subtotal.') : '';
});
function renderRoute() {
  render();
  const view = document.getElementById('view');
  view.classList.remove('page-enter');
  void view.offsetWidth;
  view.classList.add('page-enter');
  if (location.hash.startsWith('#/product/')) window.thronePixel.track('ViewContent');
  if (location.hash === '#/checkout' && bagLines().length) {
    window.thronePixel.track('InitiateCheckout', { currency: 'PKR', value: bagSubtotal() - bagDiscount() });
  }
  const section = document.getElementById(location.hash.slice(2));
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo(0, 0);
}
window.addEventListener('hashchange', renderRoute);
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('view').focus();
});
document.getElementById('view').addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.fallback) {
    image.src = image.dataset.fallback;
    delete image.dataset.fallback;
  } else image.remove();
}, true);
document.getElementById('view').addEventListener('click', (event) => {
  const button = event.target.closest('[data-add-product]');
  if (button) addToBag(button.dataset.addProduct);
});
loadStore().catch(() => {
  document.getElementById('view').innerHTML = '<p class="store-message" role="alert">The collection could not be loaded. Refresh the page to try again.</p>';
});
