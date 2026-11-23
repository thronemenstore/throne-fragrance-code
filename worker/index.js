export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/store' || url.pathname === '/api/products') {
      const products = await env.DB.prepare('SELECT * FROM products WHERE is_live = 1 ORDER BY sort_order, id').all();
      const settings = await env.DB.prepare('SELECT key, value FROM settings').all();
      return Response.json({ products: products.results, settings: Object.fromEntries(settings.results.map((r) => [r.key, r.value])) });
    }
    const reviewMatch = url.pathname.match(/^\/api\/reviews\/([^/]+)$/);
    if (request.method === 'GET' && reviewMatch) {
      const reviews = await env.DB.prepare("SELECT display_name, rating, comment, created_at FROM reviews WHERE product_slug = ? AND status = 'approved' ORDER BY id DESC LIMIT 100").bind(decodeURIComponent(reviewMatch[1])).all();
      return Response.json(reviews.results);
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true, runtime: 'cloudflare-workers', database: 'D1' });
    return env.ASSETS.fetch(request);
  }
};
