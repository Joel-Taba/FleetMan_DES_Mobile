import { Platform } from "react-native";

import { apiFetch, apiUpload } from "./client";

export type AccountProfile = {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  roles?: string[];
  licenceNumber?: string | null;
  vehicleId?: string | null;
  companyName?: string | null;
  lastLoginAt?: string | null;
};

export function fetchMyAccount() {
  return apiFetch<AccountProfile>("/api/v1/account");
}

export function updateMyAccount(body: { firstName: string; lastName: string; phone?: string; email: string }) {
  return apiFetch<AccountProfile>("/api/v1/account", { method: "PUT", body });
}

export function changeMyPassword(currentPassword: string, newPassword: string) {
  return apiFetch<void>("/api/v1/account/password", { method: "PUT", body: { currentPassword, newPassword } });
}

export type PickedImage = { uri: string; fileName?: string | null; mimeType?: string | null; file?: File };

/** POST /api/v1/account/picture (multipart field `file`). */
export async function uploadMyProfilePicture(image: PickedImage): Promise<void> {
  const form = new FormData();
  const name = image.fileName || `photo-${Date.now()}.jpg`;
  const type = image.mimeType || "image/jpeg";
  if (Platform.OS === "web") {
    const blob = image.file ?? (await (await fetch(image.uri)).blob());
    form.append("file", blob, name);
  } else {
    // React Native's FormData accepts a { uri, name, type } descriptor for files.
    form.append("file", { uri: image.uri, name, type } as unknown as Blob);
  }
  await apiUpload<void>("/api/v1/account/picture", form);
}

// ── Mot de passe oublié (sans session, comme le web) ────────────────────────

/** Envoie le lien de réinitialisation ; réponse neutre que le compte existe ou non. */
export function requestPasswordReset(email: string) {
  return apiFetch<void>("/api/v1/auth/forgot-password", { method: "POST", body: { email }, auth: false });
}

/** Nouveau mot de passe avec le jeton reçu par email. */
export function resetPassword(resetToken: string, newPassword: string) {
  return apiFetch<void>("/api/v1/auth/reset-password", { method: "POST", body: { resetToken, newPassword }, auth: false });
}
