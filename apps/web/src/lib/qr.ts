import QRCode from "qrcode";

/**
 * Generates a real, scannable QR code as a base64 data URL.
 * Encodes the provided verificationUrl so it opens directly when scanned.
 */
export async function generateQrCodeDataUrl(url: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    width: 220,
    margin: 2,
    color: {
      dark: "#172858",  // Navy matching certificate theme
      light: "#FFFBF7", // Ivory matching certificate background
    },
  });
  return dataUrl;
}

/**
 * Generates a real, scannable QR code as an inline SVG string.
 * Used when embedding into HTML/DOM contexts.
 */
export async function generateQrCodeSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    width: 200,
    margin: 2,
    color: {
      dark: "#172858",
      light: "#FFFBF7",
    },
  });
  return svg;
}
