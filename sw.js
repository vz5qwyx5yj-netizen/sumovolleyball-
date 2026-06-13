// Service worker voor Sumo Beach Volley
// CACHE wordt automatisch ververst bij elke upload (upload.command bumpt dit getal).
const CACHE = 'sumo-v20260613235200';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Installeren: kernbestanden vast in de cache zetten
self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));
});

// Activeren: oude caches opruimen
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

// Ophalen:
//  - HTML/navigatie -> network-first (altijd de nieuwste game als je online bent)
//  - rest -> cache-first met stille update op de achtergrond
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;

  const isDoc = req.mode === 'navigate' ||
                req.destination === 'document' ||
                req.url.endsWith('index.html');

  if(isDoc){
    e.respondWith(
      fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached=>{
      const network = fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put(req, copy));
        return res;
      }).catch(()=>cached);
      return cached || network;
    })
  );
});
