(() => {
  let pixelId;
  let enabled = false;
  let started = false;

  function start() {
    if (started) return;
    const pixel = (...args) => pixel.callMethod ? pixel.callMethod(...args) : pixel.queue.push(args);
    pixel.push = pixel;
    pixel.loaded = true;
    pixel.version = '2.0';
    pixel.queue = [];
    window.fbq = window._fbq = pixel;
    pixel('init', pixelId);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.append(script);
    started = true;
  }

  window.thronePixel = {
    configure(id) {
      if (!/^\d{5,30}$/.test(id || '')) return;
      pixelId = id;
      const button = document.getElementById('marketingPreference');
      const update = () => {
        button.textContent = enabled ? 'Disable marketing cookies' : 'Enable marketing cookies';
        button.setAttribute('aria-pressed', String(enabled));
      };
      enabled = localStorage.getItem('throne-marketing') === 'yes';
      update();
      button.hidden = false;
      button.addEventListener('click', () => {
        enabled = !enabled;
        localStorage.setItem('throne-marketing', enabled ? 'yes' : 'no');
        if (enabled) {
          start();
          window.fbq('consent', 'grant');
          this.track('PageView');
        } else if (started) window.fbq('consent', 'revoke');
        update();
      });
    },
    track(event, data) {
      if (!pixelId || !enabled) return;
      start();
      window.fbq('track', event, data || {});
    },
  };
})();
