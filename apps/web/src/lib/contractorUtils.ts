import type { ContractorCompanyRecord } from "../types";

export function validateABN(rawAbn: string): { isValid: boolean; message: string } {
  const digits = rawAbn.replace(/\s+/g, "");
  if (!digits) return { isValid: false, message: "ABN is required" };
  if (!/^\d{11}$/.test(digits)) return { isValid: false, message: "ABN must be exactly 11 numeric digits" };

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  let sum = (parseInt(digits[0], 10) - 1) * weights[0];
  for (let i = 1; i < 11; i++) sum += parseInt(digits[i], 10) * weights[i];
  const isValid = sum % 89 === 0;
  return {
    isValid,
    message: isValid
      ? "ABN checksum verified via Australian Business Register (ABR) standard"
      : "Invalid ABN: checksum failed official ATO modulus 89 verification"
  };
}

export function formatABNDisplay(rawAbn: string): string {
  const digits = rawAbn.replace(/\s+/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

export function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
}

export function computeContractorStatus(contractor: ContractorCompanyRecord): {
  label: string;
  tone: "green" | "amber" | "red" | "grey";
} {
  const dates = [contractor.publicLiabilityExpiry, contractor.workersCompExpiry]
    .map(daysUntil)
    .filter((d): d is number => d !== null);
  if (dates.length > 0) {
    if (dates.some((d) => d < 0)) return { label: "Expired", tone: "red" };
    if (dates.some((d) => d <= 30)) return { label: "Expiring Soon", tone: "amber" };
    return { label: "Compliant", tone: "green" };
  }
  if (contractor.status === "Suspended") return { label: "Suspended", tone: "red" };
  if (contractor.status === "Compliant") return { label: "Compliant", tone: "green" };
  return { label: "Pending Review", tone: "grey" };
}
