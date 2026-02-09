const CACHE_NAME = 'magicviewer-v1';
const STATIC_CACHE = [
    '/',
    '/index.html',
    '/lista.txt'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Cacheando archivos estáticos');
                return cache.addAll(STATIC_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activando...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Eliminar cachés antiguos
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Eliminando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Estrategia de fetch
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Estrategia para archivos .magic: Network First (siempre intentar red primero)
    if (url.pathname.endsWith('.magic')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Si la descarga fue exitosa, guardamos en caché
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Si falla la red, intentar caché
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Estrategia para lista.txt: Network First con cache busting
    if (url.pathname.endsWith('lista.txt') || url.search.includes('lista.txt')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Guardar en caché pero siempre intentar red primero
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Si falla la red, usar caché
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Estrategia para CDN externos: Network Only (no cachear)
    if (url.origin !== location.origin) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Estrategia para archivos estáticos (index.html, CSS, JS): Cache First
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    // Si está en caché, devolverlo
                    return response;
                }
                
                // Si no está en caché, descargarlo
                return fetch(event.request)
                    .then((response) => {
                        // No cachear si no es una respuesta válida
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }
                        
                        // Clonar la respuesta
                        const responseClone = response.clone();
                        
                        // Guardar en caché
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                        
                        return response;
                    });
            })
    );
});

// Escuchar mensajes para limpiar caché manualmente
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.delete(cacheName);
                    })
                );
            })
        );
    }
});
