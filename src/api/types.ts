// Types du domaine chauffeur, portés depuis le front web (lib/api/types/manager.ts).
// Les noms de champs suivent exactement les réponses du backend Spring Boot.

export type VehicleLocation = { latitude: number; longitude: number };

export type VehicleOperational = {
  status: boolean | null;
  currentSpeed: number | null;
  fuelLevel: string | null;
  mileage: number | null;
  odometerReading: number | null;
  bearing: number | null;
  timestamp: string | null;
  currentLocation: VehicleLocation | null;
};

export type VehicleFinancial = {
  insuranceNumber: string | null;
  insuranceExpiryDate: string | null;
  registrationDate: string | null;
  purchaseDate: string | null;
  depreciationRate: number | null;
  costPerKm: number | null;
};

export type VehicleMaintenance = {
  lastMaintenanceDate: string | null;
  nextMaintenanceDue: string | null;
  engineStatus: string | null;
  batteryHealth: number | null;
  maintenanceStatus: string | null;
};

export type ApiVehicle = {
  id: string;
  fleetId: string;
  managerId: string;
  currentDriverId: string | null;
  vehicleTypeId: string | null;
  licensePlate: string;
  vehicleSerialNumber: string | null;
  brand: string;
  model: string;
  manufacturingYear: number | null;
  transmissionType: string | null;
  fuelType: string | null;
  tankCapacity: number | null;
  totalSeatNumber: number | null;
  averageFuelConsumption: number | null;
  color: string | null;
  status: string;
  photoUrl: string | null;
  galleryUrls?: string[] | null;
  financialParameters: VehicleFinancial | null;
  maintenanceParameters: VehicleMaintenance | null;
  operationalParameters: VehicleOperational | null;
};

export type DriverAbsence = {
  id: string;
  driverId: string;
  /** LEAVE (congé), SICK_LEAVE (arrêt maladie) ou SUSPENSION. */
  type: string;
  startDate: string;
  endDate: string | null;
  reason: string | null;
  createdAt: string | null;
  cancelledAt: string | null;
};

export type ApiDriver = {
  userId: string;
  fleetId: string;
  managerId: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  licenceNumber: string;
  status: string;
  assignedVehicleId: string | null;
  photoUrl: string | null;
  onActiveTrip?: boolean;
  contractStatus?: string | null;
  hireDate?: string | null;
  currentAbsence?: DriverAbsence | null;
  nextAbsence?: DriverAbsence | null;
  fleetName?: string | null;
  assignedVehicleLabel?: string | null;
};

export type DocumentReviewFields = {
  /** PENDING, APPROVED ou REJECTED. */
  reviewStatus?: string;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  version?: number;
  /** Version en vigueur de la pièce. */
  current?: boolean;
  archiveReason?: string | null;
  submittedBy?: string | null;
  targetType?: string;
  targetId?: string;
  targetName?: string | null;
};

export type DocumentChecklistItem = {
  docType: string;
  legal: boolean;
  mandatory: boolean;
  /** OK, EXPIRING, EXPIRED, PENDING, REJECTED ou MISSING. */
  state: string;
  expiryDate: string | null;
  documentId: string | null;
  renewalPending: boolean;
  /** Pièce demandée par le contrôleur et pas encore déposée. */
  requestedAt?: string | null;
  requestMessage?: string | null;
};

export type DocumentResponse = DocumentReviewFields & {
  id: string;
  driverId?: string;
  vehicleId?: string;
  docType: string;
  docNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  fileUrl: string;
  fileMimeType?: string | null;
  fileOriginalName?: string | null;
  fileSizeBytes?: number | null;
  /** PENDING, REJECTED, VALID, EXPIRING_SOON, EXPIRED, REPLACED, ARCHIVED. */
  status: string;
  daysUntilExpiry: number | null;
  notes: string | null;
  licenseCategories?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DriverDocumentInput = {
  driverId: string;
  docType: string;
  docNumber?: string;
  licenseCategories?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string | null;
  fileUrl: string;
  fileOriginalName?: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  notes?: string;
};

export type UploadFileResponse = {
  fileUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type TripDetailLine = {
  id?: string;
  itemType?: string;
  description?: string;
  quantity?: number;
  weight?: number;
  departureQuantity?: number;
  /** Quantité livrée (ou ramassée) à l'arrêt. */
  deliveredQuantity?: number | null;
  returnQuantity?: number;
  /** Arrêt de la tournée où la ligne est traitée. */
  stopId?: string | null;
  /** Motif d'un écart entre quantité prévue et traitée. */
  shortageReason?: string | null;
};

export type TripStopStatus = "PENDING" | "ARRIVED" | "COMPLETED" | "FAILED" | "SKIPPED";

export type TripStop = {
  id: string;
  tripId: string;
  sequence: number;
  stopType: "DELIVERY" | "PICKUP";
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  instructions?: string | null;
  plannedArrival?: string | null;
  status: TripStopStatus;
  arrivedAt?: string | null;
  completedAt?: string | null;
  recipientName?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
  failureReason?: string | null;
  failureNotes?: string | null;
  delayMinutes?: number | null;
  punctuality?: "ON_TIME" | "LATE" | "EARLY" | null;
};

export type ApiTrip = {
  id: string;
  vehicleId: string;
  driverId: string;
  fleetId?: string | null;
  status: string;
  startDate: string;
  startTime: string;
  scheduledReturnDatetime?: string | null;
  endDate: string | null;
  endTime: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  tripCode?: string | null;
  departureKmIndex?: number | null;
  departureFuelIndex?: number | null;
  departureLocation?: string | null;
  departureLat?: number | null;
  departureLng?: number | null;
  returnLocation?: string | null;
  returnLat?: number | null;
  returnLng?: number | null;
  returnKmIndex?: number | null;
  returnFuelIndex?: number | null;
  computedDistanceKm?: number | null;
  computedFuelConsumed?: number | null;
  missionObject?: string | null;
  destinationLocation?: string | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  arrivedAt?: string | null;
  arrivalLocation?: string | null;
  arrivalNotes?: string | null;
  assignmentId?: string | null;
  cancelReason?: string | null;
  departureRegisteredAt?: string | null;
  /** Véhicule immobilisé par un incident grave pendant le trajet (mission suspendue). */
  interruptedAt?: string | null;
  resumedAt?: string | null;
  interruptionIncidentId?: string | null;
  interrupted?: boolean;
  details?: TripDetailLine[];
  stops?: TripStop[];
};

export type AssignmentResponse = {
  id: string;
  scheduleId: string;
  fleetId: string;
  vehicleId: string;
  driverId: string;
  startDatetime: string;
  endDatetime: string;
  status: string;
  actualKm: number | null;
  notes: string | null;
  createdAt: string;
  tripCount?: number;
  /** Accusé de réception du chauffeur (remis à zéro à chaque modification). */
  acknowledgedAt?: string | null;
  /** Motif de la dernière modification après publication. */
  changeReason?: string | null;
  changedAt?: string | null;
  workRuleOverride?: string | null;
  cancelReason?: string | null;
};

/** Complément de chargement signalé en route par le chauffeur. */
export type MissionSubmission = {
  id: string;
  tripId: string;
  submittedBy: string;
  changeType: "ADD" | "REMOVE";
  detailId: string | null;
  itemType: string;
  description: string | null;
  quantity: number | null;
  weight: number | null;
  notes: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SubmissionBody = {
  changeType: "ADD" | "REMOVE";
  detailId?: string;
  itemType: string;
  description?: string;
  quantity?: number;
  notes?: string;
  stopId?: string;
};

export type IncidentResponse = {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  incidentDateTime: string;
  resolvedAt: string | null;
  cost: number | null;
  isCritical: boolean;
  isOpen: boolean;
  vehicleId: string;
  vehicleRegistration: string | null;
  driverId: string | null;
  driverFullName: string | null;
  report?: string | null;
  reportedBy?: string | null;
  policeReportNumber?: string | null;
  insuranceClaimNumber?: string | null;
};

export type IncidentCaseDetails = {
  locationLabel: string | null;
  estimatedCost: number | null;
  injuries: boolean;
  injuriesCount: number | null;
  thirdPartyInvolved: boolean;
  thirdPartyName: string | null;
  thirdPartyPlate: string | null;
  thirdPartyInsurer: string | null;
  thirdPartyContact: string | null;
  insuranceStatus: string;
  insurerName: string | null;
  refundAmount: number | null;
  refundDate: string | null;
  rootCause: string | null;
  correctiveAction: string | null;
  responsibility: string;
  maintenanceId: string | null;
  handlerId: string | null;
  acknowledgedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export type IncidentAttachment = {
  id: string;
  kind: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export type IncidentCase = {
  incident: IncidentResponse;
  details: IncidentCaseDetails;
  tripCode: string | null;
  handlerName: string | null;
  reportedByName: string | null;
  vehicleStatus: string | null;
  vehicleImmobilized: boolean;
  vehicleDrivable: boolean;
  attachments: IncidentAttachment[];
  timeline: { at: string; type: string; fromStatus: string | null; toStatus: string | null; actor: string | null; note: string | null }[];
  costs: { id: string; type: string; amount: number; description: string | null; status: string; approvalLevel: string | null; receiptUrl: string | null; date: string; rejectionReason: string | null; source: string }[];
  approvedCosts: number;
  pendingCosts: number;
  netCost: number;
  closureGaps: string[];
  handlers: { id: string; name: string }[];
};

export type CreateIncidentInput = {
  type: string;
  description?: string;
  severity?: string;
  estimatedCost?: number;
  vehicleId: string;
  driverId?: string;
  reportedBy?: string;
  occurredAt?: string;
  vehicleDrivable?: boolean;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  injuries?: boolean;
  injuriesCount?: number;
  thirdPartyInvolved?: boolean;
  thirdPartyName?: string;
  thirdPartyPlate?: string;
  thirdPartyInsurer?: string;
  thirdPartyContact?: string;
};

export type IncidentFormValues = Omit<CreateIncidentInput, "vehicleId" | "driverId" | "reportedBy">;

export type MaintenanceResponse = {
  id: string;
  subject: string;
  cost: number | null;
  dateTime: string;
  report: string | null;
  vehicleId: string;
  vehicleRegistration: string | null;
  driverId: string | null;
  driverFullName: string | null;
};

export type FuelRechargeResponse = {
  id: string;
  quantity: number;
  price: number;
  unitCost: number | null;
  rechargeDateTime: string;
  stationName: string | null;
  vehicleId: string;
  vehicleRegistration: string | null;
  driverId: string | null;
  driverFullName: string | null;
};

/** Notification in-app (GET /api/v1/notifications), propre à l'utilisateur connecté. */
export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string | null;
  isRead?: boolean;
  read?: boolean;
  createdAt: string | null;
  dataJson: string | null;
};

export type NotificationPage = {
  content: AppNotification[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
};

// ── Dossier d'incident : échanges et résumé (domaine incidents) ─────────────

/** Résumé du dossier renvoyé dans les listes d'incidents (/mine). */
export type IncidentSummary = IncidentResponse & {
  location?: { longitude: number; latitude: number; name?: string | null } | null;
  vehicleDrivable?: boolean;
  vehicleImmobilized?: boolean;
  locationLabel?: string | null;
  photoCount?: number | null;
  handlerName?: string | null;
  tripId?: string | null;
  tripCode?: string | null;
  tripInterrupted?: boolean | null;
  declaredAt?: string | null;
  lastEventType?: string | null;
  infoRequestPending?: boolean | null;
};

/** Dossier avec la demande d'information en attente et l'auteur (chauffeur ou non) de chaque étape. */
export type IncidentCaseThread = Omit<IncidentCase, "incident" | "timeline"> & {
  incident: IncidentSummary;
  timeline: (IncidentCase["timeline"][number] & { byDriver?: boolean })[];
  pendingInfoRequest?: string | null;
};

// ── Effectifs : absences, demandes d'absence, relevés terrain (domaine workforce) ──

/** Demande d'absence du chauffeur : PENDING, APPROVED, REJECTED ou WITHDRAWN. */
export type AbsenceRequest = {
  id: string;
  driverId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  decidedAt: string | null;
  decisionReason: string | null;
  absenceId: string | null;
  createdAt: string;
  conflicts: number;
};

/** Relevé terrain (compteur, jauge) avec son auteur et ses anomalies. */
export type VehicleOperationalUpdate = {
  id: string;
  vehicleId: string;
  authorName: string | null;
  odometerBefore: number | null;
  odometerAfter: number | null;
  fuelBefore: string | null;
  fuelAfter: string | null;
  accepted: boolean;
  anomalies: string[];
  createdAt: string;
};

// ── Messagerie chauffeur ↔ gestionnaire (domaine messages) ──────────────────

/** Message du fil chauffeur / gestionnaire ; `broadcast` : envoyé à toute la flotte. */
export type DriverMessage = {
  id: string;
  driverId: string;
  senderId: string;
  senderName: string | null;
  fromDriver: boolean;
  body: string;
  broadcast: boolean;
  readAt: string | null;
  createdAt: string;
};

export type MessageUnreadCount = { unread: number };

// ── Dépenses déclarées par le chauffeur (péage, amende, autre) ──────────────

/** Types de dépense qu'un chauffeur peut déclarer à la main (BDG_028 pour les autres). */
export type ManualExpenseType = "TOLL" | "FINE" | "OTHER";

/** GET/POST /api/v1/budget/expenses : statut PENDING puis APPROVED ou REJECTED (motif). */
export type ExpenseResponse = {
  id: string;
  expenseType: string;
  amount: number;
  description: string | null;
  expenseDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  sourceType: "AUTO" | "MANUAL" | string;
  rejectionReason: string | null;
  validatedAt: string | null;
  vehicleId: string;
  vehicleRegistration: string | null;
  driverId: string | null;
  createdAt: string;
  createdBy?: string | null;
  approvalLevel?: "MANAGER" | "ADMIN" | null;
  overBudget?: boolean;
  receiptUrl?: string | null;
  receiptName?: string | null;
  receiptMime?: string | null;
};

export type CreateExpenseInput = {
  expenseType: ManualExpenseType;
  amount: number;
  vehicleId: string;
  description?: string;
  /** Heure locale "AAAA-MM-JJTHH:MM:SS" (défaut serveur : maintenant ; jamais dans le futur). */
  expenseDate?: string;
  receiptUrl?: string;
  receiptName?: string;
  receiptMime?: string;
};

// ── Suivi GPS en direct (partage de position pendant la tournée) ───────────

/** Point GPS envoyé pendant un trajet en cours (vitesse en km/h, précision en mètres). */
export type TelemetryInput = {
  lat: number;
  lng: number;
  speed?: number | null;
  accuracy?: number | null;
};

/** Réponse du serveur : `accepted` false si le point arrive moins de 15 s après le précédent. */
export type TelemetryAck = {
  accepted: boolean;
  outcome: "RECORDED" | "TOO_SOON";
  positionAt: string | null;
  retryInSeconds: number;
};
