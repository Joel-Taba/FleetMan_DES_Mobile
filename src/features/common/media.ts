// Photos (expo-image-picker) et position (expo-location) pour les écrans terrain.
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Platform } from "react-native";
import type { PickedFile } from "@/api/driver";
import { tr } from "@/i18n";

/** Taille max d'une pièce, comme le web (lib/documents.ts) : 10 Mo. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function guessMime(name: string, fallback = "image/jpeg") {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return fallback;
}

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedFile {
  const fromUri = asset.uri.split("/").pop()?.split("?")[0] ?? "";
  let name = asset.fileName || (fromUri.includes(".") ? fromUri : `photo-${Date.now()}.jpg`);
  let mimeType = asset.mimeType || guessMime(name);
  // Les originaux HEIC/AVIF ne sont pas acceptés par le serveur : on les publie en JPEG compressé.
  if (!ALLOWED_MIMES.includes(mimeType)) {
    mimeType = "image/jpeg";
    name = name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  return { uri: asset.uri, name, mimeType, size: asset.fileSize ?? null, file: (asset.file as Blob | undefined) ?? null };
}

/** Contrôle du fichier, mêmes messages que le web (validateDocumentFile). */
export function validatePicked(file: PickedFile): string | null {
  if (file.size != null && file.size > MAX_FILE_BYTES) {
    return `${tr("Fichier trop volumineux (max")} 10 ${tr("Mo).")}`;
  }
  if (!ALLOWED_MIMES.includes(file.mimeType)) {
    return tr("Format non autorisé. Utilisez PDF, JPEG, PNG ou WebP.");
  }
  return null;
}

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7, allowsEditing: false };

/** Prise de vue avec l'appareil photo. Sur le web, le navigateur propose le fichier ou la caméra. */
export async function takePhoto(): Promise<PickedFile | null> {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error(tr("Autorisez l'accès à l'appareil photo pour joindre une photo."));
  }
  const result = await ImagePicker.launchCameraAsync(OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  return toPicked(result.assets[0]);
}

/** Choix d'une image dans la galerie. */
export async function pickFromLibrary(): Promise<PickedFile | null> {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error(tr("Autorisez l'accès aux photos pour joindre une image."));
  }
  const result = await ImagePicker.launchImageLibraryAsync(OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  return toPicked(result.assets[0]);
}

export type Coords = { latitude: number; longitude: number };

/** Position actuelle du téléphone (permission demandée à la volée). */
export async function currentCoords(): Promise<Coords> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error(tr("Autorisez la localisation pour joindre votre position."));
  const last = Platform.OS === "web" ? null : await Location.getLastKnownPositionAsync({ maxAge: 60000 }).catch(() => null);
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return tr(fallback);
}
