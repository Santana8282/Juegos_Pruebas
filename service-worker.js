// ============================================================
//  SERVICE WORKER — Juegos de Fiesta
//  Estrategia: Cache-first con actualización en segundo plano
// ============================================================

const CACHE_NAME = 'juegos-fiesta-v1';

// Archivos que se guardan en caché al instalar
const PRECACHE_URLS = [
  './juegos_2en1.html',
  './manifest.json',
  // Iconos (crea la carpeta icons/ con tus imágenes)
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Fuentes de Google (se cachean en tiempo de ejecución, ver abajo)
];

// Dominios externos que también se cachean (fuentes, etc.)
const CACHE_EXTERNAL = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// ── INSTALL: precachear recursos esenciales ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activar inmediatamente sin esperar a que se cierren pestañas
  self.skipWaiting();
});

// ── ACTIVATE: borrar cachés antiguas ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Tomar control de todas las pestañas abiertas de inmediato
  self.clients.claim();
});

// ── FETCH: estrategia Cache-first ───────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // Recursos de fuentes externas → Cache-first, luego red
  if (CACHE_EXTERNAL.some(domain => request.url.startsWith(domain))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Recursos propios → Cache-first con revalidación en segundo plano
  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

// ── Estrategia: Cache-first ──────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Sin red y sin caché → respuesta vacía de emergencia
    return new Response('Sin conexión', { status: 503 });
  }
}

// ── Estrategia: Stale-While-Revalidate ──────────────────────
// Sirve desde caché (rápido) y actualiza en segundo plano
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Si hay caché, úsala de inmediato; si no, espera la red
  return cached ?? await fetchPromise ?? offlineFallback(request);
}

// ── Fallback offline ─────────────────────────────────────────
function offlineFallback(request) {
  const url = new URL(request.url);

  // Si piden una página HTML, devolver el juego desde caché
  if (request.headers.get('Accept')?.includes('text/html')) {
    return caches.match('./juegos_2en1.html');
  }

  return new Response('Sin conexión', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
