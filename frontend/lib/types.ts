// Project: Via Nostra
// File: frontend/lib/types.ts
// Purpose: The shapes of the data the website receives from the Via Nostra API:
//          live cars, search results, availability and bookings.

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

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'handed_over'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

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

// File: frontend/lib/types.ts
// END OF FILE