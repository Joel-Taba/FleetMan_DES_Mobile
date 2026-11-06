// Export PDF des pièces (impression en cas de contrôle). Les fichiers sont protégés par le
// jeton : ils sont toujours lus avec authorizedFetch, jamais ouverts par Linking.
import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { authorizedFetch, resolveFileUrl } from "@/api/client";
import type { DocumentResponse } from "@/api/types";
import { tr } from "@/i18n";
import { formatDate } from "@/i18n/format";
import { codeLabel } from "@/i18n/labels";
import { DOC_TYPE_LABELS } from "./docTypes";

/** Contexte affiché sur la page exportée. */
export type ExportContext = {
  /** Plaque du véhicule (dossier véhicule). */
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
  /** Titulaire (dossier chauffeur). */
  ownerName?: string | null;
};

export type ExportVehicle = { licensePlate: string; label?: string | null };

type Loaded = { dataUrl: string; mime: string };

/** A4 à 72 dpi (points), comme attendu par expo-print. */
const A4 = { width: 595, height: 842 };

function docLabel(d: DocumentResponse) {
  return tr(DOC_TYPE_LABELS[d.docType] ?? d.docType);
}

function isPdf(d: DocumentResponse, mime?: string) {
  const m = mime || d.fileMimeType || "";
  if (m) return m.includes("pdf");
  return /\.pdf$/i.test(d.fileOriginalName || d.fileUrl);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function safeName(parts: (string | null | undefined)[], ext: string) {
  const base = parts
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return `${base || "document"}-${Date.now()}.${ext}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    reader.readAsDataURL(blob);
  });
}

/** Lit un fichier protégé (Bearer + renouvellement silencieux du jeton). */
async function loadFile(d: DocumentResponse): Promise<{ blob: Blob; mime: string }> {
  const url = resolveFileUrl(d.fileUrl);
  // Pièces de démonstration (local://…) ou sans fichier : rien à télécharger.
  if (!/^(https?:|blob:|data:|file:)/.test(url)) throw new Error(tr("Fichier introuvable ou inaccessible."));
  const res = await authorizedFetch(url);
  if (!res.ok) throw new Error(tr("Fichier introuvable ou inaccessible."));
  const blob = await res.blob();
  const header = res.headers.get("content-type")?.split(";")[0]?.trim();
  const mime = d.fileMimeType || (header && header !== "application/octet-stream" ? header : "") || blob.type || "";
  return { blob, mime };
}

async function loadAsDataUrl(d: DocumentResponse): Promise<Loaded> {
  const { blob, mime } = await loadFile(d);
  return { dataUrl: await blobToDataUrl(blob), mime };
}

/** Écrit un fichier en cache (natif) à partir d'un data URL base64. */
async function writeCacheFile(dataUrl: string, name: string): Promise<File> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(dataUrl.slice(dataUrl.indexOf(",") + 1), { encoding: "base64" });
  return file;
}

async function sharePdf(uri: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr("Partage indisponible sur cet appareil."));
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
}

// ── Gabarit HTML ─────────────────────────────────────────────────────────────

const CSS = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; }
  @media screen { body { padding: 16px; max-width: 800px; margin: 0 auto; } }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: 0.5px; }
  .when { font-size: 11px; color: #6b7280; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
  .meta td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
  .meta td:first-child { color: #6b7280; width: 38%; }
  .scan { width: 100%; max-height: 640px; object-fit: contain; display: block; margin: 0 auto; border: 1px solid #e5e7eb; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  table.list { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.list th { text-align: left; background: #eef2ff; color: #3730a3; padding: 6px; }
  table.list td { padding: 6px; border-bottom: 1px solid #e5e7eb; }
  .note { font-size: 11px; color: #6b7280; margin-top: 10px; }
`;

function header() {
  return `<div class="head"><div class="brand">FleetMan</div><div class="when">${escapeHtml(tr("Édité le"))} ${escapeHtml(formatDate(new Date()))}</div></div>`;
}

function metaRows(d: DocumentResponse, ctx: ExportContext) {
  const rows: [string, string | null | undefined][] = [
    [tr("Véhicule"), ctx.vehiclePlate ? [ctx.vehiclePlate, ctx.vehicleLabel].filter(Boolean).join(" · ") : null],
    [tr("Titulaire"), ctx.ownerName],
    [tr("Numéro"), d.docNumber],
    [tr("Délivré par"), d.issuer],
    [tr("Délivrée le"), d.issueDate ? formatDate(d.issueDate) : null],
    [tr("Expire le"), d.expiryDate ? formatDate(d.expiryDate) : null],
    [tr("Catégories"), d.licenseCategories],
  ];
  return rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`)
    .join("");
}

function documentPage(d: DocumentResponse, ctx: ExportContext, dataUrl: string) {
  return `<section class="page">${header()}<h1>${escapeHtml(docLabel(d))}</h1><table class="meta">${metaRows(d, ctx)}</table><img class="scan" src="${dataUrl}" /></section>`;
}

function htmlDocument(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ── Web : fenêtre ouverte tout de suite (sinon bloquée après l'attente du fichier) ──

function openWebWindow(): Window | null {
  const w = window.open("", "_blank");
  if (w) w.document.write(`<p style="font-family:sans-serif;padding:24px">${escapeHtml(tr("Préparation du document…"))}</p>`);
  return w;
}

function printHtmlInWindow(w: Window | null, html: string) {
  const target = w ?? window.open("", "_blank");
  if (!target) throw new Error(tr("Autorisez les fenêtres surgissantes pour exporter."));
  target.document.open();
  target.document.write(html);
  target.document.close();
  const images = Array.from(target.document.images);
  const ready = images.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r())))));
  void Promise.all(ready).then(() => {
    target.focus();
    target.print();
  });
}

function showBlobInWindow(w: Window | null, blob: Blob) {
  const url = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "application/pdf" }));
  if (w) w.location.href = url;
  else window.open(url, "_blank");
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Exporte une pièce en PDF. Natif : PDF partagé tel quel (la feuille de partage propose
 * Imprimer / Enregistrer) ; image mise en page A4 puis partagée en PDF.
 * Web : PDF ouvert dans un onglet ; image imprimée (« Enregistrer au format PDF »).
 */
export async function exportDocumentPdf(d: DocumentResponse, ctx: ExportContext = {}): Promise<void> {
  const title = [docLabel(d), ctx.vehiclePlate].filter(Boolean).join(" ");
  if (Platform.OS === "web") {
    const w = openWebWindow();
    try {
      const { blob, mime } = await loadFile(d);
      if (isPdf(d, mime)) showBlobInWindow(w, blob);
      else printHtmlInWindow(w, htmlDocument(title, documentPage(d, ctx, await blobToDataUrl(blob))));
    } catch (err) {
      w?.close();
      throw err;
    }
    return;
  }
  const { dataUrl, mime } = await loadAsDataUrl(d);
  if (isPdf(d, mime)) {
    const file = await writeCacheFile(dataUrl, safeName([docLabel(d), ctx.vehiclePlate], "pdf"));
    await sharePdf(file.uri, title);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: htmlDocument(title, documentPage(d, ctx, dataUrl)), ...A4 });
  await sharePdf(uri, title);
}

/** Ouvre une pièce (aperçu natif, ou onglet sur le web) sans passer par Linking. */
export async function openDocumentFile(d: DocumentResponse): Promise<void> {
  if (Platform.OS === "web") {
    const w = openWebWindow();
    try {
      const { blob } = await loadFile(d);
      showBlobInWindow(w, blob);
    } catch (err) {
      w?.close();
      throw err;
    }
    return;
  }
  const { dataUrl, mime } = await loadAsDataUrl(d);
  const ext = isPdf(d, mime) ? "pdf" : (mime.split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
  const file = await writeCacheFile(dataUrl, safeName([docLabel(d)], ext));
  try {
    await file.preview({ title: docLabel(d), mimeType: mime || undefined });
  } catch {
    if (!(await Sharing.isAvailableAsync())) throw new Error(tr("Aucune application pour ouvrir ce fichier."));
    await Sharing.shareAsync(file.uri, { mimeType: mime || undefined, dialogTitle: docLabel(d) });
  }
}

/**
 * Fiche PDF de tous les papiers d'un véhicule : tableau récapitulatif puis une page par
 * pièce image. Les pièces au format PDF sont signalées, à exporter séparément.
 */
export async function exportVehicleSheetPdf(vehicle: ExportVehicle, docs: DocumentResponse[]): Promise<void> {
  const web = Platform.OS === "web";
  const w = web ? openWebWindow() : null;
  try {
    const ctx: ExportContext = { vehiclePlate: vehicle.licensePlate, vehicleLabel: vehicle.label };
    const loaded = await Promise.all(docs.map((d) => loadAsDataUrl(d).catch(() => null)));
    const rows = docs
      .map((d, i) => {
        const l = loaded[i];
        const pdf = l ? isPdf(d, l.mime) : isPdf(d);
        const note = !l ? tr("fichier inaccessible") : pdf ? tr("fichier PDF joint, à exporter séparément") : "";
        return `<tr><td>${escapeHtml(docLabel(d))}${note ? `<div class="note">${escapeHtml(note)}</div>` : ""}</td><td>${escapeHtml(d.docNumber ?? "-")}</td><td>${escapeHtml(d.issueDate ? formatDate(d.issueDate) : "-")}</td><td>${escapeHtml(d.expiryDate ? formatDate(d.expiryDate) : "-")}</td><td>${escapeHtml(codeLabel(d.status))}</td></tr>`;
      })
      .join("");
    const title = `${tr("Papiers du véhicule")} ${vehicle.licensePlate}`;
    const summary = `<section class="page">${header()}<h1>${escapeHtml(title)}</h1>${
      vehicle.label ? `<p class="note">${escapeHtml(vehicle.label)}</p>` : ""
    }<table class="list"><thead><tr><th>${escapeHtml(tr("Pièce"))}</th><th>${escapeHtml(tr("Numéro"))}</th><th>${escapeHtml(tr("Délivrée le"))}</th><th>${escapeHtml(
      tr("Expire le")
    )}</th><th>${escapeHtml(tr("État"))}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    const pages = docs
      .map((d, i) => {
        const l = loaded[i];
        return l && !isPdf(d, l.mime) ? documentPage(d, ctx, l.dataUrl) : "";
      })
      .join("");
    const html = htmlDocument(title, summary + pages);
    if (web) {
      printHtmlInWindow(w, html);
      return;
    }
    const { uri } = await Print.printToFileAsync({ html, ...A4 });
    await sharePdf(uri, title);
  } catch (err) {
    w?.close();
    throw err;
  }
}
