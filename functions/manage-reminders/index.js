const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

const REGION = "ru-central1";
const ENDPOINT = "https://storage.yandexcloud.net";
const BUCKET = process.env.BUCKET_NAME;
const KEY = "reminders.json";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY,
  },
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
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

// Single HTTP-triggered function handling three actions, dispatched by
// `action` in the JSON body: subscribe / upsertReminder / deleteReminder.
// Kept as one function (instead of three) since Yandex bills per-function
// idle allocation - one endpoint is simpler to wire up and stays well
// within the free tier for a single-user app.
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { action } = payload;

  try {
    const store = await loadStore();

    if (action === "subscribe") {
      const { subscription } = payload;
      if (!subscription || !subscription.endpoint) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "subscription is required" }) };
      }
      store.subscription = subscription;
      await saveStore(store);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    if (action === "upsertReminder") {
      const { id, text, remindAt } = payload;
      if (!id || !remindAt) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "id and remindAt are required" }) };
      }
      const idx = store.reminders.findIndex((r) => r.id === id);
      const reminder = { id, text: text || "", remindAt, delivered: false };
      if (idx >= 0) store.reminders[idx] = reminder;
      else store.reminders.push(reminder);
      await saveStore(store);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    if (action === "deleteReminder") {
      const { id } = payload;
      store.reminders = store.reminders.filter((r) => r.id !== id);
      await saveStore(store);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};
