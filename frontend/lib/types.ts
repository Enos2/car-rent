// Project: Via Nostra
// File: frontend/lib/types.ts
// Purpose: The shapes of all the data the website receives from the Via Nostra API:
//          cars, bookings, verification, payouts, hubs and the staff screens.

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type CarStatus =
  | 'draft'
  | 'submitted'
  | 'rejected'
  | 'awaiting_dropoff'
  | 'live'
  | 'paused'
  | 'suspended'
  | 'retired';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'handed_over'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

// ----- Public cars -----

export type CarListing = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  seats: number;
  transmission: 'manual' | 'automatic';
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  description: string | null;
  currency: string;
  dailyPriceMinor: number;
  depositMinor: number;
  minRentalDays: number;
  maxRentalDays: number;
  liveAt: string | null;
  coverPhotoId: string | null;
  hub: { id: string; name: string; city: string; countryCode: string };
  owner: { displayName: string; accountType: 'individual' | 'company' };
};

export type CarSearchResponse = {
  items: CarListing[];
  total: number;
  limit: number;
  offset: number;
};

export type CarDetailResponse = {
  car: CarListing;
  photos: Array<{ id: string; position: number }>;
};

export type AvailabilityResponse = {
  blocked: Array<{ startDate: string; endDate: string }>;
};

// ----- Bookings -----

export type Booking = {
  id: string;
  carId: string;
  renterId: string;
  ownerId: string;
  hubId: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  days: number;
  currency: string;
  dailyPriceMinor: number;
  subtotalMinor: number;
  depositMinor: number;
  expiresAt: string | null;
  paidAt: string | null;
  handedOverAt: string | null;
  receiptConfirmedAt: string | null;
  returnedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  refundMinor: number | null;
  depositDeductionMinor: number;
  deductionReason: string | null;
  createdAt: string;
  carMake: string;
  carModel: string;
  plateNumber: string;
  hubName: string;
  hubCity: string;
  ownerName: string;
};

export type BookingResponse = {
  booking: Booking;
  hub: {
    id: string;
    name: string;
    city: string;
    address: string;
    openingHours: string | null;
    contactPhone: string | null;
  } | null;
};

export type BookingListResponse = {
  items: Booking[];
  total: number;
  limit: number;
  offset: number;
};

// What an owner sees about a booking of their car.
export type OwnerBooking = {
  id: string;
  carId: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  days: number;
  currency: string;
  subtotalMinor: number;
  depositMinor: number;
  commissionMinor: number;
  ownerShareMinor: number;
  createdAt: string;
  carMake: string;
  carModel: string;
  plateNumber: string;
  hubName: string;
  hubCity: string;
  renterFirstName: string;
};

export type OwnerBookingListResponse = {
  items: OwnerBooking[];
  total: number;
  limit: number;
  offset: number;
};

// What staff see about a booking: everything, including the renter and the money split.
export type AdminBooking = Booking & {
  renterName: string;
  renterEmail: string;
  commissionBps: number;
  commissionMinor: number;
  ownerShareMinor: number;
  handoverOdometerKm: number | null;
  handoverFuelPercent: number | null;
  handoverNotes: string | null;
  returnOdometerKm: number | null;
  returnFuelPercent: number | null;
  returnNotes: string | null;
};

export type AdminBookingListResponse = {
  items: AdminBooking[];
  total: number;
  limit: number;
  offset: number;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  kind: 'charge' | 'refund';
  provider: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
};

// ----- Hubs -----

export type Hub = {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
};

export type HubStaffMember = {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
};

// ----- Identity verification -----

export type VerificationRequest = {
  id: string;
  userId: string;
  kind: 'renter' | 'owner' | 'company';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type VerificationDocument = {
  id: string;
  requestId: string;
  userId: string;
  docType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Requirement = {
  key: string;
  label: string;
  anyOf: string[];
  satisfied: boolean;
};

export type VerificationMe = {
  verificationStatus: VerificationStatus;
  kind: 'renter' | 'owner' | 'company';
  request: VerificationRequest | null;
  requirements: Requirement[];
  documents: VerificationDocument[];
};

export type VerificationQueueItem = {
  id: string;
  userId: string;
  kind: 'renter' | 'owner' | 'company';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  submittedAt: string | null;
  email: string;
  fullName: string;
  companyName: string | null;
};

export type VerificationQueueResponse = {
  items: VerificationQueueItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  accountType: 'individual' | 'company';
  companyName: string | null;
  roles: string[];
  verificationStatus: VerificationStatus;
  isActive: boolean;
  createdAt: string;
};

export type VerificationDetail = {
  request: VerificationRequest;
  user: AdminUser | null;
  documents: VerificationDocument[];
  requirements: Requirement[];
};

// ----- Owner cars -----

export type OwnerCar = {
  id: string;
  ownerId: string;
  hubId: string | null;
  status: CarStatus;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  vin: string | null;
  color: string | null;
  seats: number;
  transmission: 'manual' | 'automatic';
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  description: string | null;
  currency: string;
  dailyPriceMinor: number;
  depositMinor: number;
  minRentalDays: number;
  maxRentalDays: number;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  liveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerCarItem = OwnerCar & { coverPhotoId: string | null };

export type CarDocument = {
  id: string;
  carId: string;
  docType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: string | null;
  createdAt: string;
};

export type CarPhoto = {
  id: string;
  carId: string;
  kind: 'listing' | 'inspection';
  inspectionId: string | null;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
};

export type Inspection = {
  id: string;
  carId: string;
  hubId: string;
  inspectorId: string;
  result: 'passed' | 'failed';
  odometerKm: number;
  fuelLevelPercent: number;
  conditionNotes: string;
  createdAt: string;
};

export type Readiness = { ready: boolean; problems: string[] };

export type OwnerCarDetail = {
  car: OwnerCar;
  documents: CarDocument[];
  photos: CarPhoto[];
  inspections: Inspection[];
  readiness: Readiness;
};

export type QueueCar = OwnerCar & {
  ownerName: string;
  ownerEmail: string;
  hubName: string | null;
};

export type QueueCarResponse = {
  items: QueueCar[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminCarDetail = OwnerCarDetail & {
  owner: {
    id: string;
    fullName: string;
    email: string;
    companyName: string | null;
    verificationStatus: VerificationStatus;
  } | null;
};

export type CarFormValues = {
  make: string;
  model: string;
  year: string;
  plateNumber: string;
  vin: string;
  color: string;
  seats: string;
  transmission: string;
  fuelType: string;
  description: string;
  currency: string;
  dailyPrice: string;
  deposit: string;
  minRentalDays: string;
  maxRentalDays: string;
};

export type CarFormState =
  | {
      message?: string;
      fieldErrors?: Record<string, string>;
      values?: Partial<CarFormValues>;
    }
  | undefined;

// ----- Money -----

export type OwnerBalance = {
  currency: string;
  availableMinor: number;
  pendingPayoutMinor: number;
};

export type Payout = {
  id: string;
  ownerId: string;
  amountMinor: number;
  currency: string;
  status: 'requested' | 'paid' | 'rejected';
  destination: string;
  providerReference: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type PayoutListResponse = {
  items: Payout[];
  total: number;
  limit: number;
  offset: number;
};

export type PlatformBalance = {
  account: string;
  currency: string;
  balanceMinor: number;
};

export type LedgerTransaction = {
  id: string;
  kind: string;
  bookingId: string | null;
  payoutId: string | null;
  currency: string;
  note: string | null;
  createdAt: string;
  entries: Array<{ account: string; userId: string | null; amountMinor: number }> | null;
};

export type AuditItem = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
};

// File: frontend/lib/types.ts
// END OF FILE