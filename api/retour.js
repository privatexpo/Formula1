const { confirmPaid } = require("./confirm");

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }
  const body = bodyOf(req);
  const match = String(body.order || "").match(/^F1-(\d+)$/);
  if (!match) {
    res.status(400).json({ ok: false });
    return;
  }
  const result = await confirmPaid(match[1], "", "");
  res.status(result.ok ? 200 : 422).json(result);
};
