const crypto = require("crypto");
const mail = require("./mail");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const WC_URL = (process.env.WC_URL || process.env.WOOCOMMERCE_URL || "").replace(/\/$/, "");
const WC_KEY = (process.env.WC_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY || "").trim();
const WC_SECRET = (process.env.WC_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET || "").trim();
const TICKET_SECRET = (
  process.env.TICKET_SECRET ||
  process.env.BYTEQS_WEBHOOK_SECRET ||
  process.env.WC_WEBHOOK_SECRET ||
  "f1-eticket"
).trim();

const STATUS = {
  pending: "Awaiting payment",
  processing: "Paid",
  completed: "Confirmed",
  "on-hold": "On hold",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Payment failed",
};

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
  return raw ? JSON.parse(raw) : {};
}

async function wc(pathname) {
  const url = new URL(`${WC_URL}/wp-json/wc/v3${pathname}`);
  url.searchParams.set("consumer_key", WC_KEY);
  url.searchParams.set("consumer_secret", WC_SECRET);
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64") },
  });
  if (!res.ok) return null;
  return res.json();
}

function catalogue() {
  try {
    const file = [path.join(process.cwd(), "js", "data.js"), path.join(__dirname, "..", "js", "data.js")].find((item) => fs.existsSync(item)) || path.join(process.cwd(), "js", "data.js");
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: "data.js" });
    return context.window.APEX.races || [];
  } catch {
    return [];
  }
}

function linesOf(order) {
  const fees = Array.isArray(order.fee_lines) ? order.fee_lines : [];
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const source = fees.length ? fees : items;
  return source.map((line) => {
    const raw = String(line.name || "Ticket");
    const named = raw.match(/^(.*)\s×\s(\d+)$/);
    const metaQty = Number(line.meta_data?.find((meta) => meta.key === "_f1_qty")?.value);
    const qty = metaQty || (named ? Number(named[2]) : 0) || Number(line.quantity) || 1;
    return {
      name: named ? named[1] : raw,
      qty: Math.min(8, Math.max(1, qty)),
    };
  });
}

function day(iso) {
  const [year, month, date] = String(iso || "").split("-").map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date);
}

function shift(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function accessOf(raceDate) {
  const race = day(raceDate);
  if (!race) return { state: "ready", opens: "" };
  const opens = shift(race, -12);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let state = "upcoming";
  if (today > race) state = "closed";
  else if (today >= opens) state = "ready";
  const opensLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(opens);
  return { state, opens: opensLabel };
}

function ticketsOf(order) {
  const paid = order.status === "processing" || order.status === "completed";
  const races = catalogue();
  const tickets = [];
  let number = 0;
  for (const line of linesOf(order)) {
    const parts = line.name.split(/\s+—\s+|\s+-\s+/);
    const event = parts[0] || line.name;
    const category = parts[1] || "Ticket";
    const race = races.find((entry) => entry.country === event);
    const when = race ? `${race.dates} ${race.season}` : "";
    const gate = accessOf(race && race.raceDate);
    const ready = paid;
    for (let i = 0; i < line.qty; i++) {
      number += 1;
      const id = `F1-${order.id}-${String(number).padStart(2, "0")}`;
      const check = crypto.createHmac("sha256", TICKET_SECRET).update(id).digest("hex").slice(0, 8).toUpperCase();
      tickets.push({
        id,
        event,
        category,
        when,
        raceDate: race ? race.raceDate : "",
        state: paid ? "ready" : "unpaid",
        opens: gate.opens,
        issued: ready,
        ...(ready ? { code: `${id}.${check}` } : {}),
      });
    }
  }
  return tickets;
}

function summary(order) {
  const amount = Number(order.total);
  const total = Number.isFinite(amount)
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: order.currency || "EUR" }).format(amount)
    : String(order.total || "");
  const placedRaw = order.date_created || order.date_created_gmt;
  const placedDate = placedRaw ? new Date(placedRaw) : null;
  const placed = placedDate && !Number.isNaN(placedDate.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(placedDate)
    : "";
  return {
    reference: `F1-${order.id}`,
    status: order.status,
    statusLabel: STATUS[order.status] || "Booking found",
    total,
    placed,
    lines: linesOf(order),
    tickets: ticketsOf(order),
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
    const missing = { error: "No booking matches that email and password." };
  try {
    const body = await bodyOf(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || !WC_URL || !WC_KEY || !WC_SECRET) {
      res.status(404).json(missing);
      return;
    }
    const listed = await wc(`/orders?search=${encodeURIComponent(email)}&per_page=20&orderby=date&order=desc`);
    const briefs = (Array.isArray(listed) ? listed : [])
      .filter((order) => String(order?.billing?.email || "").trim().toLowerCase() === email)
      .slice(0, 8);
    let order = null;
    for (const brief of briefs) {
      const full = await wc(`/orders/${brief.id}`);
      const stored = (full?.meta_data || []).find((item) => item.key === "_f1_access");
      if (full && stored && mail.same(String(stored.value), mail.hash(password))) {
        order = full;
        break;
      }
    }
    if (!order) {
      res.status(404).json(missing);
      return;
    }
    res.status(200).json(summary(order));
  } catch {
    res.status(404).json(missing);
  }
}

module.exports = handler;
module.exports.summary = summary;
