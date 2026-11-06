// Types de pièces et règles de saisie, portés de lib/documents.ts et DocumentPreviewCard du web.
import type { Tone } from "../driver/rules";

export const DRIVER_DOC_TYPES = ["DRIVING_LICENSE", "MEDICAL_CERT", "PROFESSIONAL_CARD", "WORK_CONTRACT", "ID_CARD", "OTHER"] as const;

export const DOC_TYPE_LABELS: Record<string, string> = {
  INSURANCE: "Assurance",
  REGISTRATION: "Carte grise",
  TECHNICAL_CONTROL: "Visite technique",
  TAX_STICKER: "Vignette",
  TRANSPORT_PERMIT: "Licence de transport",
  DRIVING_LICENSE: "Permis de conduire",
  MEDICAL_CERT: "Visite médicale",
  PROFESSIONAL_CARD: "Carte professionnelle",
  WORK_CONTRACT: "Contrat de travail",
  ID_CARD: "Pièce d'identité",
  OTHER: "Autre",
};

export type DocFieldConfig = {
  docNumberPlaceholder?: string;
  showIssuer: boolean;
  issuerPlaceholder?: string;
  expiryMode: "required" | "optional" | "hidden";
  showLicenseCategories: boolean;
};

const base: DocFieldConfig = { showIssuer: true, expiryMode: "optional", showLicenseCategories: false };

export const DRIVER_DOC_FIELD_CONFIG: Record<string, DocFieldConfig> = {
  DRIVING_LICENSE: { ...base, docNumberPlaceholder: "CM-B-123456", issuerPlaceholder: "MINTRANSPORT", expiryMode: "required", showLicenseCategories: true },
  MEDICAL_CERT: { ...base, docNumberPlaceholder: "MED-2026-001", issuerPlaceholder: "Centre médical", expiryMode: "required" },
  PROFESSIONAL_CARD: { ...base, docNumberPlaceholder: "CP-2026-001", expiryMode: "required" },
  WORK_CONTRACT: { ...base, docNumberPlaceholder: "CTR-2026-001", showIssuer: false },
  ID_CARD: { ...base, docNumberPlaceholder: "CNI-123456789", issuerPlaceholder: "État civil" },
  OTHER: { ...base },
};

export function docFieldConfig(docType: string): DocFieldConfig {
  return DRIVER_DOC_FIELD_CONFIG[docType] ?? base;
}

/** État d'une pièce de la checklist. */
export const STATE_TONE: Record<string, Tone> = {
  OK: "success",
  EXPIRING: "warning",
  PENDING: "warning",
  EXPIRED: "danger",
  REJECTED: "danger",
  MISSING: "muted",
};

export const STATE_LABEL: Record<string, string> = {
  OK: "En règle",
  EXPIRING: "Expire bientôt",
  EXPIRED: "Expirée",
  PENDING: "À contrôler",
  REJECTED: "Rejetée",
  MISSING: "Manquante",
};

export function docStatusTone(status: string): Tone {
  if (status === "VALID" || status === "KYC_VALID") return "success";
  if (status === "EXPIRED" || status === "REJECTED" || status === "KYC_INVALID") return "danger";
  if (status === "REPLACED" || status === "ARCHIVED") return "muted";
  return "warning";
}
