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
  if (font === 'F2') w *= 1.05; // bold is slightly wider
  if (font === 'F3') w *= 1.02; // italic
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
  // Crimson ribbons falling from the seal
  return [
    `0.72 0.11 0.11 rg`, // Crimson red
    // Left ribbon tail
    `${cx - 15} ${cy - 20} m`,
    `${cx - 45} ${cy - 110} l`,
    `${cx - 30} ${cy - 120} l`,
    `${cx - 15} ${cy - 105} l`,
    `${cx} ${cy - 120} l`,
    `f`,
    // Right ribbon tail
    `${cx + 15} ${cy - 20} m`,
    `${cx + 45} ${cy - 110} l`,
    `${cx + 30} ${cy - 120} l`,
    `${cx + 15} ${cy - 105} l`,
    `${cx} ${cy - 120} l`,
    `f`
  ].join("\n");
}

function drawSeal(cx: number, cy: number, r: number) {
  const cmds = [];
  // Golden starburst background
  cmds.push(`0.83 0.69 0.22 rg`);
  cmds.push(`${cx + r} ${cy} m`);
  const points = 40;
  for (let i = 1; i <= points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const rad = i % 2 === 0 ? r : r * 0.85;
    cmds.push(`${(cx + rad * Math.cos(angle)).toFixed(2)} ${(cy + rad * Math.sin(angle)).toFixed(2)} l`);
  }
  cmds.push(`f`);
  
  // Inner navy circle
  cmds.push(`0.09 0.19 0.35 rg`);
  cmds.push(`${cx + r * 0.75} ${cy} m`);
  for (let i = 1; i <= 40; i++) {
    const angle = (i * Math.PI) / 20;
    const rad = r * 0.75;
    cmds.push(`${(cx + rad * Math.cos(angle)).toFixed(2)} ${(cy + rad * Math.sin(angle)).toFixed(2)} l`);
  }
  cmds.push(`f`);
  
  // Very inner white circle
  cmds.push(`1 1 1 rg`);
  cmds.push(`${cx + r * 0.71} ${cy} m`);
  for (let i = 1; i <= 40; i++) {
    const angle = (i * Math.PI) / 20;
    const rad = r * 0.71;
    cmds.push(`${(cx + rad * Math.cos(angle)).toFixed(2)} ${(cy + rad * Math.sin(angle)).toFixed(2)} l`);
  }
  cmds.push(`f`);

  // Gold text inside the seal
  cmds.push(drawCenteredText("OFFICIAL", cx, cy + 5, 8, 'F2', [212, 175, 55]));
  cmds.push(drawCenteredText("SEAL", cx, cy - 5, 8, 'F2', [212, 175, 55]));
  
  return cmds.join("\n");
}

function drawSignature(x: number, y: number) {
  return [
    `0.1 0.1 0.4 RG 1.5 w`,
    `${x} ${y + 12} m`,
    `${x + 10} ${y + 25} ${x + 12} ${y + 2} ${x + 20} ${y + 8} c`,
    `${x + 25} ${y + 18} ${x + 35} ${y + 2} ${x + 45} ${y + 10} c`,
    `${x + 55} ${y + 18} ${x + 65} ${y + 5} ${x + 80} ${y + 15} c`,
    `S`
  ].join("\n");
}

export function createCertificatePdf(input: {
  organizationName: string;
  fullName: string;
  completionId: string;
  issuedAt: string;
  verificationUrl: string;
}) {
  const commands = [
    // Background and formal borders (Landscape 792 x 612)
    drawRect(0, 0, 792, 612, [255, 255, 255]),
    drawRect(30, 30, 732, 552, undefined, [23, 48, 88], 5), // Thick navy border
    drawRect(38, 38, 716, 536, undefined, [212, 175, 55], 1.5), // Thin gold border
    drawRect(44, 44, 704, 524, [253, 251, 247], [23, 48, 88], 1), // Ivory bg, thin navy border

    // Organization Logo
    `q`,
    `180 0 0 60 306 480 cm`,
    `/Logo Do`,
    `Q`,

    // Title
    drawCenteredText("CERTIFICATE OF COMPLETION", 396, 440, 42, 'F2', [184, 134, 11]),

    // Subtitle
    drawCenteredText("THIS IS TO CERTIFY THAT", 396, 390, 14, 'F1', [100, 100, 100]),

    // Nameline
    drawCenteredText(input.fullName, 396, 325, 48, 'F3', [0, 0, 0]),
    drawLine(196, 305, 596, 305, [184, 134, 11], 1),

    // Body Text
    drawCenteredText("has successfully completed all requirements of the comprehensive Induction Training Program", 396, 260, 16, 'F1', [40, 40, 40]),
    drawCenteredText("and has demonstrated exceptional understanding of the safety, compliance, and operational standards.", 396, 236, 16, 'F1', [40, 40, 40]),

    // Date Details (Left)
     drawLeftText("Date of Issuance:", 100, 150, 10, 'F1', [100, 100, 100]),
     drawLeftText(formatPdfDate(input.issuedAt), 100, 130, 14, 'F2', [0, 0, 0]),
     drawLine(100, 125, 250, 125, [0, 0, 0], 1),

    // Signature Area (Right)
    drawSignature(600, 130),
    drawRightText("Authorized Official", 692, 110, 10, 'F1', [100, 100, 100]),
    drawLine(542, 125, 692, 125, [0, 0, 0], 1),

    // Verification Box (Top Right)
    drawRect(618, 525, 110, 30, [255, 255, 255], [200, 200, 200], 0.5),
    drawLeftText("VERIFICATION ID:", 626, 542, 6, 'F2', [100, 100, 100]),
    drawLeftText(input.completionId, 626, 532, 8, 'F1', [0, 0, 0]),

    // Center Gold Seal & Ribbons
    drawRibbons(396, 140),
    drawSeal(396, 140, 46)
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> /XObject << /Logo 8 0 R >> >> >> endobj",
    `4 0 obj << /Length ${new TextEncoder().encode(commands).length} >> stream\n${commands}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >> endobj",
    "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >> endobj",
    "7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >> endobj",
    `8 0 obj << /Type /XObject /Subtype /Image /Width 300 /Height 99 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${bntLogoHex.length} >> stream\n${bntLogoHex}\nendstream endobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${object}\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return btoa(unescape(encodeURIComponent(pdf)));
}
