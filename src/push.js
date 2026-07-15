const REMINDERS_API_URL = import.meta.env.VITE_REMINDERS_API_URL;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

function requireConfigured() {
  if (!VAPID_PUBLIC_KEY || !REMINDERS_API_URL) {
    throw new Error(
      "Напоминания не настроены: не заданы VITE_VAPID_PUBLIC_KEY / VITE_REMINDERS_API_URL при сборке"
    );
  }
}

async function callApi(action, payload) {
  requireConfigured();
  const res = await fetch(REMINDERS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Сервер напоминаний ответил ${res.status}${text ? ": " + text : ""}`);
  }
  return res.json().catch(() => ({}));
}

let subscribePromise = null;

// Requests notification permission (if needed), subscribes the browser to
// push, and registers the subscription with the manage-reminders function.
// Safe to call repeatedly - reuses the existing subscription/in-flight call.
export async function ensureSubscription() {
  if (!pushSupported()) {
    throw new Error("Push-уведомления не поддерживаются в этом браузере");
  }
  if (Notification.permission === "denied") {
    throw new Error("Уведомления заблокированы в браузере");
  }
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Уведомления не разрешены");
    }
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    requireConfigured();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  if (!subscribePromise) {
    subscribePromise = callApi("subscribe", { subscription: subscription.toJSON() }).finally(() => {
      subscribePromise = null;
    });
  }
  await subscribePromise;
  return subscription;
}

export async function upsertReminder({ id, text, remindAt }) {
  await ensureSubscription();
  await callApi("upsertReminder", { id, text, remindAt });
}

export async function deleteReminder(id) {
  await callApi("deleteReminder", { id });
}
