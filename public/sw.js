/* Among The Letters notifications service worker. Only used when a member turns on browser alerts. */
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Among The Letters", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "Among The Letters", {
    body: d.body || "", icon: "/favicon.svg", badge: "/favicon.svg", tag: d.tag, data: { link: d.link || "/opportunities/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.link, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
