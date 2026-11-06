// Écran à ouvrir depuis une notification (mêmes règles que le web, lib/notifications/links.ts).
import type { Href } from "expo-router";
import { notificationData, notificationEvent, type ServerNotification } from "./api";

/** Trajet en cours : départ, arrêts, preuves, interruption / reprise. */
const ACTIVE_TRIP = /(STARTED|DEPART|INTERRUPT|RESUM|REPLACED|STOP_|SUBMISSION|IN_PROGRESS|CHECKLIST|ARRIV)/;

export function notificationRoute(n: ServerNotification): Href | null {
  const d = notificationData(n);
  const event = notificationEvent(n);
  const is = (prefix: string) => event.startsWith(prefix);

  // Message du gestionnaire (à ce chauffeur ou à toute la flotte) : ouvre la messagerie.
  if (is("MESSAGE_") || d.messageId) return "/messages";
  if (is("EXPENSE_") || is("FUEL_") || is("MAINTENANCE_") || d.fuelRechargeId || d.maintenanceId || d.expenseId) {
    return "/(tabs)/declare";
  }
  // Mission interrompue / reprise après un incident : le chauffeur retrouve son trajet.
  if (d.tripId && /^INCIDENT_TRIP_(INTERRUPTED|RESUMED)/.test(event)) return "/trip/active";
  if (d.incidentId) return { pathname: "/incident/[id]", params: { id: d.incidentId } };
  if (d.tripId || is("TRIP_") || is("STOP_") || is("SUBMISSION_")) {
    const active = Boolean(d.stopId || d.submissionId) || ACTIVE_TRIP.test(event);
    if (active) return "/trip/active";
    return d.tripId ? { pathname: "/trip/[id]", params: { id: d.tripId } } : "/(tabs)/trips";
  }
  if (d.assignmentId || d.scheduleId || d.absenceId || is("SHIFT_") || is("SCHEDULE_") || is("ABSENCE_") || is("ASSIGNMENT_")) {
    return "/assignments";
  }
  if (d.documentId || is("DOCUMENT_")) return "/documents";
  if (d.vehicleId || is("VEHICLE_")) return "/(tabs)/vehicle";
  return null;
}
