import { bntLogoHex } from "./logo-data";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatPdfDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

const TIMES_WIDTHS: Record<string, number> = {
  a: 444, b: 500, c: 444, d: 500, e: 444, f: 333, g: 500, h: 500, i: 278, j: 278, k: 500, l: 278, m: 722, 
  n: 500, o: 500, p: 500, q: 500, r: 333, s: 389, t: 278, u: 500, v: 500, w: 722, x: 500, y: 500, z: 444,
  A: 722, B: 667, C: 667, D: 722, E: 611, F: 556, G: 722, H: 722, I: 333, J: 389, K: 722, L: 611, M: 889, 
  N: 722, O: 722, P: 556, Q: 722, R: 667, S: 556, T: 611, U: 722, V: 722, W: 944, X: 722, Y: 722, Z: 611,
  ' ': 250, '.': 250, ',': 250, '!': 333, '?': 444, '-': 333, '0': 500, '1': 500, '2': 500, '3': 500, 
  '4': 500, '5': 500, '6': 500, '7': 500, '8': 500, '9': 500
};

function measureTextWidth(text: string, size: number, font: "F1" | "F2" | "F3") {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += TIMES_WIDTHS[text[i]] ?? 500;
  }
  if (font === 'F2') w *= 1.05;
  if (font === 'F3') w *= 1.02;
  return (w / 1000) * size;
}

function drawCenteredText(text: string, cx: number, y: number, size: number, font: "F1" | "F2" | "F3", color: [number, number, number]) {
  const width = measureTextWidth(text, size, font);
  const [r, g, b] = color.map(c => Number((c / 255).toFixed(3)));
  return [
    `BT`,
    `/${font} ${size} Tf`,
    `${r} ${g} ${b} rg`,
    `${(cx - width / 2).toFixed(2)} ${y} Td`,
    `(${escapePdfText(text)}) Tj`,
    `ET`
  ].join("\n");
}

function drawRightText(text: string, rx: number, y: number, size: number, font: "F1" | "F2" | "F3", color: [number, number, number]) {
  const width = measureTextWidth(text, size, font);
  const [r, g, b] = color.map(c => Number((c / 255).toFixed(3)));
  return [
    `BT`,
    `/${font} ${size} Tf`,
    `${r} ${g} ${b} rg`,
    `${(rx - width).toFixed(2)} ${y} Td`,
    `(${escapePdfText(text)}) Tj`,
    `ET`
  ].join("\n");
}

function drawLeftText(text: string, lx: number, y: number, size: number, font: "F1" | "F2" | "F3", color: [number, number, number]) {
  const [r, g, b] = color.map(c => Number((c / 255).toFixed(3)));
  return [
    `BT`,
    `/${font} ${size} Tf`,
    `${r} ${g} ${b} rg`,
    `${lx} ${y} Td`,
    `(${escapePdfText(text)}) Tj`,
    `ET`
  ].join("\n");
}

function drawRect(x: number, y: number, width: number, height: number, fill?: [number, number, number], stroke?: [number, number, number], lineWidth = 1) {
  const commands: string[] = [];
  if (fill) {
    const [r, g, b] = fill.map(c => Number((c / 255).toFixed(3)));
    commands.push(`${r} ${g} ${b} rg`);
  }
  if (stroke) {
    const [r, g, b] = stroke.map(c => Number((c / 255).toFixed(3)));
    commands.push(`${r} ${g} ${b} RG`);
    commands.push(`${lineWidth} w`);
  }
  commands.push(`${x} ${y} ${width} ${height} re`);
  commands.push(fill && stroke ? "B" : fill ? "f" : "S");
  return commands.join("\n");
}

function drawLine(x1: number, y1: number, x2: number, y2: number, color: [number, number, number], lineWidth = 1) {
  const [r, g, b] = color.map(c => Number((c / 255).toFixed(3)));
  return [`${r} ${g} ${b} RG`, `${lineWidth} w`, `${x1} ${y1} m`, `${x2} ${y2} l`, "S"].join("\n");
}

function drawRibbons(cx: number, cy: number) {
  return [
    `0.72 0.11 0.11 rg`,
    `${cx - 15} ${cy - 20} m`,
    `${cx - 45} ${cy - 110} l`,
    `${cx - 30} ${cy - 105} l`,
    `${cx - 15} ${cy - 120} l`,
    `${cx - 5} ${cy - 20} l`,
    `f`,
    `${cx + 15} ${cy - 20} m`,
    `${cx + 45} ${cy - 110} l`,
    `${cx + 30} ${cy - 105} l`,
    `${cx + 15} ${cy - 120} l`,
    `${cx + 5} ${cy - 20} l`,
    `f`
  ].join("\n");
}

function drawSeal(cx: number, cy: number, r: number) {
  const cmds: string[] = [];
  cmds.push(`0.83 0.68 0.21 rg`);
  cmds.push(`${cx + r} ${cy} m`);
  for (let i = 0; i <= 360; i += 10) {
    const rad = (i * Math.PI) / 180;
    const starR = i % 20 === 0 ? r + 5 : r - 2;
    const x = cx + starR * Math.cos(rad);
    const y = cy + starR * Math.sin(rad);
    cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
  }
  cmds.push(`f`);
  cmds.push(`1 0.84 0 rg`);
  cmds.push(`${cx + r - 5} ${cy} m`);
  for (let i = 0; i <= 360; i += 10) {
    const rad = (i * Math.PI) / 180;
    const x = cx + (r - 5) * Math.cos(rad);
    const y = cy + (r - 5) * Math.sin(rad);
    cmds.push(`${x.toFixed(2)} ${y.toFixed(2)} l`);
  }
  cmds.push(`f`);
  cmds.push(drawCenteredText("NHVR", cx, cy + 10, 16, 'F2', [23, 48, 88]));
  cmds.push(drawCenteredText("SAFETY", cx, cy - 6, 12, 'F2', [23, 48, 88]));
  cmds.push(drawCenteredText("PASSED", cx, cy - 20, 10, 'F1', [184, 134, 11]));
  return cmds.join("\n");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/>$/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
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

export function buildCertificatePdf(input: {
  fullName: string;
  completionId: string;
  issuedAt: string;
  verificationUrl: string;
  licenceClass?: string;
  issuingState?: string;
  depotLocation?: string;
  organizationName: string;
}) {
  const licenceInfo = `LICENCE CLASS: ${input.licenceClass || "HC"} (${input.issuingState || "VIC"})  •  DEPOT HUB: ${input.depotLocation || "Melbourne Hub"}`;
  const logoJpgBytes = hexToBytes(bntLogoHex);

  const commands = [
    drawRect(0, 0, 792, 612, [255, 255, 255]),
    drawRect(30, 30, 732, 552, undefined, [23, 48, 88], 5),
    drawRect(38, 38, 716, 536, undefined, [212, 175, 55], 1.5),
    drawRect(44, 44, 704, 524, [253, 251, 247], [23, 48, 88], 1),

    // Organization Logo (237x92)
    `q`,
    `180 0 0 70 306 482 cm`,
    `/Logo Do`,
    `Q`,

    // Title
    drawCenteredText("NHVR HVNL DRIVER INDUCTION CERTIFICATE", 396, 442, 22, 'F2', [184, 134, 11]),

    // Subtitle
    drawCenteredText("THIS IS TO CERTIFY THAT", 396, 404, 12, 'F1', [100, 100, 100]),

    // Nameline
    drawCenteredText(input.fullName, 396, 352, 34, 'F3', [0, 0, 0]),
    drawLine(196, 335, 596, 335, [184, 134, 11], 1.5),

    // Licence & Depot Info
    drawCenteredText(licenceInfo, 396, 308, 11, 'F2', [30, 58, 95]),

    // Body Text
    drawCenteredText("has successfully completed the NHVR Safety Management System (SMS) Heavy Vehicle Induction", 396, 272, 13, 'F2', [40, 40, 40]),
    drawCenteredText("demonstrating competency in Chain of Responsibility (CoR), Fatigue Rules, Load Restraint 2018 & Pre-Start Checks.", 396, 250, 12, 'F1', [60, 60, 60]),

    // Date Details (Left)
    drawLeftText("Date of Issuance:", 100, 150, 10, 'F1', [100, 100, 100]),
    drawLeftText(formatPdfDate(input.issuedAt), 100, 130, 13, 'F2', [0, 0, 0]),
    drawLine(100, 124, 250, 124, [0, 0, 0], 1),

    // Organization Issuer Info (Right)
    drawRightText("Issued By:", 692, 150, 10, 'F1', [100, 100, 100]),
    drawRightText(input.organizationName, 692, 130, 13, 'F2', [0, 0, 0]),
    drawLine(542, 124, 692, 124, [0, 0, 0], 1),

    // Verification Box (Top Right)
    drawRect(618, 525, 110, 30, [255, 255, 255], [200, 200, 200], 0.5),
    drawLeftText("VERIFICATION ID:", 626, 542, 6, 'F2', [100, 100, 100]),
    drawLeftText(input.completionId, 626, 532, 8, 'F1', [0, 0, 0]),

    // Center Gold Seal & Ribbons
    drawRibbons(396, 140),
    drawSeal(396, 140, 44)
  ].join("\n");

  const encoder = new TextEncoder();
  const cmdBytes = encoder.encode(commands);

  const obj1 = encoder.encode("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  const obj2 = encoder.encode("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  const obj3 = encoder.encode("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /Logo 8 0 R >> >> >> endobj\n");
  const obj4 = concatUint8Arrays([
    encoder.encode(`4 0 obj << /Length ${cmdBytes.length} >> stream\n`),
    cmdBytes,
    encoder.encode("\nendstream endobj\n")
  ]);
  const obj5 = encoder.encode("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj\n");
  const obj6 = encoder.encode("6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >> endobj\n");
  const obj7 = encoder.encode("7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >> endobj\n");
  const obj8 = concatUint8Arrays([
    encoder.encode(`8 0 obj << /Type /XObject /Subtype /Image /Width 237 /Height 92 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoJpgBytes.length} >> stream\n`),
    logoJpgBytes,
    encoder.encode("\nendstream endobj\n")
  ]);

  const objects = [obj1, obj2, obj3, obj4, obj5, obj6, obj7, obj8];

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
  const fullBuffer = concatUint8Arrays(pdfChunks);
  return bytesToBase64(fullBuffer);
}

export const createCertificatePdf = buildCertificatePdf;
