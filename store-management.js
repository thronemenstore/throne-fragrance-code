const postexBase = 'https://api.postex.pk/services/integration/api/order/';
const trackingPattern = /^[A-Za-z0-9 -]{3,80}$/;

module.exports = function registerStoreManagement({ app, db, normalizePhone }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_slug TEXT NOT NULL,
      display_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (order_id, product_slug)
    );
    CREATE TABLE IF NOT EXISTS courier_labels (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id),
      tracking TEXT NOT NULL,
      pdf BLOB NOT NULL
    );
  `);
  const columns = db.pragma('table_info(orders)').map((column) => column.name);
  for (const name of ['courier_name', 'courier_tracking', 'courier_status']) {
    if (!columns.includes(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
  }
  if (!columns.includes('postex_booking_pending')) db.exec('ALTER TABLE orders ADD COLUMN postex_booking_pending INTEGER NOT NULL DEFAULT 0');
  const orderById = db.prepare('SELECT * FROM orders WHERE id = ?');
  const saveLabel = db.prepare(`INSERT INTO courier_labels (order_id, tracking, pdf) VALUES (?, ?, ?)
    ON CONFLICT(order_id) DO UPDATE SET tracking = excluded.tracking, pdf = excluded.pdf`);

  app.get('/api/reviews/:slug', (req, res) => {
    const reviews = db.prepare(`SELECT display_name, rating, comment, created_at FROM reviews
      WHERE product_slug = ? AND status = 'approved' ORDER BY id DESC LIMIT 100`).all(req.params.slug);
    res.json(reviews);
  });
  app.post('/api/reviews/:slug', (req, res) => {
    const body = req.body || {};
    const ref = String(body.ref || '').trim().toUpperCase();
    const phone = normalizePhone(body.phone);
    const rating = Number(body.rating);
    const name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';
    if (!phone || !/^TF-\d{6}$/.test(ref) || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        !name || name.length > 60 || !comment || comment.length > 1000) {
      return res.status(400).json({ error: 'Enter your order reference, phone number, public name, rating, and review.' });
    }
    const order = db.prepare("SELECT id, items FROM orders WHERE ref = ? AND phone = ? AND status = 'delivered'").get(ref, phone);
    if (!order || !JSON.parse(order.items).some((line) => line.slug === req.params.slug)) {
      return res.status(403).json({ error: 'Reviews are available for products in your delivered orders.' });
    }
    const result = db.prepare(`INSERT INTO reviews (order_id, product_slug, display_name, rating, comment)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(order_id, product_slug) DO NOTHING`).run(order.id, req.params.slug, name, rating, comment);
    if (!result.changes) return res.status(409).json({ error: 'A review for this order and product has already been submitted.' });
    res.status(201).json({ ok: true });
  });
  app.patch('/api/admin/reviews/:id', (req, res) => {
    const status = req.body?.status;
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Choose a review status.' });
    const result = db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Review not found.' });
    res.json({ ok: true });
  });
  app.patch('/api/admin/shipments/:id', (req, res) => {
    const tracking = typeof req.body?.tracking === 'string' ? req.body.tracking.trim() : '';
    if (tracking && !/^[A-Za-z0-9 -]{3,80}$/.test(tracking)) return res.status(400).json({ error: 'Enter a valid tracking number.' });
    const result = db.prepare(`UPDATE orders SET courier_name = ?, courier_status =
      CASE WHEN courier_tracking = ? THEN courier_status ELSE '' END, courier_tracking = ?,
      postex_booking_pending = CASE WHEN ? <> '' THEN 0 ELSE postex_booking_pending END WHERE id = ?`)
      .run(tracking ? 'PostEx' : '', tracking, tracking, tracking, req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Order not found.' });
    res.json({ ok: true });
  });
  app.put('/api/admin/shipments/:id/label', (req, res) => {
    const order = db.prepare('SELECT courier_tracking FROM orders WHERE id = ?').get(req.params.id);
    if (!order?.courier_tracking) return res.status(400).json({ error: 'Save the PostEx tracking number first.' });
    if (req.body?.tracking !== order.courier_tracking) return res.status(409).json({ error: 'Tracking number changed. Refresh the order and try again.' });
    const encoded = req.body?.pdf;
    const pdf = typeof encoded === 'string' && encoded.length <= 4 * 1024 * 1024 ? Buffer.from(encoded, 'base64') : null;
    if (!pdf || pdf.subarray(0, 5).toString() !== '%PDF-') return res.status(400).json({ error: 'Select a PDF under 3 MB.' });
    saveLabel.run(req.params.id, order.courier_tracking, pdf);
    res.json({ ok: true });
  });
  app.get('/api/admin/shipments/:id/label', (req, res) => {
    const result = db.prepare(`SELECT l.pdf, o.ref FROM courier_labels l JOIN orders o ON o.id = l.order_id
      WHERE o.id = ? AND o.courier_tracking = l.tracking`).get(req.params.id);
    if (!result) return res.status(404).json({ error: 'No courier slip is attached for this tracking number.' });
    res.attachment('PostEx-' + result.ref + '.pdf').send(result.pdf);
  });
  async function postexRequest(path, token, body) {
    return fetch(postexBase + path, {
      method: body ? 'POST' : 'GET',
      headers: { token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
  }

  app.post('/api/admin/shipments/:id/book-label', async (req, res, next) => {
    const token = process.env.POSTEX_TOKEN?.trim();
    if (!token) return res.status(503).json({ error: 'Set POSTEX_TOKEN on the server and restart.' });
    const order = orderById.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.status === 'cancelled') return res.status(409).json({ error: 'This order is cancelled.' });
    const { id } = order;
    let tracking = order.courier_tracking;
    if (!tracking) {
      if (req.body?.addressConfirmed !== true || req.body?.address !== order.address ||
          req.body?.city !== order.city || req.body?.area !== order.area || req.body?.province !== order.province) {
        return res.status(409).json({ error: 'Check and confirm the current delivery address first.' });
      }
      if (!order.address.trim() || !order.city.trim() || !normalizePhone(order.phone)) {
        return res.status(400).json({ error: 'This order needs a complete delivery address and valid phone number.' });
      }
      const due = Math.max(0, order.total - order.advance_paid);
      if (order.payment_method !== 'cod' && due > 0) {
        return res.status(409).json({ error: 'Record the full advance payment before booking this prepaid order.' });
      }
      const lines = JSON.parse(order.items);
      const payload = {
        orderRefNumber: order.ref, invoicePayment: due, orderType: 'Normal', invoiceDivision: 1, items: 1,
        customerName: order.customer_name, customerPhone: normalizePhone(order.phone), cityName: order.city,
        deliveryAddress: [order.address, order.area, order.city, order.province].filter(Boolean).join(', '),
        orderDetail: lines.map((line) => line.name + ' x' + line.qty).join(', '),
        ...(process.env.POSTEX_PICKUP_ADDRESS_CODE?.trim() ? { pickupAddressCode: process.env.POSTEX_PICKUP_ADDRESS_CODE.trim() } : {}),
      };
      const attempt = Date.now();
      const lock = db.prepare(`UPDATE orders SET postex_booking_pending = ?
        WHERE id = ? AND postex_booking_pending = 0 AND courier_tracking = '' AND status <> 'cancelled'`).run(attempt, id);
      if (!lock.changes) return res.status(409).json({ error: 'Booking is in progress or unverified. Check this order reference in PostEx and save its tracking number if found.' });
      const uncertain = () => res.status(502).json({ error: 'PostEx booking could not be confirmed. Check this order reference in the merchant portal before booking again. If found, save its tracking number here.' });
      try {
        const response = await postexRequest('v3/create-order', token, payload);
        const result = await response.json();
        const candidate = result.dist?.trackingNumber;
        if (!response.ok || !/^2\d\d$/.test(String(result.statusCode ?? response.status)) ||
            typeof candidate !== 'string' || !trackingPattern.test(candidate)) {
          // A definite validation or authentication rejection can be corrected and retried.
          const rejection = Number(result.statusCode || response.status);
          if ([400, 401, 403, 422].includes(rejection) && !/duplicate|already|exist|reference.*used/i.test(result.statusMessage || '')) {
            db.prepare('UPDATE orders SET postex_booking_pending = 0 WHERE id = ? AND postex_booking_pending = ?').run(id, attempt);
            const message = typeof result.statusMessage === 'string' ? result.statusMessage.slice(0, 200) : 'Check the delivery details and token permissions.';
            return res.status(422).json({ error: 'PostEx rejected the booking. ' + message });
          }
          return uncertain();
        }
        tracking = candidate.trim();
        const saved = db.prepare(`UPDATE orders SET courier_name = 'PostEx', courier_tracking = ?, courier_status = ?,
          postex_booking_pending = 0, status = CASE WHEN status = 'new' THEN 'confirmed' ELSE status END
          WHERE id = ? AND courier_tracking = '' AND postex_booking_pending = ?`)
          .run(tracking, typeof result.dist.orderStatus === 'string' ? result.dist.orderStatus : '', id, attempt);
        if (!saved.changes) return uncertain();
      } catch {
        return uncertain();
      }
    }

    try {
      if (!db.prepare('SELECT 1 FROM courier_labels WHERE order_id = ? AND tracking = ?').get(id, tracking)) {
        let pdf;
        try {
          const response = await postexRequest('v1/get-invoice?' + new URLSearchParams({ trackingNumbers: tracking }), token);
          if (response.ok) {
            if ((response.headers.get('content-type') || '').includes('application/json')) {
              const data = await response.json();
              if (typeof data.dist === 'string') pdf = Buffer.from(data.dist.replace(/^data:application\/pdf;base64,/, ''), 'base64');
            } else {
              pdf = Buffer.from(await response.arrayBuffer());
            }
          }
        } catch { /* The saved tracking number lets the admin retry the PDF only. */ }
        if (!pdf || pdf.length > 3 * 1024 * 1024 || pdf.subarray(0, 5).toString() !== '%PDF-') {
          return res.status(502).json({ booked: true, error: 'Tracking is saved (' + tracking + '). PostEx did not return a PDF. Use Get PostEx slip to retry.' });
        }
        if (orderById.get(id)?.courier_tracking !== tracking) return res.status(409).json({ error: 'Tracking number changed. Try again.' });
        saveLabel.run(id, tracking, pdf);
      }
      res.json({ download: '/api/admin/shipments/' + id + '/label' });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/admin/shipments/:id/reset-booking', (req, res) => {
    if (req.body?.checkedPortal !== true) return res.status(400).json({ error: 'Check the order reference in the PostEx portal first.' });
    const reset = db.prepare(`UPDATE orders SET postex_booking_pending = 0
      WHERE id = ? AND courier_tracking = '' AND postex_booking_pending > 0 AND postex_booking_pending <= ?`)
      .run(req.params.id, Date.now() - 60000);
    if (!reset.changes) return res.status(409).json({ error: 'Booking may still be running or tracking may already be saved. Refresh the order.' });
    res.json({ ok: true });
  });
  async function lookupPostEx(tracking, timeout = 10000) {
    const token = process.env.POSTEX_TOKEN?.trim();
    if (!token) return { code: 503, error: 'Set POSTEX_TOKEN on the server and restart.' };
    try {
      const endpoint = 'https://api.postex.pk/services/integration/api/order/v1/track-order/';
      const response = await fetch(endpoint + encodeURIComponent(tracking), {
        headers: { token, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(timeout)
      });
      if (response.status === 401 || response.status === 403) return { code: 502, error: 'PostEx rejected the API token or its permissions.' };
      if (!response.ok) return { code: 502, error: 'PostEx could not verify this shipment. Check the tracking number and token.' };
      const payload = await response.json();
      const status = payload.dist?.transactionStatus || payload.dist?.orderStatus || payload.dist?.status;
      if (typeof status !== 'string' || !status.trim() || status.length > 120) {
        return { code: 502, error: 'PostEx did not return a shipment status for this number. Use a tracking number from your merchant account.' };
      }
      return { status: status.trim() };
    } catch {
      return { code: 502, error: 'PostEx did not respond successfully. Try again shortly.' };
    }
  }
  app.post('/api/admin/postex/check', async (req, res) => {
    const tracking = typeof req.body?.tracking === 'string' ? req.body.tracking.trim() : '';
    if (!/^[A-Za-z0-9 -]{3,80}$/.test(tracking)) return res.status(400).json({ error: 'Enter a valid PostEx tracking number.' });
    const result = await lookupPostEx(tracking);
    if (result.error) return res.status(result.code).json({ error: result.error });
    res.json({ status: result.status });
  });
  app.post('/api/admin/shipments/:id/refresh', async (req, res, next) => {
    try {
      const order = db.prepare('SELECT courier_tracking FROM orders WHERE id = ?').get(req.params.id);
      if (!order?.courier_tracking) return res.status(400).json({ error: 'Save the PostEx tracking number first.' });
      const result = await lookupPostEx(order.courier_tracking);
      if (result.error) return res.status(result.code).json({ error: result.error });
      const changed = db.prepare('UPDATE orders SET courier_status = ? WHERE id = ? AND courier_tracking = ?')
        .run(result.status, req.params.id, order.courier_tracking);
      if (!changed.changes) return res.status(409).json({ error: 'Tracking number changed. Refresh and try again.' });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return lookupPostEx;
};
