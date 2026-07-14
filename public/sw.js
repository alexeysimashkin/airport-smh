self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'Аэропорт Симашкино', body: 'Новое уведомление' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    })
  );
});
