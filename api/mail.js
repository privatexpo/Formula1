const crypto = require("crypto");
const i18n = require("../js/i18n");

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

function shell(site, body, lang) {
  const dir = i18n.normalize(lang) === "ar" ? "rtl" : "ltr";
  return `<!DOCTYPE html><html lang="${i18n.normalize(lang)}" dir="${dir}"><body style="margin:0;background:#f7f4f1;font-family:Arial,Helvetica,sans-serif;color:#15151e;">
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

function html({ reference, password: code, site, lang }) {
  const t = (key, vars) => i18n.t(lang, key, vars);
  const open = `${site}/booking.html`;
  return shell(site, `
        <tr><td align="center" style="padding:28px 28px 8px;text-align:center;">
          <p style="margin:0;color:#e10600;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(t("mail.kickerPay"))}</p>
          <h1 style="margin:8px 0 0;font-size:28px;font-weight:600;letter-spacing:0;">${escapeHtml(t("mail.yourTickets"))}</h1>
          <p style="margin:10px 0 0;color:#5c5c66;font-size:15px;line-height:1.5;">${escapeHtml(t("mail.leadTickets", { ref: reference }))}</p>
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 0;text-align:center;">
          <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">${escapeHtml(t("mail.password"))}</p>
          <p style="margin:6px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:0.08em;">${escapeHtml(code)}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 28px 8px;text-align:center;">
          <a href="${open}" style="display:inline-block;background:#e10600;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:999px;">${escapeHtml(t("mail.open"))}</a>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px 8px;text-align:center;">
          <p style="margin:0;color:#5c5c66;font-size:13px;line-height:1.5;">${escapeHtml(t("mail.qr"))}</p>
        </td></tr>`, lang);
}

function invoice({ reference, lines, total, site, placed, email, lang }) {
  const t = (key, vars) => i18n.t(lang, key, vars);
  const rows = (lines || [])
    .map((line) => `<tr><td style="padding:12px 0;border-bottom:1px solid #efece8;font-size:14px;color:#15151e;">${escapeHtml(line.name)}</td><td style="padding:12px 0;border-bottom:1px solid #efece8;font-size:14px;color:#15151e;text-align:right;">${Number(line.qty) || 1}</td></tr>`)
    .join("");
  const when = escapeHtml(placed || new Intl.DateTimeFormat(i18n.localeOf(lang), { day: "numeric", month: "long", year: "numeric" }).format(new Date()));
  const who = email ? `<p style="margin:14px 0 0;color:#5c5c66;font-size:14px;text-align:center;">${escapeHtml(t("mail.billed"))} <b style="color:#15151e;">${escapeHtml(email)}</b></p>` : "";
  const sum = total
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:#15151e;border-radius:12px;"><tr><td style="padding:14px 16px;color:#fff;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t("mail.totalPaid"))}</td><td style="padding:14px 16px;color:#fff;font-size:20px;font-weight:600;text-align:right;">${escapeHtml(total)}</td></tr></table>`
    : "";
  return shell(site, `
        <tr><td align="center" style="padding:28px 28px 8px;text-align:center;">
          <p style="margin:0;color:#e10600;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(t("mail.kickerInvoice"))}</p>
          <h1 style="margin:8px 0 0;font-size:28px;font-weight:600;letter-spacing:0;">${escapeHtml(t("mail.yourReceipt"))}</h1>
          <p style="margin:10px 0 0;color:#5c5c66;font-size:15px;line-height:1.5;">${escapeHtml(t("mail.leadReceipt"))}</p>
        </td></tr>
        <tr><td style="padding:22px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t("mail.order"))}</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${escapeHtml(reference)}</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t("mail.date"))}</p>
                <p style="margin:4px 0 0;font-size:14px;font-weight:600;">${when}</p>
              </td>
              <td width="8"></td>
              <td width="33%" style="background:#f7f4f1;border-radius:12px;padding:12px 8px;text-align:center;">
                <p style="margin:0;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t("mail.status"))}</p>
                <p style="margin:6px 0 0;"><span style="display:inline-block;background:#15151e;color:#fff;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:600;">${escapeHtml(t("mail.paid"))}</span></p>
              </td>
            </tr>
          </table>
          ${who}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
            <tr><td style="padding:0 0 8px;border-bottom:1px solid #efece8;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(t("mail.description"))}</td><td style="padding:0 0 8px;border-bottom:1px solid #efece8;color:#8a8a92;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:right;">${escapeHtml(t("mail.qty"))}</td></tr>
            ${rows}
          </table>
          ${sum}
        </td></tr>`, lang);
}

async function send({ to, reference, password: code, lines, total, lang }) {
  const key = (process.env.BREVO_API_KEY || "").trim();
  const from = (process.env.BREVO_SENDER_EMAIL || process.env.MAIL_FROM || "").trim();
  const contact = (process.env.CONTACT_EMAIL || "support@ticketing-formula1.com").trim();
  if (!key || !from || !to) return false;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://www.ticketing-formula1.com").replace(/\/$/, "");
  const language = i18n.normalize(lang);
  const letter = {
    sender: { name: "Formula 1 Tickets", email: from },
    replyTo: { name: "Formula 1 Tickets", email: contact },
    to: [{ email: to }],
  };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      ...letter,
      subject: i18n.t(language, "mail.ticketsSubject", { ref: reference }),
      htmlContent: html({ reference, password: code, site, lang: language }),
    }),
  });
  const receipt = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      ...letter,
      subject: i18n.t(language, "mail.receiptSubject", { ref: reference }),
      htmlContent: invoice({ reference, lines, total, site, email: to, lang: language }),
    }),
  });
  return res.ok && receipt.ok;
}

module.exports = { password, hash, same, html, invoice, send };
