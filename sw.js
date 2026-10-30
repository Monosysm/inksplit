/* InkSplit — service worker (PWA). Dipasang app HANYA saat dibuka dari https (GitHub Pages) atau ?pwa=1 untuk uji lokal.
   HTML  : NETWORK-FIRST — online = selalu versi terbaru (GitHub mengirim 304 bila tak berubah), offline / jaringan > 4 s = salinan cache.
           Ini mencegah bug "versi lama tertahan di cache".
   Aset  : manifest & ikon = cache-first.
   VERSION diisi skrip rilis (pwa/release.mjs) dengan versi app: berubah tiap rilis → browser memasang SW baru → app menampilkan
   "UPDATE READY · Reload" (pesan 'skipWaiting'). Nama cache lama (inksplit-*) dibuang saat SW baru aktif. */
const VERSION = '1.2.1-50e7227e';
const CACHE = 'inksplit-' + VERSION;
const ASSETS = ['./', './InkSplit.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.indexOf('inksplit-') === 0 && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const page = req.mode === 'navigate' || /\.html$|\/$/.test(url.pathname);
  e.respondWith(page ? networkFirst(req) : cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  const cached = () => cache.match(req, { ignoreSearch: true }).then((r) => r || cache.match('./InkSplit.html'));
  try {
    // jaringan lambat (> 4 s) dan ada salinan → pakai salinan dulu; unduhan tetap memperbarui cache untuk pembukaan berikut
    const slow = new Promise((resolve) => setTimeout(() => cached().then((r) => r && resolve(r)), 4000));
    return await Promise.race([net, slow]);
  } catch (err) {
    const r = await cached();
    return r || Response.error();
  }
}
async function cacheFirst(req) {
  const r = await caches.match(req, { ignoreSearch: true });
  return r || fetch(req);
}
