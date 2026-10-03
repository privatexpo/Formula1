const barcode = require("../js/barcode");
const qr = require("../js/qr");
const i18n = require("../js/i18n");

const PAGE_W = 841.89;
const PAGE_H = 595.28;

const WIN = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function encodeWin(text) {
  const chars = [...String(text || "")];
  const bytes = [];
  let dropped = false;
  for (const char of chars) {
    const code = char.codePointAt(0);
    if (code === 0x20 || (code >= 0x21 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else if (WIN[char] != null) {
      bytes.push(WIN[char]);
    } else if (char === "\n" || char === "\t") {
      bytes.push(0x20);
    } else {
      dropped = true;
    }
  }
  return { bytes: Buffer.from(bytes), dropped };
}

function label(lang, key, vars) {
  const local = encodeWin(i18n.t(lang, key, vars));
  if (!local.dropped && local.bytes.length) return local.bytes;
  return encodeWin(i18n.t("en", key, vars)).bytes;
}

function plain(text) {
  return encodeWin(text).bytes;
}

function escapePdf(bytes) {
  const out = [];
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out.push(0x5c);
    out.push(byte);
  }
  return Buffer.from(out);
}

function n(value) {
  return (Math.round(value * 100) / 100).toString();
}

function widthOf(bytes, size, bold) {
  return bytes.length * size * (bold ? 0.56 : 0.5);
}

function fit(bytes, size, max, bold) {
  let next = Buffer.from(bytes);
  while (next.length > 1 && widthOf(next, size, bold) > max) next = next.subarray(0, next.length - 1);
  return next;
}

function vectors(svg) {
  const box = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg || "");
  if (!box) return null;
  const bars = [];
  const re = /<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"\/>/g;
  let match;
  while ((match = re.exec(svg))) {
    bars.push({
      x: Number(match[1]),
      y: Number(match[2]),
      w: Number(match[3]),
      h: Number(match[4]),
    });
  }
  if (!bars.length) return null;
  return { width: Number(box[1]), height: Number(box[2]), bars };
}

function paint(mark, x, y, w, h) {
  let out = "0 0 0 rg\n";
  for (const bar of mark.bars) {
    const dx = x + (bar.x / mark.width) * w;
    const dw = Math.max((bar.w / mark.width) * w, 0.4);
    const dh = (bar.h / mark.height) * h;
    const dy = y + h - ((bar.y + bar.h) / mark.height) * h;
    out += `${n(dx)} ${n(dy)} ${n(dw)} ${n(dh)} re f\n`;
  }
  return out;
}

function text(font, size, x, y, bytes, color) {
  const [r, g, b] = color;
  return Buffer.concat([
    Buffer.from(`BT /F${font} ${n(size)} Tf ${n(r)} ${n(g)} ${n(b)} rg 1 0 0 1 ${n(x)} ${n(y)} Tm (`, "ascii"),
    escapePdf(bytes),
    Buffer.from(") Tj ET\n", "ascii"),
  ]);
}

function fill(x, y, w, h, r, g, b) {
  return `${n(r)} ${n(g)} ${n(b)} rg\n${n(x)} ${n(y)} ${n(w)} ${n(h)} re f\n`;
}

function pageFor(ticket, index, total, lang, holder, reference) {
  const chunks = [Buffer.from(fill(0, 0, PAGE_W, PAGE_H, 0.969, 0.957, 0.945), "ascii")];
  const cardX = 36;
  const cardY = 118;
  const cardW = 770;
  const cardH = 340;
  const stubW = 176;
  chunks.push(Buffer.from(fill(cardX, cardY, cardW, cardH, 1, 1, 1), "ascii"));
  chunks.push(Buffer.from(fill(cardX, cardY, 8, cardH, 0.882, 0.024, 0), "ascii"));
  chunks.push(Buffer.from(fill(cardX + cardW - stubW, cardY, stubW, cardH, 0.988, 0.984, 0.98), "ascii"));

  const bodyX = cardX + 28;
  const bodyRight = cardX + cardW - stubW - 22;
  const bodyW = bodyRight - bodyX;
  let cursor = cardY + cardH - 36;

  const admit = label(lang, "pass.admit");
  chunks.push(text(2, 10, bodyX, cursor, admit, [0.882, 0.024, 0]));
  const count = label(lang, "pass.of", { i: index + 1, n: total });
  chunks.push(text(1, 10, bodyRight - widthOf(count, 10, false), cursor, count, [0.54, 0.54, 0.57]));

  cursor -= 28;
  chunks.push(text(2, 26, bodyX, cursor, fit(plain(ticket.event || "Grand Prix"), 26, bodyW, true), [0.082, 0.082, 0.118]));
  cursor -= 20;
  chunks.push(text(1, 13, bodyX, cursor, fit(plain(ticket.category || ""), 13, bodyW, false), [0.36, 0.36, 0.4]));

  cursor -= 16;
  chunks.push(Buffer.from(`0.94 0.925 0.91 RG 0.6 w\n${n(bodyX)} ${n(cursor)} m ${n(bodyRight)} ${n(cursor)} l S\n`, "ascii"));

  cursor -= 22;
  const weekend = label(lang, "pass.weekend");
  const who = label(lang, "pass.holder");
  chunks.push(text(1, 8, bodyX, cursor, weekend, [0.54, 0.54, 0.57]));
  chunks.push(text(1, 8, bodyX + 250, cursor, who, [0.54, 0.54, 0.57]));
  cursor -= 16;
  chunks.push(text(2, 12, bodyX, cursor, fit(plain(ticket.when || ""), 12, 230, true), [0.082, 0.082, 0.118]));
  chunks.push(text(2, 12, bodyX + 250, cursor, fit(plain(holder || ""), 12, bodyW - 250, true), [0.082, 0.082, 0.118]));

  const raw = String(ticket.code || "");
  const split = raw.lastIndexOf(".");
  const serial = split > 0 ? `${raw.slice(0, split)}   ${raw.slice(split + 1)}` : raw;
  cursor -= 28;
  chunks.push(text(1, 11, bodyX, cursor, fit(plain(serial), 11, bodyW, false), [0.082, 0.082, 0.118]));

  const bars = vectors(barcode.barcodeSvg(raw));
  if (bars) {
    const barH = 62;
    const barY = cardY + 28;
    chunks.push(Buffer.from(fill(bodyX, barY - 8, bodyW, barH + 16, 1, 1, 1), "ascii"));
    chunks.push(Buffer.from(`0.9 0.9 0.91 RG 0.8 w\n${n(bodyX)} ${n(barY - 8)} ${n(bodyW)} ${n(barH + 16)} re S\n`, "ascii"));
    chunks.push(Buffer.from(paint(bars, bodyX + 16, barY, bodyW - 32, barH), "ascii"));
  }

  const mark = vectors(qr.qrSvg(raw));
  if (mark) {
    const size = 132;
    const qx = cardX + cardW - stubW + (stubW - size) / 2;
    const qy = cardY + (cardH - size) / 2;
    chunks.push(Buffer.from(fill(qx - 10, qy - 10, size + 20, size + 20, 1, 1, 1), "ascii"));
    chunks.push(Buffer.from(paint(mark, qx, qy, size, size), "ascii"));
  }

  const brand = plain("F1 TICKETS");
  chunks.push(text(2, 13, cardX, cardY + cardH + 28, brand, [0.882, 0.024, 0]));
  const ref = plain(reference || "");
  chunks.push(text(1, 12, cardX + cardW - widthOf(ref, 12, false), cardY + cardH + 28, ref, [0.36, 0.36, 0.4]));

  const note = fit(label(lang, "pass.noteOpen"), 11, cardW, false);
  chunks.push(text(1, 11, cardX, cardY - 28, note, [0.36, 0.36, 0.4]));

  return Buffer.concat(chunks);
}

function document(pages) {
  const objects = [];
  const font = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  const fontBold = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objects[3] = font;
  objects[4] = fontBold;
  const kids = [];
  pages.forEach((content, index) => {
    const contentId = 5 + index * 2;
    const pageId = contentId + 1;
    kids.push(`${pageId} 0 R`);
    objects[contentId] = Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"),
      content,
      Buffer.from("\nendstream", "ascii"),
    ]);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`;

  const parts = [Buffer.from("%PDF-1.4\n", "ascii")];
  let offset = parts[0].length;
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    if (!objects[id]) continue;
    const body = Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id], "ascii");
    const chunk = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      body,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    offsets[id] = offset;
    parts.push(chunk);
    offset += chunk.length;
  }
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    xref += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(parts);
}

function passesPdf({ tickets, holder, reference, lang }) {
  const ready = (tickets || []).filter((ticket) => ticket && ticket.code);
  if (!ready.length) return null;
  const language = i18n.normalize(lang);
  const pages = ready.map((ticket, index) => pageFor(ticket, index, ready.length, language, holder, reference));
  return document(pages);
}

module.exports = { passesPdf };
