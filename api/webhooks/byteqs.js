const crypto = require("crypto");
const mail = require("../mail");

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function same(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hmacKeys(secret) {
  const keys = [secret];
  if (secret.startsWith("whsec_")) {
    const decoded = Buffer.from(secret.slice("whsec_".length), "base64");
    if (decoded.length >= 8) keys.push(decoded);
  }
  return keys;
}

function signed(raw, signature, timestamp, secrets) {
  const received = String(signature || "").trim().replace(/^"+|"+$/g, "");
  const extracted = (received.match(/(?:v1|sha256)=([A-Za-z0-9+/=]+)/i) || [])[1] || received;
  const candidates = [received, extracted, extracted.toLowerCase()];
  const when = timestamp || (received.match(/(?:^|,)t=(\d+)/) || [])[1] || "";
  const messages = [raw];
  if (when) messages.push(`${when}.${raw}`, `${when}${raw}`);
  return secrets.filter(Boolean).some((secret) =>
    hmacKeys(secret).some((key) =>
      messages.some((message) => {
        const mac = crypto.createHmac("sha256", key).update(message, "utf8").digest();
        return candidates.some((value) => same(value, mac.toString("hex")) || same(value, mac.toString("base64")));
      })
    )
  );
}

function wooAuth() {
  const base = (process.env.WC_URL || process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
  const key = (process.env.WC_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY || "").trim();
  const secret = (process.env.WC_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET || "").trim();
  if (!base || !key || !secret) return null;
  return { base, key, secret };
}

async function woo(pathname, init) {
  const auth = wooAuth();
  if (!auth) return null;
  const url = new URL(`${auth.base}/wp-json/wc/v3${pathname}`);
  url.searchParams.set("consumer_key", auth.key);
  url.searchParams.set("consumer_secret", auth.secret);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(`${auth.key}:${auth.secret}`).toString("base64"),
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function markPaid(id, email) {
  const order = await woo(`/orders/${id}`);
  if (!order) return;
  const existing = (order.meta_data || []).find((item) => item.key === "_f1_access");
  const body = { status: "processing", set_paid: true };
  if (email) body.billing = { email };
  let code = "";
  if (!existing) {
    code = mail.password();
    body.meta_data = [{ key: "_f1_access", value: mail.hash(code) }];
  }
  const saved = await woo(`/orders/${id}`, { method: "PUT", body: JSON.stringify(body) });
  if (!code || !email) return;
  const source = saved || order;
  const fees = Array.isArray(source.fee_lines) ? source.fee_lines : [];
  const items = Array.isArray(source.line_items) ? source.line_items : [];
  const lines = (fees.length ? fees : items).map((line) => ({
    name: String(line.name || "Ticket"),
    qty: Number(line.quantity || 1),
  }));
  await mail.send({
    to: email,
    reference: `F1-${id}`,
    password: code,
    lines,
    total: source.total ? `${source.total} ${source.currency || "EUR"}` : "",
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const raw = await readRaw(req);
  const secrets = [process.env.BYTEQS_WEBHOOK_SECRET, process.env.BYTEQS_SECRET_KEY].map((value) => (value || "").trim());
  const signature = req.headers["x-webhook-signature"] || req.headers["x-byteqs-signature"] || req.headers["stripe-signature"] || "";
  if (!signed(raw, signature, req.headers["x-webhook-timestamp"] || "", secrets)) {
    res.status(401).json({ ok: false });
    return;
  }
  let body = {};
  try {
    body = JSON.parse(raw);
  } catch {
    res.status(400).json({ ok: false });
    return;
  }
  const data = body.data && typeof body.data === "object" ? body.data : body;
  const object = data.object && typeof data.object === "object" ? data.object : data;
  const meta = object.metadata && typeof object.metadata === "object"
    ? object.metadata
    : data.metadata && typeof data.metadata === "object"
      ? data.metadata
      : {};
  const type = String(body.type || body.event || data.type || data.event || "").toLowerCase();
  const status = String(object.status || data.status || body.status || "").toLowerCase();
  const paid = (!/fail|unsuccess|expired|cancel|refund/.test(type) && /succeed|success|completed|paid/.test(type))
    || status === "succeeded" || status === "success" || status === "paid" || status === "completed";
  const wooId = meta.wooId || meta.woo_id || object.wooId || "";
  const reference = String(
    object.clientReferenceId || object.client_reference_id || object.reference
    || data.clientReferenceId || data.client_reference_id || data.reference
    || meta.reference || body.clientReferenceId || (wooId ? `F1-${wooId}` : "")
  );
  const match = reference.match(/^F1-(\d+)$/);
  const email = [object, data, body].map((node) => node && (node.customer_email || (node.customer && node.customer.email) || node.receipt_email)).find((value) => typeof value === "string" && value.includes("@"));
  if (paid && match) await markPaid(match[1], email ? email.trim().toLowerCase() : "");
  res.status(200).json({ ok: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
