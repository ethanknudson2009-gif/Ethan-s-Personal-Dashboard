import "server-only";
import * as webpush from "web-push";

/**
 * Sends a push notification with the free Web Push standard. Our own VAPID
 * keys (generated locally) prove the message comes from this app; no
 * third-party notification service or account is involved.
 */
let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Missing VAPID keys (server settings).");
  webpush.setVapidDetails("https://ethan-s-personal-dashboard.vercel.app", pub, priv);
  configured = true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };

/** "sent", or "gone" when the phone unsubscribed (we then forget that subscription). */
export async function sendPush(target: PushTarget, message: PushMessage): Promise<"sent" | "gone" | "failed"> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      { TTL: 60 * 60 * 6, urgency: "normal" },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("push failed", status);
    return "failed";
  }
}
