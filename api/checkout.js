const i18n = require("../js/i18n");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.ticketing-formula1.com").replace(/\/$/, "");
const SITE_APEX = SITE.replace(/^(https:\/\/)www\./i, "$1");
const WC_URL = (process.env.WC_URL || process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const WC_KEY = (process.env.WC_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY || "").trim();
const WC_SECRET = (process.env.WC_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET || "").trim();
const WC_GATEWAY = (process.env.WC_PAYMENT_METHOD || "byteqs").trim() || "byteqs";
const BYTEQS_ORIGIN = (process.env.BYTEQS_CHECKOUT_ORIGIN || "https://checkout.byteqs.io").replace(/\/$/, "");
const BYTEQS_FALLBACK = "https://checkout.byteqs.io";
const BYTEQS_SECRET = (process.env.BYTEQS_SECRET_KEY || "").trim();

function dataFile() {
  const candidates = [
    path.join(process.cwd(), "js", "data.js"),
    path.join(__dirname, "..", "js", "data.js"),
  ];
  return candidates.find((file) => fs.existsSync(file)) || candidates[0];
}

function races() {
  const file = dataFile();
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: "data.js" });
  return context.window.APEX.races;
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = await readRaw(req);
  if (!raw) return {};
  return JSON.parse(raw);
}

async function wc(pathname, init) {
  if (!WC_URL || !WC_KEY || !WC_SECRET) {
    throw new Error("WooCommerce is not configured.");
  }
  const url = new URL(`${WC_URL}/wp-json/wc/v3${pathname}`);
  url.searchParams.set("consumer_key", WC_KEY);
  url.searchParams.set("consumer_secret", WC_SECRET);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64"),
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : {};
}

async function byteqsSession(lines, order, lang, email) {
  if (!BYTEQS_SECRET) throw new Error("BYTEQS_SECRET_KEY is missing.");
  const reference = order ? `F1-${order.id}` : `F1-DIRECT-${Date.now()}`;
  const payload = {
    successUrl: `${SITE_APEX}/booking.html?order=${encodeURIComponent(reference)}${order && order.order_key ? `&key=${encodeURIComponent(order.order_key)}` : ""}&paid=1`,
    cancelUrl: `${SITE_APEX}/basket.html`,
    currency: "EUR",
    clientReferenceId: reference,
    metadata: { reference, lang, ...(order ? { wooId: String(order.id) } : {}) },
    ...(email ? { customer: { email } } : {}),
    lineItems: lines.map((line) => ({
      name: line.name.slice(0, 180),
      amountInCents: line.amountInCents,
      quantity: line.qty,
    })),
  };
  const bases = [...new Set([BYTEQS_ORIGIN, BYTEQS_FALLBACK])];
  let res = null;
  let data = null;
  for (const base of bases) {
    try {
      res = await fetch(`${base}/api/hosted-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BYTEQS_SECRET}`,
          Origin: SITE_APEX,
          Referer: `${SITE_APEX}/`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      continue;
    }
    data = await res.json().catch(() => null);
    if (res.ok && data && data.success && data.checkoutUrl) break;
  }
  if (!res || !res.ok || !data || !data.success || !data.checkoutUrl) {
    const detail = data && typeof data.error === "string" && !data.error.startsWith("{") ? data.error : "";
    throw new Error(detail.slice(0, 160) || "The payment page did not open.");
  }
  if (order) {
    await wc(`/orders/${order.id}`, {
      method: "PUT",
      body: JSON.stringify({
        meta_data: [
          { key: "_byteqs_status", value: "unpaid" },
          { key: "_byteqs_reference", value: reference },
          { key: "_byteqs_checkout_url", value: data.checkoutUrl },
        ],
      }),
    }).catch(() => {});
  }
  return data.checkoutUrl;
}

async function wooOrder(lines, lang, email) {
  try {
    return await wc("/orders", {
      method: "POST",
      body: JSON.stringify({
        set_paid: false,
        status: "pending",
        payment_method: WC_GATEWAY,
        payment_method_title: "BYTEQS",
        currency: "EUR",
        billing: { first_name: "Guest", last_name: "Guest", country: "FR", email },
        fee_lines: lines.map((line) => ({
          name: `${line.name} × ${line.qty}`,
          amount: line.total,
          total: line.total,
          tax_status: "none",
          meta_data: [
            { key: "_f1_race", value: line.raceId },
            { key: "_f1_tier", value: line.tierId },
            { key: "_f1_qty", value: String(line.qty) },
          ],
        })),
        meta_data: [
          { key: "_origine", value: "f1-tickets" },
          { key: "_f1_lang", value: lang },
        ],
      }),
    });
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  try {
    const body = await bodyOf(req);
    const lang = i18n.normalize(body.lang);
    const email = String(body.email || "").trim().toLowerCase();
    const items = Array.isArray(body.items) ? body.items : [];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "A valid email is required." });
      return;
    }
    if (!items.length || items.length > 24) {
      res.status(400).json({ error: "The basket is empty." });
      return;
    }
    const catalog = races();
    const lines = items.map((item) => {
      const race = catalog.find((entry) => entry.id === item.raceId);
      const ticket = race && (race.tickets || []).find((entry) => entry.id === item.tierId);
      const qty = Number(item.qty);
      if (!race || !ticket || !Number.isInteger(qty) || qty < 1 || qty > 8) {
        throw new Error("A ticket in the basket is no longer available.");
      }
      return {
        name: `${race.country} — ${ticket.name}`,
        qty,
        amountInCents: Math.round(Number(ticket.price) * 100),
        total: (Number(ticket.price) * qty).toFixed(2),
        raceId: race.id,
        tierId: ticket.id,
      };
    });
    const expected = lines.reduce((sum, line) => sum + Number(line.total), 0).toFixed(2);
    const created = await wooOrder(lines, lang, email);
    const order = created && Number(created.total).toFixed(2) === expected ? created : null;
    const url = await byteqsSession(lines, order, lang, email);
    res.status(200).json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    res.status(502).json({ error: message.slice(0, 300) });
  }
};
