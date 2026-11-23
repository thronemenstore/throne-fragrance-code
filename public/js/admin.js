// THRONE FRAGRANCE — Admin panel (plain JS)
// Writes to the SAME SQLite database the storefront reads, so changes are live.
let ADMIN = { products: [], orders: [], settings: {}, shippingMethods: [], paymentAccounts: [] };
let tab = 'products';
let orderFilter = 'all';
const orderStatuses = ['new', 'confirmed', 'dispatched', 'delivered', 'cancelled'];
const $ = (s) => document.querySelector(s);
document.getElementById('adminLogout')?.addEventListener('click', async () => {
  const button = document.getElementById('adminLogout');
  button.disabled = true;
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    // Remove the client-visible cookie as a fallback, then force a fresh login page.
    document.cookie = 'throne_admin=; Max-Age=0; Path=/';
    location.replace('/admin?logged-out=' + Date.now());
  }
});
const money = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-PK');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function load() {
  try {
    const response = await fetch('/api/admin');
    if (!response.ok) throw new Error();
    ADMIN = await response.json();
    render();
  } catch {
    $('#adminView').innerHTML = '<p class="panel-box" role="alert">Store data could not be loaded. Refresh the page to try again.</p>';
  }
}
function render() {
  const revenue = ADMIN.orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  $('#stats').innerHTML = `
    <div class="stat"><span class="muted">Total orders</span><b>${ADMIN.orders.length}</b></div>
    <div class="stat"><span class="muted">Active order value</span><b>${money(revenue)}</b></div>
    <div class="stat"><span class="muted">Live products</span><b>${ADMIN.products.filter((p) => p.is_live).length}</b></div>
    <div class="stat"><span class="muted">Payment accounts</span><b>${ADMIN.paymentAccounts.length}</b></div>`;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const selected = button.dataset.tab === tab;
    button.classList.toggle('gold', selected);
    button.setAttribute('aria-pressed', selected);
  });
  const v = $('#adminView');
  if (tab === 'products') {
    v.innerHTML = `<div class="panel-box"><h3>Products — edit price / stock, Save, storefront updates live</h3>
      <div class="table-scroll" tabindex="0"><table><tr><th>Product</th><th>Price (Rs.)</th><th>Stock</th><th>Live?</th><th></th></tr>
      ${ADMIN.products.map((p) => `<tr>
        <td><strong>${esc(p.name)}</strong><br><span class="muted">${esc(p.family)} · ${esc(p.notes)}</span></td>
        <td><input type="number" id="price-${p.id}" value="${p.price}" style="width:110px"></td>
        <td><input type="number" id="stock-${p.id}" value="${p.stock ?? ''}" placeholder="—" style="width:80px"></td>
        <td><input type="checkbox" id="live-${p.id}" ${p.is_live ? 'checked' : ''}></td>
        <td><button class="btn gold small" onclick="saveProduct(${p.id})">Save</button></td>
      </tr>`).join('')}</table></div></div>`;
  } else if (tab === 'orders') {
    const filters = [['all', 'All orders'], ...orderStatuses.map((status) => [status, status[0].toUpperCase() + status.slice(1)])];
    const counts = new Map();
    for (const order of ADMIN.orders) counts.set(order.status, (counts.get(order.status) || 0) + 1);
    v.innerHTML = `<div class="panel-box"><h3>Orders</h3>
      <div class="order-filters" role="group" aria-label="Filter orders by status">
        ${filters.map(([status, label]) => `<button class="btn small" type="button" data-order-filter="${status}">
          ${label} <span>${status === 'all' ? ADMIN.orders.length : counts.get(status) || 0}</span>
        </button>`).join('')}
      </div>
      ${ADMIN.orders.length ? `<div class="table-scroll" tabindex="0"><table><tr><th>Ref</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>PostEx</th><th>Slip</th></tr>
      ${ADMIN.orders.map((o) => `<tr data-order-status="${esc(o.status)}">
        <td><strong>${esc(o.ref)}</strong><br><span class="muted">${esc(o.created_at.slice(0, 10))}</span></td>
        <td>${esc(o.customer_name)}<br><span class="muted">${esc(o.phone)}<br>${[o.address, o.area, o.city, o.province].filter(Boolean).map(esc).join(', ')}</span></td>
        <td>${o.items.map((i) => esc(i.name) + ' × ' + i.qty).join('<br>')}</td>
        <td><strong>${money(o.total)}</strong><br><span class="muted">Advance ${money(o.advance_paid)} · Remaining ${money(o.total - o.advance_paid)}</span></td>
        <td>${esc(o.payment_method)}<br><span class="muted">${esc(o.shipping_method)}</span></td>
        <td><select onchange="setStatus(${o.id}, this.value)">
          ${orderStatuses.map((s) => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></td>
        <td><form class="shipment-form" data-order-id="${o.id}">
          <input name="tracking" value="${esc(o.courier_tracking)}" placeholder="Tracking number" aria-label="PostEx tracking number" maxlength="80">
          <button class="btn small" type="submit">Save</button>
          ${o.courier_tracking && ADMIN.postexConfigured ? `<button class="btn small" type="button" data-refresh-shipment="${o.id}">Refresh status</button>` : ''}
          ${o.courier_status ? `<p class="muted">${esc(o.courier_status)}</p>` : ''}
        </form></td>
        <td><div class="shipment-form">
          ${o.has_courier_label ? `<a class="btn small" href="/api/admin/shipments/${o.id}/label">Download PostEx slip</a>` : ''}
          ${ADMIN.postexConfigured && !o.has_courier_label && o.status !== 'cancelled' && !o.postex_booking_pending ? `<button type="button" class="btn gold small" data-book-label="${o.id}">${o.courier_tracking ? 'Get PostEx slip' : 'Confirm address &amp; book'}</button>` : ''}
          ${o.postex_booking_pending ? `<p class="muted">Check booking in PostEx</p><button type="button" class="btn small" data-reset-booking="${o.id}">Clear unverified booking</button>` : ''}
          ${o.courier_tracking ? `<button class="btn small" type="button" data-pick-label>
            ${o.has_courier_label ? 'Replace PDF' : 'Attach PostEx PDF'}</button>
            <input type="file" accept="application/pdf,.pdf" data-label-order="${o.id}" hidden>
          ` : ''}
          <a class="text-link" href="https://merchant.postex.pk/login" target="_blank" rel="noopener">PostEx portal</a>
        </div></td>
      </tr>`).join('')}</table></div>` : ''}
      <p class="muted" id="orderFilterEmpty" role="status" hidden></p></div>
      <div class="panel-box"><h3>Record a manual order (WhatsApp / phone / walk-in)</h3>
        <div class="field"><label>Customer name *</label><input id="mo-name"></div>
        <div class="field"><label>Phone — exactly 11 digits, starts with 03 *</label><input id="mo-phone" placeholder="03xx-xxxxxxx" maxlength="12"><div class="field-error" id="mo-phone-error">Phone number must be exactly 11 digits and start with 03.</div></div>
        <div class="field"><label>Province *</label><select id="mo-province"><option value="">Choose province…</option>${['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Jammu & Kashmir', 'Islamabad Capital Territory'].map((p) => `<option>${p}</option>`).join('')}</select></div>
        <div class="field"><label>City *</label><input id="mo-city" placeholder="e.g. Faisalabad"></div>
        <div class="field"><label>Address *</label><input id="mo-address"></div>
        <div class="field"><label>Product</label><select id="mo-product">${ADMIN.products.map((p) => `<option value="${p.slug}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select></div>
        <div class="field"><label>Quantity</label><input id="mo-qty" type="number" value="1" min="1"></div>
        <button class="btn gold" onclick="addManualOrder()">+ Record Order</button>
        <p class="muted" id="mo-msg" style="margin-top:8px"></p></div>`;
  } else if (tab === 'shipping') {
    v.innerHTML = `<div class="panel-box"><h3>Shipping Methods</h3>
      <div class="table-scroll" tabindex="0"><table><tr><th>Name</th><th>Fee</th><th>Free over</th><th>ETA</th><th></th></tr>
      ${ADMIN.shippingMethods.map((m) => `<tr>
        <td><input id="ship-name-${m.id}" value="${esc(m.name)}"></td>
        <td><input type="number" id="ship-fee-${m.id}" value="${m.fee}" style="width:90px"></td>
        <td><input type="number" id="ship-free-${m.id}" value="${m.free_over ?? ''}" placeholder="—" style="width:90px"></td>
        <td><input id="ship-eta-${m.id}" value="${esc(m.eta)}" style="width:140px"></td>
        <td><button class="btn gold small" onclick="saveShip(${m.id})">Save</button></td>
      </tr>`).join('')}</table></div></div>`;
  } else if (tab === 'accounts') {
    v.innerHTML = `<div class="panel-box"><h3>Advance Payment Accounts</h3>
      ${ADMIN.paymentAccounts.map((a) => {
        const name = a.label || a.bank_name || a.type || 'Unnamed account';
        return `<div class="bag-item account-row">
          <div><strong>${esc(name)}</strong>${a.account_title ? ' — ' + esc(a.account_title) : ''}<br><span class="muted">${[a.bank_name, a.account_number, a.iban].filter(Boolean).map(esc).join(' · ')}</span></div>
          <button class="btn small account-delete" type="button" data-delete-account="${a.id}" aria-label="Delete ${esc(name)}">Delete</button>
        </div>`;
      }).join('') || '<p class="muted">No payment accounts yet.</p>'}
      <h4 style="margin-top:16px">Add account</h4>
      <form id="accountForm">
        <div class="field"><label for="acc-type">Account type</label><select id="acc-type" name="type"><option value="jazzcash">JazzCash</option><option value="easypaisa">EasyPaisa</option><option value="bank">Bank Transfer</option></select></div>
        <div class="field" id="bankNameField" hidden><label for="acc-bank">Bank name</label><input id="acc-bank" name="bank_name" disabled></div>
        <div class="field"><label for="acc-title">Account holder name</label><input id="acc-title" name="account_title" required></div>
        <div class="field"><label for="acc-num">Account number</label><input id="acc-num" name="account_number" required></div>
        <div class="field" id="ibanField" hidden><label for="acc-iban">IBAN</label><input id="acc-iban" name="iban" disabled></div>
        <button class="btn gold small" type="submit">Add account</button>
      </form></div>`;
    const form = $('#accountForm');
    form.elements.type.addEventListener('change', () => {
      const bank = form.elements.type.value === 'bank';
      $('#bankNameField').hidden = $('#ibanField').hidden = !bank;
      form.elements.bank_name.disabled = form.elements.iban.disabled = !bank;
      form.elements.bank_name.required = bank;
      form.elements.account_number.required = !bank;
    });
    form.addEventListener('submit', addAccount);
    v.querySelectorAll('[data-delete-account]').forEach((button) => button.addEventListener('click', deleteAccount));
  } else if (tab === 'discounts') {
    v.innerHTML = `<div class="panel-box"><h3>Discounts &amp; offers</h3>
      <form class="settings-form">
        <label><input type="checkbox" name="promo_enabled" ${ADMIN.settings.promo_enabled !== '0' ? 'checked' : ''}> Enable promo code</label>
        <div class="field"><label for="promoCode">Promo code</label><input id="promoCode" name="promo_code" value="${esc(ADMIN.settings.promo_code || 'THRONE10')}" required maxlength="40"></div>
        <div class="field"><label for="promoPercent">Promo discount (%)</label><input id="promoPercent" type="number" name="promo_percent" min="0" max="100" step="0.01" value="${esc(ADMIN.settings.promo_percent || 10)}" required></div>
        <div class="field"><label for="promoMinimum">Minimum subtotal (Rs.)</label><input id="promoMinimum" type="number" name="promo_minimum" min="0" value="${esc(ADMIN.settings.promo_minimum || 0)}" required></div>
        <label><input type="checkbox" name="bundle_enabled" ${ADMIN.settings.bundle_enabled !== '0' ? 'checked' : ''}> Enable signature trio offer</label>
        <div class="field"><label for="bundlePercent">Trio discount (%)</label><input id="bundlePercent" type="number" name="bundle_discount_percent" min="0" max="100" step="0.01" value="${esc(ADMIN.settings.bundle_discount_percent || 20)}" required></div>
        <button class="btn gold" type="submit">Save discounts</button>
      </form></div>`;
  } else if (tab === 'customers') {
    const customers = new Map();
    for (const order of ADMIN.orders) {
      const customer = customers.get(order.phone) || { ...order, count: 0, spend: 0 };
      customer.count++;
      if (order.status === 'delivered') customer.spend += order.total;
      customers.set(order.phone, customer);
    }
    v.innerHTML = `<div class="panel-box"><h3>Customers</h3>
      <div class="field"><label for="customerSearch">Search by name, phone, email or city</label><input id="customerSearch" type="search"></div>
      <div class="table-scroll"><table><tr><th>Customer</th><th>Contact</th><th>Latest address</th><th>Orders</th><th>Delivered order value</th></tr>
      ${Array.from(customers.values(), (customer) => `<tr data-customer>
        <td>${esc(customer.customer_name)}</td><td>${esc(customer.phone)}<br>${esc(customer.email)}</td>
        <td>${esc([customer.address, customer.city, customer.province].filter(Boolean).join(', '))}</td>
        <td>${customer.count}</td><td>${money(customer.spend)}</td>
      </tr>`).join('')}</table></div>
      <p class="muted" id="customerEmpty" ${customers.size ? 'hidden' : ''}>No customers found.</p>
    </div>`;
    $('#customerSearch').addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      let matches = 0;
      v.querySelectorAll('[data-customer]').forEach((row) => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
        if (!row.hidden) matches++;
      });
      $('#customerEmpty').hidden = matches > 0;
    });
  } else if (tab === 'reviews') {
    v.innerHTML = `<div class="panel-box"><h3>Product reviews</h3>
      ${ADMIN.reviews.map((review) => `<article class="review-entry"><strong>${esc(review.display_name)}</strong>
        <p class="muted">${esc(review.product_slug)} · ${review.rating}/5</p><p>${esc(review.comment)}</p>
        <label>Status <select data-review="${review.id}">${['pending', 'approved', 'rejected'].map((status) => `<option ${review.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
      </article>`).join('') || '<p class="muted">No reviews submitted yet.</p>'}
    </div>`;
  } else if (tab === 'integrations') {
    v.innerHTML = `<div class="panel-box"><h3>PostEx</h3>
      <p>Save a PostEx tracking number from the Orders tab. It appears on the customer’s Track Order page.</p>
      <a class="text-link" href="https://merchant.postex.pk/login" target="_blank" rel="noopener">Open PostEx merchant portal</a>
      <p class="muted">${ADMIN.postexConfigured ? 'API token is configured. Test it with a tracking number from your PostEx merchant account.' : 'Set POSTEX_TOKEN on the server and restart to enable API status refresh.'}</p>
      ${ADMIN.postexConfigured ? `<form id="postexCheck" class="settings-form">
        <div class="field"><label for="postexTracking">PostEx tracking number</label><input id="postexTracking" name="tracking" maxlength="80" required></div>
        <button type="submit" class="btn small">Test connection</button>
        <p role="status" class="muted"></p>
      </form>` : ''}
    </div>
    <div class="panel-box"><h3>Meta Pixel</h3>
      <form class="settings-form">
        <div class="field"><label for="pixelId">Pixel ID</label><input id="pixelId" name="meta_pixel_id" inputmode="numeric" pattern="[0-9]{5,30}" value="${esc(ADMIN.settings.meta_pixel_id || '')}"></div>
        <p class="muted">Leave empty to disable. Tracking starts after the customer enables marketing cookies.</p>
        <button class="btn gold" type="submit">Save Pixel ID</button>
      </form>
    </div>`;
  } else {
    const s = ADMIN.settings;
    v.innerHTML = `<div class="panel-box"><h3>Settings</h3>
      <div class="field"><label>WhatsApp number</label><input id="set-whatsapp" value="${esc(s.whatsapp || '')}"></div>
      <div class="field"><label>Instagram URL</label><input id="set-instagram" value="${esc(s.instagram || '')}"></div>
      <div class="field"><label>Free shipping over (Rs.)</label><input id="set-free_ship_threshold" value="${esc(s.free_ship_threshold || '')}"></div>
      <div class="field"><label>Announcement bar</label><input id="set-announcement" value="${esc(s.announcement || '')}"></div>
      <button class="btn gold" onclick="saveSettings()">Save Settings</button></div>`;
  }
  const orderFilters = v.querySelectorAll('[data-order-filter]');
  if (orderFilters.length) {
    const applyFilter = () => {
      orderFilters.forEach((button) => {
        const selected = button.dataset.orderFilter === orderFilter;
        button.classList.toggle('gold', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      let visible = 0;
      v.querySelectorAll('[data-order-status]').forEach((row) => {
        row.hidden = orderFilter !== 'all' && row.dataset.orderStatus !== orderFilter;
        if (!row.hidden) visible++;
      });
      const empty = v.querySelector('#orderFilterEmpty');
      empty.hidden = visible > 0;
      empty.textContent = orderFilter === 'all' ? 'No orders yet.' : 'No ' + orderFilter + ' orders.';
    };
    orderFilters.forEach((button) => button.addEventListener('click', () => {
      orderFilter = button.dataset.orderFilter;
      applyFilter();
    }));
    applyFilter();
  }
  v.querySelector('.settings-form:not(#postexCheck)')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    form.querySelectorAll('[type="checkbox"]').forEach((field) => { data[field.name] = field.checked ? '1' : '0'; });
    saveManagement('/api/admin/settings', 'POST', data, true);
  });
  v.querySelector('#postexCheck')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const feedback = form.querySelector('[role="status"]');
    const button = form.querySelector('button');
    button.disabled = true;
    feedback.textContent = 'Checking PostEx…';
    try {
      const response = await fetch('/api/admin/postex/check', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json();
      feedback.textContent = response.ok ? 'Connection verified. Shipment status: ' + result.status : result.error;
    } catch {
      feedback.textContent = 'Could not complete the connection test. Try again.';
    } finally {
      button.disabled = false;
    }
  });
  v.querySelectorAll('[data-review]').forEach((field) => field.addEventListener('change', () =>
    saveManagement('/api/admin/reviews/' + field.dataset.review, 'PATCH', { status: field.value }, true)));
  v.querySelectorAll('.shipment-form').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveManagement('/api/admin/shipments/' + form.dataset.orderId, 'PATCH', Object.fromEntries(new FormData(form)), true);
  }));
  v.querySelectorAll('[data-refresh-shipment]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    await saveManagement('/api/admin/shipments/' + button.dataset.refreshShipment + '/refresh', 'POST', {}, true);
    button.disabled = false;
  }));
  v.querySelectorAll('[data-pick-label]').forEach((button) => button.addEventListener('click', () => button.nextElementSibling.click()));
  v.querySelectorAll('[data-book-label]').forEach((button) => button.addEventListener('click', async () => {
    const order = ADMIN.orders.find((item) => String(item.id) === button.dataset.bookLabel);
    if (!order) return;
    const address = [order.address, order.area, order.city, order.province].filter(Boolean).join(', ');
    const due = Math.max(0, order.total - order.advance_paid);
    if (!order.courier_tracking && !confirm('Book one parcel with PostEx?\n\n' + order.customer_name + '\n' + order.phone + '\n' + address + '\n\nAmount to collect: ' + money(due))) return;
    button.disabled = true;
    const result = await saveManagement('/api/admin/shipments/' + order.id + '/book-label', 'POST', {
      addressConfirmed: true, address: order.address, city: order.city, area: order.area, province: order.province,
    });
    if (result?.download) {
      const link = document.createElement('a');
      link.href = result.download;
      link.download = '';
      document.body.append(link);
      link.click();
      link.remove();
    }
    await load();
  }));
  v.querySelectorAll('[data-reset-booking]').forEach((button) => button.addEventListener('click', () => {
    if (confirm('Have you checked the PostEx portal and confirmed that no shipment exists for this order reference?')) {
      saveManagement('/api/admin/shipments/' + button.dataset.resetBooking + '/reset-booking', 'POST', { checkedPortal: true }, true);
    }
  }));
  v.querySelectorAll('[data-label-order]').forEach((input) => input.addEventListener('change', () => {
    const file = input.files[0];
    const order = ADMIN.orders.find((item) => String(item.id) === input.dataset.labelOrder);
    if (!file || !order) return;
    if (file.size > 3 * 1024 * 1024) { alert('Select a PDF under 3 MB.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => saveManagement('/api/admin/shipments/' + order.id + '/label', 'PUT', {
      tracking: order.courier_tracking, pdf: reader.result.split(',')[1],
    }, true);
    reader.onerror = () => alert('Could not read the PDF.');
    reader.readAsDataURL(file);
    input.value = '';
  }));
  v.querySelectorAll('table').forEach((table) => {
    const labels = Array.from(table.rows[0].cells, (cell) => cell.textContent);
    for (const row of Array.from(table.rows).slice(1)) {
      Array.from(row.cells).forEach((cell, index) => {
        const label = labels[index];
        cell.dataset.label = label;
        const control = cell.querySelector('input, select');
        if (control && label) control.setAttribute('aria-label', label);
      });
    }
  });
}
async function saveManagement(url, method, body, refresh = false) {
  try {
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not save changes.');
    if (refresh) await load();
    return result;
  } catch (error) {
    alert(error.message);
  }
}
window.saveProduct = async (id) => {
  const price = Number(document.getElementById('price-' + id).value);
  const stockVal = document.getElementById('stock-' + id).value;
  const isLive = document.getElementById('live-' + id).checked;
  const r = await fetch('/api/admin/products/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ price, stock: stockVal === '' ? null : Number(stockVal), is_live: isLive }) });
  if (r.ok) { alert('Saved — the storefront now shows the new price. Refresh the store tab to see it.'); load(); }
  else alert('Save failed');
};
window.addManualOrder = async () => {
  const phoneRaw = document.getElementById('mo-phone').value;
  const digits = phoneRaw.replace(/\D/g, '');
  const ok = digits.length === 11 && digits.startsWith('03');
  document.getElementById('mo-phone-error')?.classList.toggle('show', !ok);
  if (!ok) return;
  const body = {
    name: document.getElementById('mo-name').value, phone: phoneRaw,
    province: document.getElementById('mo-province').value,
    city: document.getElementById('mo-city').value, address: document.getElementById('mo-address').value,
    items: [{ slug: document.getElementById('mo-product').value, qty: Number(document.getElementById('mo-qty').value) || 1 }],
    shipping_id: 1, payment: 'cod',
  };
  const r = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  document.getElementById('mo-msg').textContent = r.ok ? 'Order recorded: ' + d.ref + ' — Total ' + money(d.total) : (d.error || 'Failed');
  if (r.ok) load();
};
window.setStatus = async (id, status) => {
  const response = await fetch('/api/orders/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  if (!response.ok) alert((await response.json()).error || 'Could not update order status.');
  load();
};
window.saveShip = async (id) => {
  await fetch('/api/admin/shipping', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name: document.getElementById('ship-name-' + id).value,
      fee: Number(document.getElementById('ship-fee-' + id).value),
      free_over: document.getElementById('ship-free-' + id).value === '' ? null : Number(document.getElementById('ship-free-' + id).value),
      eta: document.getElementById('ship-eta-' + id).value }) });
  alert('Shipping saved.'); load();
};
async function addAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, value.trim()]));
  body.label = body.type === 'bank' ? body.bank_name : (body.type === 'jazzcash' ? 'JazzCash' : 'EasyPaisa');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const response = await fetch('/api/admin/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error((await response.json()).error || 'Account could not be saved.');
    await load();
  } catch (error) {
    alert(error.message || 'Account could not be saved.');
  } finally {
    button.disabled = false;
  }
}
async function deleteAccount(event) {
  const button = event.currentTarget;
  const account = ADMIN.paymentAccounts.find((item) => String(item.id) === button.dataset.deleteAccount);
  if (!account) return;
  const name = account.label || account.bank_name || account.type || 'Unnamed account';
  if (!confirm('Delete ' + name + ' from payment accounts?')) return;
  button.disabled = true;
  try {
    const response = await fetch('/api/admin/accounts/' + account.id, { method: 'DELETE' });
    if (!response.ok) throw new Error((await response.json()).error || 'Account could not be deleted.');
    await load();
  } catch (error) {
    alert(error.message || 'Account could not be deleted.');
  } finally {
    button.disabled = false;
  }
}
window.saveSettings = async () => {
  const body = {};
  ['whatsapp', 'instagram', 'free_ship_threshold', 'announcement']
    .forEach((k) => { body[k] = document.getElementById('set-' + k).value; });
  const response = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { alert((await response.json()).error || 'Settings could not be saved.'); return; }
  alert('Settings saved.'); load();
};
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
load();
