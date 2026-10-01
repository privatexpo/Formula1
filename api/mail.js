const crypto = require("crypto");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function secret() {
  return (
    process.env.TICKET_SECRET ||
    process.env.BYTEQS_WEBHOOK_SECRET ||
    process.env.BYTEQS_SECRET_KEY ||
    "f1-eticket"
  ).trim();
}

function password() {
  const bytes = crypto.randomBytes(8);
  const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function hash(value) {
  return crypto.createHmac("sha256", secret()).update(String(value)).digest("hex");
}

function same(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function shell(site, body) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#f7f4f1;font-family:Arial,Helvetica,sans-serif;color:#15151e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f1;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
        <tr><td align="center" style="background:#e10600;padding:16px 28px;"><img src="${site}/assets/f1-tickets-logo.svg" alt="F1 Tickets" height="22" style="display:block;height:22px;width:auto;border:0;margin:0 auto;"></td></tr>
        ${body}
        <tr><td align="center" style="padding:18px 28px 22px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle;padding-right:8px;"><img src="${site}/assets/icon-mail.svg" alt="" width="16" height="16" style="display:block;width:16px;height:16px;border:0;"></td>
              <td style="vertical-align:middle;"><a href="mailto:support@ticketing-formula1.com" style="color:#15151e;font-size:13px;font-weight:600;text-decoration:none;">support@ticketing-formula1.com</a></td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:#8a8a92;font-size:12px;">© 2026 FEVER</p>
    </td></tr>
  </table>
</body></html>`;
}

function html({ reference, password: code, site }) {
  const open = `${site}/booking.html`;
  return shell(site, `
        <tr><td align="center" style="padding:28px 28px 8px;text-align:center;">
          <p style="margin:0;color:#e10600;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">Payment confirmed</p>
          <h1 style="margin:8px 0 0;font-size:28px;font-weight:600;letter-spacing:0;">Your tickets</h1>
          <p style="margin:10px 0 0;color:#5c5c66;font-size:15px;line-height:1.5;">Order ${escapeHtml(reference)} is paid. Use the password below with this email address to open your passes.</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 0;text-align:center;">
          <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Password</p>
          <p style="margin:6px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:0.08em;">${escapeHtml(code)}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px 8px;text-align:center;">
          <a href="${open}" style="display:inline-block;background:#e10600;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:999px;">Open my tickets</a>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px 8px;text-align:center;">
          <p style="margin:0;color:#5c5c66;font-size:13px;line-height:1.5;">Your QR code appears on each pass 10 days before the weekend and remains valid through race day. Keep this password safe — you will need it to open your tickets.</p>
        </td></tr>`);
}

function invoice({ reference, lines, total, site, placed, email }) {
  const rows = (lines || [])
    .map((line) => `<tr><td style="padding:12px 0;border-bottom:1px solid #efece8;font-size:14px;color:#15151e;">${escapeHtml(line.name)}</td><td style="padding:12px 0;border-bottom:1px solid #efece8;font-size:14px;color:#15151e;text-align:right;">${Number(line.qty) || 1}</td></tr>`)
    .join("");
  const when = escapeHtml(placed || new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date()));
  const who = email ? `<p style="margin:14px 0 0;color:#5c5c66;font-size:14px;text-align:center;">Billed to <b style="color:#15151e;">${escapeHtml(email)}</b></p>` : "";
  const sum = total
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:#15151e;border-radius:12px;"><tr><td style="padding:14px 16px;color:#fff;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Total paid</td><td style="padding:14px 16px;color:#fff;font-size:20px;font-weight:600;text-align:right;">${escapeHtml(total)}</td></tr></table>`
    : "";
  return shell(site, `
        <tr><td align="center" style="padding:28px 28px 8px;text-align:center;">
          <p style="margin:0;color:#e10600;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">Invoice</p>
          <h1 style="margin:8px 0 0;font-size:28px;font-weight:600;letter-spacing:0;">Your receipt</h1>
          <p style="margin:10px 0 0;color:#5c5c66;font-size:15px;line-height:1.5;">Keep this email. It is the receipt for your order. Your passes are in a separate message.</p>
        </td></tr>
        <tr><td style="padding:22px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Order</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${escapeHtml(reference)}</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Date</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${when}</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Status</p>
                <p style="margin:6px 0 0;"><span style="display:inline-block;background:#15151e;color:#fff;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">Paid</span></p>
              </td>
            </tr>
          </table>
          ${who}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr><td style="padding:0 0 8px;border-bottom:1px solid #efece8;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">Description</td><td style="padding:0 0 8px;border-bottom:1px solid #efece8;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:right;">Qty</td></tr>
            ${rows}
          </table>
          ${sum}
        </td></tr>`);
}

async function send({ to, reference, password: code, lines, total }) {
  const key = (process.env.BREVO_API_KEY || "").trim();
  const from = (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM || "").trim();
  if (!key || !from || !to) return false;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.ticketing-formula1.com").replace(/\/$/, "");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Formula 1 Tickets", email: from },
      to: [{ email: to }],
      subject: `Your tickets are confirmed — ${reference}`,
      htmlContent: html({ reference, password: code, site }),
    }),
  });
  const receipt = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Formula 1 Tickets", email: from },
      to: [{ email: to }],
      subject: `Your receipt — ${reference}`,
      htmlContent: invoice({ reference, lines, total, site, email: to }),
    }),
  });
  return res.ok && receipt.ok;
}

module.exports = { password, hash, same, html, invoice, send };
