/* ============================================================
   Install helper (PWA).
   - Captures the browser's "install" event so the app can show its OWN Install banner/button
     (browsers show their own prompt only occasionally and stop after it was dismissed).
   - On iPhone (no install event exists) it explains Share > Add to Home Screen.
   - checks(): small self-test shown in Settings (HTTPS, manifest, service worker) to find out
     why a phone does not offer installation.
   ============================================================ */
const Install = {
  deferred: null,
  standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent); },
  dismissed() { try { return Date.now() - Number(localStorage.getItem('tm.installDismiss') || 0) < 7 * 86400000; } catch (e) { return false; } },
  dismiss() { try { localStorage.setItem('tm.installDismiss', String(Date.now())); } catch (e) { /* ignore */ } },
  /** What the banner should offer now: 'prompt' (Install button) | 'ios' (instructions) | '' (nothing) */
  offer() { if (this.standalone() || this.dismissed()) return ''; return this.deferred ? 'prompt' : this.ios() ? 'ios' : ''; },

  async prompt() {
    if (!this.deferred) return false;
    this.deferred.prompt();
    const r = await this.deferred.userChoice; this.deferred = null;
    return r.outcome === 'accepted';
  },
  /** [[translationKey, ok], ...] */
  async checks() {
    const link = document.querySelector('link[rel=manifest]');
    let manifest = false;
    if (link) { try { manifest = (await fetch(link.href, { cache: 'no-store' })).ok; } catch (e) { /* offline or blocked */ } }
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    return [['inHttps', location.protocol === 'https:' || location.hostname === 'localhost'], ['inManifest', manifest],
      ['inSw', !!(reg && reg.active)], ['inPrompt', !!this.deferred], ['inStandalone', this.standalone()]];
  },
  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); this.deferred = e; // keep it: our button calls prompt() later
      if (typeof render === 'function' && typeof Data !== 'undefined' && Data.db && Auth.ok) render(true);
    });
    window.addEventListener('appinstalled', () => { this.deferred = null; });
  }
};
Install.init();
