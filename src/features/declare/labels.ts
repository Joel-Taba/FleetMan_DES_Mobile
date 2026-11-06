/** Couleur du statut d'un dossier d'incident. */
export function incidentTone(status: string): "success" | "warning" | "danger" | "muted" | "default" {
  if (status === "RESOLVED" || status === "CLOSED") return "success";
  if (status === "CANCELLED") return "muted";
  if (status === "REPORTED") return "warning";
  return "default";
}
