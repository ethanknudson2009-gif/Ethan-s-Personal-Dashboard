/*
 * Service worker: a small script the browser keeps running for the
 * installed app. Per decision D2 there is NO offline mode, so it doesn't
 * cache pages. It's here for installability and for push notifications
 * (Phase 2: "the dashboard talks to me").
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A notification sent by the server, e.g. { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Dashboard", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icons/192.png",
      badge: "/icons/192.png",
      data: { url: data.url || "/today" },
    }),
  );
});

// Tapping a notification opens (or focuses) the dashboard on the right page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/today", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
