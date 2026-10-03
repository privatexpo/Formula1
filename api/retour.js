const { confirmPaid } = require("./confirm");

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

function fromCookie(req) {
  const raw = String((req.headers && req.headers.cookie) || "");
  const match = raw.match(/(?:^|;\s*)f1_retour=([^;]+)/);
  if (!match) return { order: "", key: "" };
  let value = match[1];
  try {
    value = decodeURIComponent(value);
  } catch {
    /* conserve la valeur brute */
  }
  const [order, key] = value.split("|");
  return { order: order || "", key: key || "" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const body = bodyOf(req);
  const cookie = fromCookie(req);
  const order = /^F1-\d+$/.test(String(body.order || "")) ? String(body.order) : cookie.order;
  const key = String(body.key || cookie.key || "");
  const match = String(order || "").match(/^F1-(\d+)$/);
  if (!match) {
    res.status(404).json({ ok: false });
    return;
  }
  const result = await confirmPaid(match[1], "", "", key);
  res.status(result.ok ? 200 : 422).json(result);
};
