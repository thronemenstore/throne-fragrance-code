// Shared by storefront previews and server-side checkout.
(function () {
  function promoAvailable(lines, promo, settings) {
    const promoCodes = String(settings.promo_codes || settings.promo_code || 'THRONE10').split(',').map((code) => code.trim().toUpperCase()).filter(Boolean);
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
    return settings.promo_enabled !== '0' && !!promo && promoCodes.includes(promo.trim().toUpperCase()) &&
      subtotal >= Number(settings.promo_minimum || 0);
  }
  function orderDiscount(lines, promo, settings) {
    if (promoAvailable(lines, promo, settings)) {
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
      return Math.round(subtotal * Number(settings.promo_percent || 10) / 100);
    }
    if (settings.bundle_enabled === '0') return 0;
    const trio = ['glory', 'midnight', 'velora'].map((slug) => lines.find((line) => line.slug === slug));
    if (trio.some((line) => !line)) return 0;
    const sets = Math.min(...trio.map((line) => line.qty));
    const setPrice = trio.reduce((sum, line) => sum + line.price, 0);
    return Math.round(sets * setPrice * Number(settings.bundle_discount_percent || 20) / 100);
  }

  orderDiscount.promoAvailable = promoAvailable;
  if (typeof module === 'object') module.exports = orderDiscount;
  else window.orderDiscount = orderDiscount;
}());
