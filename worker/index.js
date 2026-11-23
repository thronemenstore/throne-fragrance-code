export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/store' || url.pathname === '/api/products') {
      const products = await env.DB.prepare('SELECT * FROM products WHERE is_live = 1 ORDER BY sort_order, id').all();
      const settings = await env.DB.prepare('SELECT key, value FROM settings').all();
      return Response.json({ products: products.results, settings: Object.fromEntries(settings.results.map((r) => [r.key, r.value])) });
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true, runtime: 'cloudflare-workers', database: 'D1' });
    return env.ASSETS.fetch(request);
  }
};
