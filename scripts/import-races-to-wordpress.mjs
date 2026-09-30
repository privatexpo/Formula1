#!/usr/bin/env node
/**
 * Importe les Grands Prix (js/data.js) dans WordPress / WooCommerce.
 * Même modèle que LXI : produit variable, attribut Categoria,
 * variations Upper / Lower / Club (prix = base × 0.56 / 0.86 / 1.16, arrondi à 5).
 *
 * La base est le prix médian des places (kind "seat") de la course.
 *
 * Usage :
 *   node scripts/import-races-to-wordpress.mjs --dry-run
 *   node scripts/import-races-to-wordpress.mjs --apply
 *   node scripts/import-races-to-wordpress.mjs --apply --update
 *   node scripts/import-races-to-wordpress.mjs --apply --only=bhr,mon
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const ATTR_NAME = "Categoria";
const ATTR_SLUG = "pa_categoria";
const META_SLUG = "_f1_slug";

const TIERS = [
  { option: "Upper", mult: 0.56, stockEnv: "WOO_STOCK_UPPER", stockDefault: 120 },
  { option: "Lower", mult: 0.86, stockEnv: "WOO_STOCK_LOWER", stockDefault: 80 },
  { option: "Club", mult: 1.16, stockEnv: "WOO_STOCK_CLUB", stockDefault: 40 },
];

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(resolve(ROOT, ".env.local"));
loadEnv(resolve(ROOT, ".env"));

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--apply");
const doUpdate = args.has("--update");
const onlyArg = [...args].find((a) => a.startsWith("--only="));
const onlyIds = onlyArg
  ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function env(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || "").trim();
    if (v) return v;
  }
  return "";
}

function loadRaces() {
  const src = readFileSync(resolve(ROOT, "js/data.js"), "utf8");
  const window = {};
  new Function("window", src)(window);
  const races = window.APEX?.races;
  if (!Array.isArray(races) || !races.length) {
    throw new Error("js/data.js : window.APEX.races introuvable");
  }
  return races;
}

function slugFor(race) {
  return `f1-2027-${race.id}`;
}

function roundMoney(n) {
  return Math.max(5, Math.round(Number(n) / 5) * 5);
}

function basePrice(race) {
  const seats = (race.tickets || []).filter((t) => t.kind !== "club" && t.price != null);
  const pool = seats.length ? seats : race.tickets || [];
  const prices = pool.map((t) => Number(t.price)).filter((n) => n > 0).sort((a, b) => a - b);
  if (!prices.length) return 0;
  return prices[Math.floor(prices.length / 2)];
}

function tierPrice(base, mult) {
  return String(roundMoney(base * mult));
}

function description(race) {
  return [
    `<p><strong>${race.name}</strong></p>`,
    `<p>Round ${race.round} · ${race.season}</p>`,
    `<p>${race.dates} · race ${race.raceDate}</p>`,
    `<p>${race.circuit} — ${race.country}</p>`,
  ].join("\n");
}

const wooUrl = env("WC_URL", "WOOCOMMERCE_URL").replace(/\/$/, "");
const key = env("WC_CONSUMER_KEY", "WOOCOMMERCE_CONSUMER_KEY");
const secret = env("WC_CONSUMER_SECRET", "WOOCOMMERCE_CONSUMER_SECRET");
const auth = "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");

async function woo(path, init = {}) {
  if (!wooUrl || !key || !secret) {
    throw new Error("WC_URL / WC_CONSUMER_KEY / WC_CONSUMER_SECRET manquants dans .env.local");
  }
  const res = await fetch(`${wooUrl}/wp-json/wc/v3${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}

async function findProduct(slug) {
  const bySlug = await woo(`/products?slug=${encodeURIComponent(slug)}&per_page=5`);
  return Array.isArray(bySlug) && bySlug.length ? bySlug[0] : null;
}

async function ensureAttribute() {
  const attrs = await woo(`/products/attributes?per_page=100`);
  let attr = (attrs || []).find(
    (a) => a.slug === ATTR_SLUG || a.name === ATTR_NAME || a.slug === "categoria"
  );
  if (!attr) {
    if (dryRun) return { id: 0, slug: ATTR_SLUG, name: ATTR_NAME };
    attr = await woo(`/products/attributes`, {
      method: "POST",
      body: JSON.stringify({
        name: ATTR_NAME,
        slug: ATTR_SLUG,
        type: "select",
        order_by: "menu_order",
        has_archives: false,
      }),
    });
    console.log(`Attribut créé #${attr.id} ${attr.name}`);
  }
  const terms = await woo(`/products/attributes/${attr.id}/terms?per_page=100`).catch(() => []);
  for (const tier of TIERS) {
    const exists = (terms || []).some(
      (t) => t.name === tier.option || t.slug === tier.option.toLowerCase()
    );
    if (exists) continue;
    if (dryRun) continue;
    await woo(`/products/attributes/${attr.id}/terms`, {
      method: "POST",
      body: JSON.stringify({ name: tier.option }),
    });
    console.log(`  terme + ${tier.option}`);
  }
  return attr;
}

async function ensureCategory() {
  const cats = await woo(`/products/categories?slug=formula-1&per_page=20`);
  let cat = (cats || []).find((c) => c.slug === "formula-1");
  if (cat) return cat;
  if (dryRun) return { id: 0, slug: "formula-1" };
  cat = await woo(`/products/categories`, {
    method: "POST",
    body: JSON.stringify({ name: "Formula 1", slug: "formula-1" }),
  });
  console.log(`Catégorie créée #${cat.id}`);
  return cat;
}

function productPayload(race, attr, categoryId, base) {
  return {
    name: race.name,
    type: "variable",
    status: "publish",
    catalog_visibility: "visible",
    description: description(race),
    short_description: `${race.circuit} · ${race.dates} · ${race.country}`,
    slug: slugFor(race),
    sku: `f1-2027-${race.id}`,
    categories: categoryId ? [{ id: categoryId }] : [],
    attributes: [
      {
        id: attr.id || undefined,
        name: ATTR_NAME,
        visible: true,
        variation: true,
        options: TIERS.map((t) => t.option),
      },
    ],
    meta_data: [
      { key: META_SLUG, value: slugFor(race) },
      { key: "_f1_race_id", value: race.id },
      { key: "_f1_round", value: String(race.round) },
      { key: "_f1_season", value: String(race.season) },
      { key: "_f1_country", value: race.country },
      { key: "_f1_circuit", value: race.circuit },
      { key: "_f1_dates", value: race.dates },
      { key: "_f1_race_date", value: race.raceDate },
      { key: "_f1_region", value: race.region || "" },
      { key: "_f1_base_price", value: String(base) },
    ],
  };
}

function variationPayload(race, tier, attr, base) {
  return {
    regular_price: tierPrice(base, tier.mult),
    manage_stock: true,
    stock_quantity: Number(process.env[tier.stockEnv] || tier.stockDefault),
    stock_status: "instock",
    sku: `f1-${race.id}-${tier.option.toLowerCase()}`,
    attributes: [{ id: attr.id || undefined, name: ATTR_NAME, option: tier.option }],
    meta_data: [
      { key: "_f1_tier", value: tier.option.toLowerCase() },
      { key: "_f1_mult", value: String(tier.mult) },
    ],
  };
}

async function listVariations(productId) {
  const existing = [];
  let page = 1;
  while (true) {
    const batch = await woo(`/products/${productId}/variations?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || !batch.length) break;
    existing.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return existing;
}

async function syncVariations(productId, race, attr, base) {
  const existing = dryRun ? [] : await listVariations(productId);
  const keep = new Set(TIERS.map((t) => t.option.toLowerCase()));
  const extras = existing.filter((v) => {
    const opt = (v.attributes || []).find((a) => /categor/i.test(a.name || ""));
    return !opt || !keep.has(String(opt.option).toLowerCase());
  });
  if (extras.length && !dryRun) {
    for (let i = 0; i < extras.length; i += 50) {
      await woo(`/products/${productId}/variations/batch`, {
        method: "POST",
        body: JSON.stringify({ delete: extras.slice(i, i + 50).map((v) => v.id) }),
      });
    }
    console.log(`  tribunes retirées : ${extras.length}`);
  }

  for (const tier of TIERS) {
    const body = variationPayload(race, tier, attr, base);
    const found = existing.find((v) => {
      const opt = (v.attributes || []).find((a) => /categor/i.test(a.name || ""));
      return opt && String(opt.option).toLowerCase() === tier.option.toLowerCase();
    });
    if (dryRun) {
      console.log(`  [dry-run] ${tier.option} → $${body.regular_price} · stock ${body.stock_quantity}`);
      continue;
    }
    if (found) {
      await woo(`/products/${productId}/variations/${found.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      console.log(`  ~ ${tier.option} #${found.id} → $${body.regular_price}`);
    } else {
      const v = await woo(`/products/${productId}/variations`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      console.log(`  + ${tier.option} #${v.id} → $${body.regular_price}`);
    }
  }
}

async function main() {
  let races = loadRaces();
  if (onlyIds) races = races.filter((r) => onlyIds.includes(r.id));
  console.log(
    `F1 → WooCommerce  ·  ${races.length} course(s)  ·  ${dryRun ? "DRY-RUN" : "APPLY"}${doUpdate ? " +UPDATE" : ""}`
  );

  const attr = dryRun ? { id: 0, slug: ATTR_SLUG, name: ATTR_NAME } : await ensureAttribute();
  const cat = dryRun ? { id: 0 } : await ensureCategory();
  const ids = [];

  for (const race of races) {
    const base = basePrice(race);
    const slug = slugFor(race);
    console.log(`\n→ ${slug}  ${race.name}  base $${base}`);
    if (dryRun) {
      await syncVariations(0, race, attr, base);
      continue;
    }
    const existing = await findProduct(slug);
    if (existing && !doUpdate) {
      console.log(`  existe #${existing.id} — passe (--update pour écraser)`);
      ids.push(existing.id);
      continue;
    }
    const payload = productPayload(race, attr, cat.id, base);
    if (existing) delete payload.sku;
    const product = existing
      ? await woo(`/products/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) })
      : await woo(`/products`, { method: "POST", body: JSON.stringify(payload) });
    console.log(`  produit #${product.id}`);
    ids.push(product.id);
    await syncVariations(product.id, race, attr, base);
  }

  console.log(dryRun ? "\nRien écrit." : `\nProduits : ${ids.join(",")}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
