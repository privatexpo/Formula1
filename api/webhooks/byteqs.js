const crypto = require("crypto");
const { confirmPaid, findEmail, findRef } = require("../confirm");

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
  const email = findEmail(body) || "";
  const reference = String(
    object.clientReferenceId || object.client_reference_id || object.reference
    || data.clientReferenceId || data.client_reference_id || data.reference
    || meta.reference || body.clientReferenceId || findRef(body) || (wooId ? `F1-${wooId}` : "")
  );
  const match = reference.match(/F1-(\d+)/);
  if (paid && match) await confirmPaid(match[1], email, meta.lang || "");
  res.status(200).json({ ok: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
