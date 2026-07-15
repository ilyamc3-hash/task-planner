const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const webpush = require("web-push");

const REGION = "ru-central1";
const ENDPOINT = "https://storage.yandexcloud.net";
const BUCKET = process.env.BUCKET_NAME;
const KEY = "reminders.json";

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY,
  },
});

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in the function's environment");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:example@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function loadStore() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const text = await streamToString(res.Body);
    const data = JSON.parse(text);
    return {
      subscription: data.subscription || null,
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
    };
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return { subscription: null, reminders: [] };
    }
    throw err;
  }
}

async function saveStore(store) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: JSON.stringify(store, null, 2),
      ContentType: "application/json",
    })
  );
}

// Timer-triggered (cron, once a minute). Reads reminders.json, delivers any
// reminder that's due via Web Push, and drops delivered/expired entries so
// the file doesn't grow - there's no UI to browse "already sent" reminders.
exports.handler = async () => {
  ensureVapidConfigured();
  const store = await loadStore();
  if (!store.subscription || store.reminders.length === 0) {
    return { statusCode: 200, body: "nothing to do" };
  }

  const now = Date.now();
  const remaining = [];
  let delivered = 0;
  let subscriptionGone = false;

  for (const reminder of store.reminders) {
    const isDue = !reminder.delivered && new Date(reminder.remindAt).getTime() <= now;
    if (!isDue) {
      remaining.push(reminder);
      continue;
    }
    try {
      await webpush.sendNotification(
        store.subscription,
        JSON.stringify({ title: "Напоминание", body: reminder.text, url: "/task-planner/" })
      );
      delivered += 1;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired/revoked - nothing more we can do for any
        // reminder this run, drop it and stop trying to push further.
        subscriptionGone = true;
      } else {
        remaining.push(reminder); // transient error - retry next run
      }
    }
  }

  store.reminders = remaining;
  if (subscriptionGone) {
    store.subscription = null;
  }
  await saveStore(store);

  return { statusCode: 200, body: `delivered ${delivered} reminder(s)` };
};
