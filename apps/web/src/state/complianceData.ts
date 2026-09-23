import { ComplianceAudit, SOPItem, ComplianceDocumentRequirement, VehicleRecord, ContractorCompanyRecord, SafetyIncidentRecord, SiteCheckinRecord } from "../types";

/**
 * Live initial data stores — zero mock data.
 * All records are fetched dynamically or initialized empty.
 */
export const INITIAL_AUDITS: ComplianceAudit[] = [];

export const INITIAL_SOPS: SOPItem[] = [];

export const INITIAL_DOCUMENTS: ComplianceDocumentRequirement[] = [];

export const INITIAL_VEHICLES: VehicleRecord[] = [];

export const INITIAL_CONTRACTOR_COMPANY: ContractorCompanyRecord = {
  id: "",
  companyName: "",
  tradingName: "",
  abn: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  nhvasAccreditation: "None",
  nhvasNumber: "",
  publicLiabilityPolicy: "",
  publicLiabilityExpiry: "",
  workersCompPolicy: "",
  workersCompExpiry: "",
  primaryDepot: "",
  status: "Pending Review"
};

export const INITIAL_INCIDENTS: SafetyIncidentRecord[] = [];

export const INITIAL_SITE_CHECKINS: SiteCheckinRecord[] = [];
