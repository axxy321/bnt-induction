const TIMES_WIDTHS: Record<string, number> = {
  a: 444, b: 500, c: 444, d: 500, e: 444, f: 333, g: 500, h: 500, i: 278, j: 278, k: 500, l: 278, m: 722,
  n: 500, o: 500, p: 500, q: 500, r: 333, s: 389, t: 278, u: 500, v: 500, w: 722, x: 500, y: 500, z: 444,
  A: 722, B: 667, C: 667, D: 722, E: 611, F: 556, G: 722, H: 722, I: 333, J: 389, K: 722, L: 611, M: 889,
  N: 722, O: 722, P: 556, Q: 722, R: 667, S: 556, T: 611, U: 722, V: 722, W: 944, X: 722, Y: 722, Z: 611,
  " ": 250, ".": 250, ",": 250, "!": 333, "?": 444, "-": 333, "0": 500, "1": 500, "2": 500, "3": 500,
  "4": 500, "5": 500, "6": 500, "7": 500, "8": 500, "9": 500
};

function measureWidth(text: string, size: number, bold = false): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += TIMES_WIDTHS[text[i]] ?? 500;
  }
  const base = (w / 1000) * size;
  return bold ? base * 1.05 : base;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureWidth(candidate, size, bold) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (measureWidth(word, size, bold) > maxWidth) {
      let remaining = word;
      while (measureWidth(remaining, size, bold) > maxWidth) {
        let cut = remaining.length;
        while (cut > 1 && measureWidth(remaining.slice(0, cut), size, bold) > maxWidth) {
          cut--;
        }
        lines.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
      }
      current = remaining;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function concatBytes(arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0;
  for (const arr of arrays) totalLength += arr.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function buildTranscriptPdf(input: {
  moduleTitle: string;
  driverName: string;
  date: string;
  organizationName: string;
  intro?: string;
  bullets?: string[];
  scenario?: string;
}): string {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;

  const ops: string[] = [];

  const text = (str: string, x: number, y: number, size: number, bold = false, color: [number, number, number] = [0, 0, 0]) => {
    const [r, g, b] = color.map((c) => Number((c / 255).toFixed(3)));
    ops.push("BT", `/${bold ? "F2" : "F1"} ${size} Tf`, `${r} ${g} ${b} rg`, `${x.toFixed(2)} ${y.toFixed(2)} Td`, `(${escapePdfText(str)}) Tj`, "ET");
  };

  const rect = (x: number, y: number, w: number, h: number, fill: [number, number, number]) => {
    const [r, g, b] = fill.map((c) => Number((c / 255).toFixed(3)));
    ops.push(`${r} ${g} ${b} rg`, `${x} ${y} ${w} ${h} re`, "f");
  };

  const line = (x1: number, y1: number, x2: number, y2: number, color: [number, number, number], width = 1) => {
    const [r, g, b] = color.map((c) => Number((c / 255).toFixed(3)));
    ops.push(`${r} ${g} ${b} RG`, `${width} w`, `${x1} ${y1} m`, `${x2} ${y2} l`, "S");
  };

  rect(0, 0, pageWidth, pageHeight, [255, 255, 255]);
  ops.push("0.13 0.19 0.31 RG", "3 w", `${margin - 10} ${margin - 10} ${contentWidth + 20} ${pageHeight - 2 * (margin - 10)} re`, "S");

  let y = pageHeight - margin - 8;

  text("BNT LOGISTICS", margin, y, 10, true, [184, 134, 11]);
  y -= 26;
  text("MODULE TRANSCRIPT", margin, y, 20, true, [23, 48, 88]);
  y -= 16;
  line(margin, y, pageWidth - margin, y, [184, 134, 11], 1.5);
  y -= 24;

  for (const l of wrapText(input.moduleTitle, contentWidth, 14, true)) {
    text(l, margin, y, 14, true, [30, 58, 95]);
    y -= 19;
  }
  y -= 8;

  text(`Driver: ${input.driverName}`, margin, y, 10, false, [100, 100, 100]);
  y -= 15;
  text(`Date: ${input.date}`, margin, y, 10, false, [100, 100, 100]);
  y -= 15;
  text(`Organization: ${input.organizationName}`, margin, y, 10, false, [100, 100, 100]);
  y -= 26;

  if (input.intro) {
    for (const l of wrapText(input.intro, contentWidth, 11)) {
      text(l, margin, y, 11);
      y -= 16;
    }
    y -= 14;
  }

  if (input.bullets && input.bullets.length > 0) {
    for (const bullet of input.bullets) {
      const lines = wrapText(bullet, contentWidth - 20, 11);
      text("\u2022", margin, y, 11);
      for (const l of lines) {
        text(l, margin + 16, y, 11);
        y -= 16;
      }
      y -= 5;
    }
    y -= 10;
  }

  if (input.scenario) {
    for (const l of wrapText("Operational Example / Scenario:", contentWidth, 11, true)) {
      text(l, margin, y, 11, true, [30, 58, 95]);
      y -= 16;
    }
    for (const l of wrapText(input.scenario, contentWidth, 11)) {
      text(l, margin, y, 11);
      y -= 16;
    }
    y -= 14;
  }

  const footerY = margin + 6;
  line(margin, footerY + 14, pageWidth - margin, footerY + 14, [200, 200, 200], 0.5);
  text("BNT Logistics \u2022 Official NHVR Accredited Training", margin, footerY, 8, false, [150, 150, 150]);
  const footerRight = `Generated ${new Date().toLocaleDateString("en-AU")}`;
  const fw = measureWidth(footerRight, 8);
  text(footerRight, pageWidth - margin - fw, footerY, 8, false, [150, 150, 150]);

  const encoder = new TextEncoder();
  const cmdBytes = encoder.encode(ops.join("\n"));

  const obj1 = encoder.encode("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  const obj2 = encoder.encode("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  const obj3 = encoder.encode("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n");
  const obj4 = concatBytes([
    encoder.encode(`4 0 obj << /Length ${cmdBytes.length} >> stream\n`),
    cmdBytes,
    encoder.encode("\nendstream endobj\n")
  ]);
  const obj5 = encoder.encode("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj\n");
  const obj6 = encoder.encode("6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >> endobj\n");

  const objects = [obj1, obj2, obj3, obj4, obj5, obj6];
  const pdfHeader = encoder.encode("%PDF-1.4\n");
  let currentOffset = pdfHeader.length;
  const offsets: number[] = [0];
  const pdfChunks: Uint8Array[] = [pdfHeader];

  for (const obj of objects) {
    offsets.push(currentOffset);
    pdfChunks.push(obj);
    currentOffset += obj.length;
  }

  const xrefOffset = currentOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xrefStr += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  pdfChunks.push(encoder.encode(xrefStr));
  const fullBuffer = concatBytes(pdfChunks);
  return bytesToBase64(fullBuffer);
}
