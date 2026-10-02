const mail = require("./mail");

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

function metaValue(order, key) {
  const item = (order.meta_data || []).find((entry) => entry.key === key);
  return item && item.value != null ? String(item.value) : "";
}

function emailIn(value, depth = 0) {
  if (depth > 5 || !value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 8)) {
      const found = emailIn(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  for (const key of ["email", "customer_email", "customerEmail", "receipt_email", "receiptEmail"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.includes("@")) return candidate.trim().toLowerCase();
  }
  for (const key of ["customer_details", "customer", "billing_details", "billing", "payer", "object", "data", "checkout", "payment"]) {
    if (!(key in value)) continue;
    const found = emailIn(value[key], depth + 1);
    if (found) return found;
  }
  return "";
}

function sessionId(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("{")) return "";
  try {
    const url = new URL(raw);
    const id = url.pathname.split("/").filter(Boolean).pop() || "";
    return id.length >= 8 ? id : "";
  } catch {
    return raw.length >= 8 && !raw.startsWith("http") ? raw : "";
  }
}

async function readEmail(url, secret) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
      Origin: "https://ticketing-formula1.com",
    },
    signal: AbortSignal.timeout(2500),
  });
  const text = await res.text();
  if (!res.ok) return { email: "", status: res.status, keys: "" };
  const type = res.headers.get("content-type") || "";
  if (type.includes("json")) {
    try {
      const parsed = JSON.parse(text);
      const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 12).join(",") : "";
      return { email: emailIn(parsed), status: res.status, keys };
    } catch {
      return { email: "", status: res.status, keys: "" };
    }
  }
  const match = text.match(/"(?:email|customer_email|customerEmail|receipt_email)"\s*:\s*"([^"\\]+@[^"\\]+)"/i);
  return { email: match ? match[1].trim().toLowerCase() : "", status: res.status, keys: type.slice(0, 40) };
}

async function emailFromByteqs(checkoutUrl, reference) {
  const secret = (process.env.BYTEQS_SECRET_KEY || "").trim();
  if (!secret) return { email: "", tried: ["no-secret"] };
  const origin = (process.env.BYTEQS_CHECKOUT_ORIGIN || "https://checkout.byteqs.io").replace(/\/$/, "");
  const bases = [...new Set([origin, "https://checkout.byteqs.io", "https://api.byteqs.io"])];
  const urls = new Set();
  if (checkoutUrl && checkoutUrl.startsWith("http")) urls.add(checkoutUrl);
  const id = sessionId(checkoutUrl);
  if (id) {
    for (const base of bases) {
      for (const path of [
        `/api/hosted-checkout/${encodeURIComponent(id)}`,
        `/api/checkout-sessions/${encodeURIComponent(id)}`,
        `/api/checkout/${encodeURIComponent(id)}`,
        `/api/sessions/${encodeURIComponent(id)}`,
        `/api/payments/${encodeURIComponent(id)}`,
      ]) {
        urls.add(`${base}${path}`);
      }
    }
  }
  if (/^F1-\d+$/i.test(reference || "")) {
    const query = encodeURIComponent(reference);
    for (const base of bases) {
      urls.add(`${base}/api/hosted-checkout?clientReferenceId=${query}`);
      urls.add(`${base}/api/checkout-sessions?clientReferenceId=${query}`);
    }
  }
  const found = await Promise.all([...urls].map((url) => readEmail(url, secret).catch((error) => ({
    email: "",
    status: 0,
    keys: error instanceof Error ? error.name : "error",
  }))));
  const email = found.map((item) => item.email).find(Boolean) || "";
  const tried = [...urls].map((url, index) => {
    let path = url;
    try { path = new URL(url).pathname + new URL(url).search; } catch { /* keep */ }
    return `${found[index].status} ${path} ${found[index].keys}`;
  });
  return { email, tried };
}

async function confirmPaid(id, hintedEmail, langHint) {
  const order = await woo(`/orders/${id}`);
  if (!order) return { ok: false, reason: "order" };
  if (order.status === "cancelled" || order.status === "refunded") return { ok: false, reason: "status" };
  if (metaValue(order, "_f1_mail") === "sent") return { ok: true, already: true };

  let email = String(hintedEmail || order.billing?.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    const looked = await emailFromByteqs(metaValue(order, "_byteqs_checkout_url"), metaValue(order, "_byteqs_reference") || `F1-${id}`);
    email = looked.email || "";
  }
  if (!email.includes("@")) return { ok: false, reason: "email" };

  const code = mail.password();
  const saved = await woo(`/orders/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      status: "processing",
      set_paid: true,
      payment_method: "byteqs",
      payment_method_title: "BYTEQS",
      billing: { ...(order.billing || {}), email },
      meta_data: [
        { key: "_f1_access", value: mail.hash(code) },
        { key: "_f1_mail", value: "pending" },
        { key: "_byteqs_status", value: "paid" },
      ],
    }),
  });
  const source = saved || order;
  const fees = Array.isArray(source.fee_lines) ? source.fee_lines : [];
  const items = Array.isArray(source.line_items) ? source.line_items : [];
  const lines = (fees.length ? fees : items).map((line) => ({
    name: String(line.name || "Ticket"),
    qty: Number(line.quantity || 1),
  }));
  const stored = (source.meta_data || []).find((item) => item.key === "_f1_lang");
  const sent = await mail.send({
    to: email,
    reference: `F1-${id}`,
    password: code,
    lines,
    total: source.total ? `${source.total} ${source.currency || "EUR"}` : "",
    lang: (stored && stored.value) || langHint || metaValue(order, "_f1_lang") || "en",
  });
  if (!sent.ok) return { ok: false, reason: "brevo", status: sent.status };
  await woo(`/orders/${id}`, {
    method: "PUT",
    body: JSON.stringify({ meta_data: [{ key: "_f1_mail", value: "sent" }] }),
  });
  return { ok: true };
}

module.exports = { confirmPaid, findEmail: emailIn };
