const mail = require("./mail");
const booking = require("./booking");

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
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") {
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (!match) return "";
    const email = match[0].trim().toLowerCase();
    return email.startsWith("attente@") ? "" : email;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) {
      const found = emailIn(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  const preferred = ["email", "customer_email", "customerEmail", "receipt_email", "receiptEmail"];
  for (const key of preferred) {
    if (!(key in value)) continue;
    const found = emailIn(value[key], depth + 1);
    if (found) return found;
  }
  for (const [key, item] of Object.entries(value)) {
    if (preferred.includes(key)) continue;
    const found = emailIn(item, depth + 1);
    if (found) return found;
  }
  return "";
}

function findRef(value, depth = 0) {
  if (depth > 8 || value == null) return "";
  if (typeof value === "string") {
    const match = value.match(/F1-\d+/);
    return match ? match[0] : "";
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) {
      const found = findRef(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  for (const item of Object.values(value)) {
    const found = findRef(item, depth + 1);
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

async function confirmPaid(id, hintedEmail, langHint, orderKey) {
  const order = await woo(`/orders/${id}`);
  if (!order) return { ok: false, reason: "order" };
  if (orderKey && order.order_key && order.order_key !== orderKey) return { ok: false, reason: "order" };
  if (order.status === "cancelled" || order.status === "refunded") return { ok: false, reason: "status" };

  let email = String(hintedEmail || order.billing?.email || "").trim().toLowerCase();
  if (!email.includes("@")) {
    const looked = await emailFromByteqs(metaValue(order, "_byteqs_checkout_url"), metaValue(order, "_byteqs_reference") || `F1-${id}`);
    email = looked.email || "";
  }
  let code = metaValue(order, "_f1_code");
  const alreadyMailed = metaValue(order, "_f1_mail") === "sent";
  const billing = { ...(order.billing || {}) };
  if (email.includes("@")) billing.email = email;
  if (!code) {
    code = mail.password();
    await woo(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "processing",
        set_paid: true,
        payment_method: "byteqs",
        payment_method_title: "BYTEQS",
        billing,
        meta_data: [
          { key: "_f1_access", value: mail.hash(code) },
          { key: "_f1_code", value: code },
          { key: "_byteqs_status", value: "paid" },
        ],
      }),
    });
  } else if (order.status === "pending" || order.status === "on-hold" || order.status === "failed") {
    await woo(`/orders/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "processing",
        set_paid: true,
        payment_method: "byteqs",
        payment_method_title: "BYTEQS",
        billing,
        meta_data: [{ key: "_byteqs_status", value: "paid" }],
      }),
    });
  }

  let mailed = alreadyMailed;
  if (email.includes("@") && !alreadyMailed) {
    const source = (await woo(`/orders/${id}`)) || order;
    const fees = Array.isArray(source.fee_lines) ? source.fee_lines : [];
    const items = Array.isArray(source.line_items) ? source.line_items : [];
    const lines = (fees.length ? fees : items).map((line) => ({
      name: String(line.name || "Ticket"),
      qty: Number(line.quantity || 1),
    }));
    const stored = (source.meta_data || []).find((item) => item.key === "_f1_lang");
    const view = booking.summary(source);
    const sent = await mail.send({
      to: email,
      reference: `F1-${id}`,
      password: code,
      lines,
      total: source.total ? `${source.total} ${source.currency || "EUR"}` : "",
      lang: (stored && stored.value) || langHint || metaValue(order, "_f1_lang") || "en",
      tickets: view.tickets,
    });
    mailed = Boolean(sent.ok);
    if (mailed) {
      await woo(`/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ meta_data: [{ key: "_f1_mail", value: "sent" }] }),
      });
    }
  }

  const fresh = (await woo(`/orders/${id}`)) || order;
  return {
    ok: true,
    password: code,
    email: email.includes("@") ? email : "",
    mailed,
    booking: booking.summary(fresh),
  };
}

module.exports = { confirmPaid, findEmail: emailIn, findRef };
