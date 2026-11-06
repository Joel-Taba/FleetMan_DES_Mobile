import type { AuthPayload } from "@/auth/types";

import { apiFetch } from "./client";

// Inscription d'un chauffeur : demande et activation sans session, puis finalisation connectée.

export type RegistrationInput = {
  fleetCode: string;
  firstName: string;
  lastName: string;
  licenceNumber: string;
  phone?: string;
  email?: string;
};

export function submitRegistration(body: RegistrationInput) {
  return apiFetch<{ id: string; fleetName: string; status: string }>("/api/v1/public/driver-registrations", {
    method: "POST",
    body,
    auth: false,
  });
}

export function activateAccount(contact: string, code: string, password: string) {
  return apiFetch<{ username: string; auth: AuthPayload }>("/api/v1/public/driver-registrations/activate", {
    method: "POST",
    body: { contact, code, password },
    auth: false,
  });
}

export type OnboardingProfile = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  licenceNumber: string | null;
  photoUrl: string | null;
  birthDate: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  fleetName: string | null;
};

export type OnboardingDoc = { docType: string; label: string; state: string };

export type OnboardingStatus = {
  completed: boolean;
  completedAt: string | null;
  profile: OnboardingProfile;
  missingProfile: string[];
  documents: OnboardingDoc[];
  missingDocuments: string[];
  canComplete: boolean;
};

export function fetchOnboarding() {
  return apiFetch<OnboardingStatus>("/api/v1/drivers/me/onboarding");
}

export function updateOnboardingProfile(body: {
  birthDate?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  phone?: string;
}) {
  return apiFetch<OnboardingStatus>("/api/v1/drivers/me/onboarding/profile", { method: "PUT", body });
}

export function completeOnboarding() {
  return apiFetch<OnboardingStatus>("/api/v1/drivers/me/onboarding/complete", { method: "POST" });
}

/** Passe la finalisation pour l'instant : l'espace s'ouvre, l'engagement reste bloqué sans pièces approuvées. */
export function skipOnboarding() {
  return apiFetch<OnboardingStatus>("/api/v1/drivers/me/onboarding/skip", { method: "POST" });
}
