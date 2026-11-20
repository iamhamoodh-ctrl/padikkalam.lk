self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL("/monitor", self.location.origin).href;
      for (const client of await self.clients.matchAll({ type: "window" })) {
        if (client.url === url) return client.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
