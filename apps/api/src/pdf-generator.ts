/**
 * Pure Node.js PDF 1.4 Binary Generator for Admin Reports.
 * Generates structured, professional tabular PDF documents without external native dependencies.
 */

interface ReportPdfInput {
  title: string;
  organizationName: string;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export function generateReportPdfBuffer(input: ReportPdfInput): Buffer {
  const { title, organizationName, rows } = input;
  const dateStr = new Date().toLocaleString("en-AU");
  
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["Details"];
  
  // Format rows into display strings
  const formattedRows = rows.map(row => 
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return "-";
      if (typeof val === "boolean") return val ? "Yes" : "No";
      return String(val);
    })
  );

  // PDF Page Setup (A4 Landscape for wide table data: 842 x 595 points)
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);

  // Column width calculation
  const colCount = Math.max(1, headers.length);
  const colWidth = contentWidth / colCount;

  // Generate stream commands
  const streamLines: string[] = [];

  // Header background bar
  streamLines.push("0.059 0.090 0.165 rg"); // #0f172a
  streamLines.push(`0 ${pageHeight - 70} ${pageWidth} 70 re f`);

  // Header Title
  streamLines.push("BT");
  streamLines.push("/F2 18 Tf");
  streamLines.push("1 1 1 rg"); // White
  streamLines.push(`${margin} ${pageHeight - 42} Td`);
  streamLines.push(`(${escapePdfText(title)}) Tj`);
  streamLines.push("ET");

  // Subtitle
  streamLines.push("BT");
  streamLines.push("/F1 10 Tf");
  streamLines.push("0.584 0.647 0.725 rg"); // #94a3b8
  streamLines.push(`${margin} ${pageHeight - 58} Td`);
  streamLines.push(`(${escapePdfText(`${organizationName} • Generated: ${dateStr} • Total Records: ${rows.length}`)}) Tj`);
  streamLines.push("ET");

  // Table Headers Bar
  let currentY = pageHeight - 95;
  streamLines.push("0.945 0.961 0.976 rg"); // #f1f5f9
  streamLines.push(`${margin} ${currentY - 5} ${contentWidth} 22 re f`);

  // Table Header Labels
  streamLines.push("BT");
  streamLines.push("/F2 9 Tf");
  streamLines.push("0.278 0.333 0.412 rg"); // #475569
  headers.forEach((h, idx) => {
    const x = margin + (idx * colWidth) + 6;
    const label = escapePdfText(h.toUpperCase().slice(0, 18));
    streamLines.push(`${idx === 0 ? x : colWidth} 0 Td`);
    if (idx === 0) {
      streamLines.push(`0 ${currentY} Td`);
    }
    streamLines.push(`(${label}) Tj`);
  });
  streamLines.push("ET");

  currentY -= 20;

  // Table Rows (up to 20 rows per page in simple layout)
  const maxRows = Math.min(formattedRows.length, 22);
  formattedRows.slice(0, maxRows).forEach((row, rIdx) => {
    // Alternating row background
    if (rIdx % 2 === 1) {
      streamLines.push("0.973 0.980 0.988 rg"); // #f8fafc
      streamLines.push(`${margin} ${currentY - 4} ${contentWidth} 18 re f`);
    }

    // Row text
    streamLines.push("BT");
    streamLines.push("/F1 9 Tf");
    streamLines.push("0.118 0.161 0.231 rg"); // #1e293b
    row.forEach((cellVal, cIdx) => {
      const cellText = escapePdfText(cellVal.slice(0, 24));
      if (cIdx === 0) {
        const x = margin + 6;
        streamLines.push(`${x} ${currentY} Td`);
      } else {
        streamLines.push(`${colWidth} 0 Td`);
      }
      streamLines.push(`(${cellText}) Tj`);
    });
    streamLines.push("ET");

    // Horizontal grid line
    streamLines.push("0.898 0.914 0.937 rg"); // #e2e8f0
    streamLines.push("0.5 w");
    streamLines.push(`${margin} ${currentY - 4} m ${pageWidth - margin} ${currentY - 4} l S`);

    currentY -= 18;
  });

  if (formattedRows.length > maxRows) {
    streamLines.push("BT");
    streamLines.push("/F3 9 Tf");
    streamLines.push("0.392 0.455 0.545 rg");
    streamLines.push(`${margin} ${currentY - 10} Td`);
    streamLines.push(`(${escapePdfText(`... and ${formattedRows.length - maxRows} more records.`)} ) Tj`);
    streamLines.push("ET");
  }

  // Footer
  streamLines.push("BT");
  streamLines.push("/F1 8 Tf");
  streamLines.push("0.584 0.647 0.725 rg");
  streamLines.push(`${margin} 20 Td`);
  streamLines.push(`(${escapePdfText(`Confidential - Internal Compliance Report - ${organizationName}`)}) Tj`);
  streamLines.push("ET");

  const streamContent = streamLines.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf-8");

  // Construct PDF Objects
  const pdfObjects: string[] = [];

  // 1 0 obj: Catalog
  pdfObjects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  // 2 0 obj: Pages
  pdfObjects.push("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj");

  // 3 0 obj: Page
  pdfObjects.push(`3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 6 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 7 0 R >> >> >>
endobj`);

  // 4 0 obj: Helvetica Font
  pdfObjects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  // 5 0 obj: Helvetica-Bold Font
  pdfObjects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

  // 6 0 obj: Contents Stream
  pdfObjects.push(`6 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj`);

  // 7 0 obj: Helvetica-Oblique Font
  pdfObjects.push("7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj");

  // Assemble PDF document with XRef table
  const header = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
  let currentOffset = Buffer.byteLength(header, "utf-8");

  const xrefEntries: string[] = ["0000000000 65535 f "];

  pdfObjects.forEach(obj => {
    xrefEntries.push(`${String(currentOffset).padStart(10, "0")} 00000 n `);
    currentOffset += Buffer.byteLength(obj + "\n", "utf-8");
  });

  const xrefOffset = currentOffset;
  const xrefTable = `xref\n0 ${pdfObjects.length + 1}\n` + xrefEntries.join("\n") + "\n";
  const trailer = `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdfString = header + pdfObjects.join("\n") + "\n" + xrefTable + trailer;
  return Buffer.from(fullPdfString, "utf-8");
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
