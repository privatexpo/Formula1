/* Byte-mode QR, versions 2–4, error correction L. Returns an SVG. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.qrSvg = api.qrSvg;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initField() {
    let value = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = value;
      LOG[value] = i;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function mul(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function ecc(data, length) {
    let gen = [1];
    for (let i = 0; i < length; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= mul(gen[j], EXP[i]);
      }
      gen = next;
    }
    const out = data.concat(new Array(length).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = out[i];
      if (!coef) continue;
      for (let j = 0; j < gen.length; j++) out[i + j] ^= mul(gen[j], coef);
    }
    return out.slice(data.length);
  }

  const VERSIONS = {
    2: { size: 25, data: 34, ec: 10, align: [18], rem: 7 },
    3: { size: 29, data: 55, ec: 15, align: [22], rem: 7 },
    4: { size: 33, data: 80, ec: 20, align: [6, 26], rem: 7 },
  };

  function versionFor(bytes) {
    const need = 2 + bytes + 1;
    if (need <= VERSIONS[2].data) return 2;
    if (need <= VERSIONS[3].data) return 3;
    if (need <= VERSIONS[4].data) return 4;
    return 0;
  }

  function pack(text, spec) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits = [];
    const push = (value, width) => {
      for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, 8);
    bytes.forEach((byte) => push(byte, 8));
    const maxBits = spec.data * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
      data.push(byte);
    }
    const pads = [0xec, 0x11];
    let pad = 0;
    while (data.length < spec.data) data.push(pads[pad++ % 2]);
    return data.concat(ecc(data, spec.ec));
  }

  function formatBits(mask) {
    const data = (0b01 << 3) | mask;
    let rem = data << 10;
    for (let i = 4; i >= 0; i--) {
      if ((rem >>> (i + 10)) & 1) rem ^= 0b10100110111 << i;
    }
    return ((data << 10) | (rem & 0x3ff)) ^ 0b101010000010010;
  }

  function build(text) {
    const version = versionFor(new TextEncoder().encode(text).length);
    if (!version) return null;
    const spec = VERSIONS[version];
    const size = spec.size;
    const dark = Array.from({ length: size }, () => Array(size).fill(false));
    const hold = Array.from({ length: size }, () => Array(size).fill(false));
    const set = (row, col, on) => {
      dark[row][col] = on;
      hold[row][col] = true;
    };
    const finder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const y = row + r;
          const x = col + c;
          if (y < 0 || x < 0 || y >= size || x >= size) continue;
          const edge = r < 0 || c < 0 || r > 6 || c > 6;
          const ring = r === 0 || c === 0 || r === 6 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          set(y, x, !edge && (ring || core));
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    spec.align.forEach((ay) => {
      spec.align.forEach((ax) => {
        if (hold[ay][ax]) return;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const ring = Math.max(Math.abs(r), Math.abs(c)) === 2;
            set(ay + r, ax + c, ring || (r === 0 && c === 0));
          }
        }
      });
    });
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        hold[8][i] = true;
        hold[i][8] = true;
      }
    }
    for (let i = 0; i < 8; i++) {
      hold[8][size - 1 - i] = true;
      hold[size - 1 - i][8] = true;
    }
    hold[size - 8][8] = true;

    const words = pack(text, spec);
    let bit = 0;
    const bitCount = (words.length * 8) + spec.rem;
    const read = () => {
      if (bit >= words.length * 8) {
        bit += 1;
        return false;
      }
      const on = ((words[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
      bit += 1;
      return on;
    };
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (hold[y][x] || bit >= bitCount) continue;
          let on = read();
          if ((x + y) % 2 === 0) on = !on;
          dark[y][x] = on;
        }
      }
    }

    const bits = formatBits(0);
    const on = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i < 15; i++) {
      const bit = on(i);
      if (i < 6) dark[i][8] = bit;
      else if (i < 8) dark[i + 1][8] = bit;
      else dark[size - 15 + i][8] = bit;
      if (i < 8) dark[8][size - i - 1] = bit;
      else if (i < 9) dark[8][15 - i] = bit;
      else dark[8][15 - i - 1] = bit;
    }
    dark[size - 8][8] = true;
    return dark;
  }

  function qrSvg(text) {
    const grid = build(String(text || ""));
    if (!grid) return "";
    const quiet = 4;
    const n = grid.length + quiet * 2;
    const cells = [];
    grid.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) cells.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
      });
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true">${cells.join("")}</svg>`;
  }

  return { qrSvg };
});
