// Service Worker for The Kartel PWA
// Handles caching, offline functionality, and push notifications

const CACHE_NAME = 'kartel-v1.0.0';
const ADMIN_CACHE_NAME = 'kartel-admin-v1.0.0';

// Files to cache for members app
const MEMBER_CACHE_FILES = [
  '/members.html',
  '/manifest.json',
  '/favicon.svg',
  '/assets/League_Spartan/LeagueSpartan-VariableFont_wght.ttf',
  '/assets/the-kartel-logo.png',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg'
];

// Files to cache for admin app
const ADMIN_CACHE_FILES = [
  '/admin.html',
  '/admin.css',
  '/admin.js',
  '/admin-manifest.json',
  '/favicon.svg',
  '/assets/League_Spartan/LeagueSpartan-VariableFont_wght.ttf',
  '/assets/the-kartel-logo-crop.png',
  '/icons/admin-icon-192x192.svg',
  '/icons/admin-icon-512x512.svg'
];

// Determine which app we're serving based on the request
function isAdminRequest(url) {
  return url.includes('/admin') || url.includes('admin-manifest.json');
}

// Install event - cache files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache member files
      caches.open(CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching member files');
        return cache.addAll(MEMBER_CACHE_FILES);
      }),
      // Cache admin files
      caches.open(ADMIN_CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching admin files');
        return cache.addAll(ADMIN_CACHE_FILES);
      })
    ]).then(() => {
      console.log('Service Worker: Cached all files');
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== ADMIN_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests and Netlify functions
  if (!event.request.url.startsWith(self.location.origin) || 
      event.request.url.includes('/.netlify/functions/')) {
    return;
  }

  const isAdmin = isAdminRequest(event.request.url);
  const cacheName = isAdmin ? ADMIN_CACHE_NAME : CACHE_NAME;

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached version if available
      if (response) {
        console.log('Service Worker: Serving from cache:', event.request.url);
        return response;
      }

      // Otherwise fetch from network
      console.log('Service Worker: Fetching from network:', event.request.url);
      return fetch(event.request).then(response => {
        // Don't cache if not successful
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone response for caching
        const responseToCache = response.clone();

        // Cache static assets
        if (event.request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)$/)) {
          caches.open(cacheName).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // If network fails, try to serve offline fallback
        if (event.request.headers.get('accept').includes('text/html')) {
          const fallbackPage = isAdmin ? '/admin.html' : '/members.html';
          return caches.match(fallbackPage);
        }
      });
    })
  );
});

// Push notification event
self.addEventListener('push', event => {
  console.log('Service Worker: Push received');

  let notificationData = {
    title: 'The Kartel',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-96x96.svg',
    tag: 'kartel-notification',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.error('Service Worker: Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Determine which app to open based on notification data
  const isAdminNotification = event.notification.data && event.notification.data.isAdmin;
  const urlToOpen = isAdminNotification ? '/admin.html' : '/members.html';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if not already open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync event (for offline form submissions)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered');
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline form submissions here
      handleBackgroundSync()
    );
  }
});

async function handleBackgroundSync() {
  // Check for pending form submissions in IndexedDB
  // This would be implemented based on specific offline requirements
  console.log('Service Worker: Handling background sync');
}

// Message event for communication with main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});