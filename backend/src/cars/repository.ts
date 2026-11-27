// Project: Via Nostra
// File: backend/src/cars/repository.ts
// Purpose: All database queries for cars: create and edit listings, status changes,
//          documents, photos, hub inspections, the staff review queue and the
//          public search of live cars.

import { pool } from '../db.js';
import type { AccountType } from '../users/repository.js';
import type { CarDocType, CarStatus, FuelType, Transmission } from './rules.js';

export type Car = {
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
  transmission: Transmission;
  fuelType: FuelType;
  description: string | null;
  currency: string;
  dailyPriceMinor: number;
  depositMinor: number;
  minRentalDays: number;
  maxRentalDays: number;
  rejectionReason: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  liveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewCar = {
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  vin?: string;
  color?: string;
  seats: number;
  transmission: Transmission;
  fuelType: FuelType;
  description?: string;
  currency: string;
  dailyPriceMinor: number;
  depositMinor?: number;
  minRentalDays?: number;
  maxRentalDays?: number;
};

export type CarChanges = Partial<NewCar>;

export type OwnerCarItem = Car & { coverPhotoId: string | null };
export type QueueCar = Car & { ownerName: string; ownerEmail: string; hubName: string | null };

export type CarDocument = {
  id: string;
  carId: string;
  docType: CarDocType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: string | null;
  createdAt: Date;
};

export type PhotoKind = 'listing' | 'inspection';

export type CarPhoto = {
  id: string;
  carId: string;
  kind: PhotoKind;
  inspectionId: string | null;
  mimeType: string;
  sizeBytes: number;
  position: number;
  createdAt: Date;
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
  createdAt: Date;
};

export type CarListing = {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  seats: number;
  transmission: Transmission;
  fuelType: FuelType;
  description: string | null;
  currency: string;
  dailyPriceMinor: number;
  depositMinor: number;
  minRentalDays: number;
  maxRentalDays: number;
  liveAt: Date | null;
  coverPhotoId: string | null;
  hub: { id: string; name: string; city: string; countryCode: string };
  owner: { displayName: string; accountType: AccountType };
};

export type SearchFilters = {
  city?: string;
  countryCode?: string;
  make?: string;
  minDailyPriceMinor?: number;
  maxDailyPriceMinor?: number;
  transmission?: Transmission;
  fuelType?: FuelType;
  minSeats?: number;
  sort: 'newest' | 'price_asc' | 'price_desc';
  limit: number;
  offset: number;
};

const CAR_FIELDS: Array<[string, string]> = [
  ['id', 'id'],
  ['owner_id', 'ownerId'],
  ['hub_id', 'hubId'],
  ['status', 'status'],
  ['make', 'make'],
  ['model', 'model'],
  ['year', 'year'],
  ['plate_number', 'plateNumber'],
  ['vin', 'vin'],
  ['color', 'color'],
  ['seats', 'seats'],
  ['transmission', 'transmission'],
  ['fuel_type', 'fuelType'],
  ['description', 'description'],
  ['currency', 'currency'],
  ['daily_price_minor', 'dailyPriceMinor'],
  ['deposit_minor', 'depositMinor'],
  ['min_rental_days', 'minRentalDays'],
  ['max_rental_days', 'maxRentalDays'],
  ['rejection_reason', 'rejectionReason'],
  ['submitted_at', 'submittedAt'],
  ['approved_at', 'approvedAt'],
  ['live_at', 'liveAt'],
  ['created_at', 'createdAt'],
  ['updated_at', 'updatedAt'],
];

function carColumns(prefix = ''): string {
  return CAR_FIELDS.map(([column, alias]) => `${prefix}${column} AS "${alias}"`).join(', ');
}

const CAR_COLUMNS = carColumns();

const UPDATE_COLUMNS: Record<string, string> = {
  make: 'make',
  model: 'model',
  year: 'year',
  plateNumber: 'plate_number',
  vin: 'vin',
  color: 'color',
  seats: 'seats',
  transmission: 'transmission',
  fuelType: 'fuel_type',
  description: 'description',
  currency: 'currency',
  dailyPriceMinor: 'daily_price_minor',
  depositMinor: 'deposit_minor',
  minRentalDays: 'min_rental_days',
  maxRentalDays: 'max_rental_days',
};

const DOC_COLUMNS = `
  id, car_id AS "carId", doc_type AS "docType", original_name AS "originalName",
  mime_type AS "mimeType", size_bytes AS "sizeBytes",
  to_char(expires_on, 'YYYY-MM-DD') AS "expiresOn", created_at AS "createdAt"
`;

const PHOTO_COLUMNS = `
  id, car_id AS "carId", kind, inspection_id AS "inspectionId",
  mime_type AS "mimeType", size_bytes AS "sizeBytes", position, created_at AS "createdAt"
`;

const INSPECTION_COLUMNS = `
  id, car_id AS "carId", hub_id AS "hubId", inspector_id AS "inspectorId", result,
  odometer_km AS "odometerKm", fuel_level_percent AS "fuelLevelPercent",
  condition_notes AS "conditionNotes", created_at AS "createdAt"
`;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// ----- Cars: create, read, edit -----

export async function createCar(ownerId: string, input: NewCar): Promise<Car> {
  const result = await pool.query<Car>(
    `INSERT INTO cars (owner_id, make, model, year, plate_number, vin, color, seats,
                       transmission, fuel_type, description, currency, daily_price_minor,
                       deposit_minor, min_rental_days, max_rental_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING ${CAR_COLUMNS}`,
    [
      ownerId,
      input.make,
      input.model,
      input.year,
      input.plateNumber,
      input.vin ?? null,
      input.color ?? null,
      input.seats,
      input.transmission,
      input.fuelType,
      input.description ?? null,
      input.currency,
      input.dailyPriceMinor,
      input.depositMinor ?? 0,
      input.minRentalDays ?? 1,
      input.maxRentalDays ?? 30,
    ],
  );
  const car = result.rows[0];
  if (!car) {
    throw new Error('The car was not created');
  }
  return car;
}

export async function getCar(id: string): Promise<Car | null> {
  const result = await pool.query<Car>(`SELECT ${CAR_COLUMNS} FROM cars WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listOwnerCars(ownerId: string): Promise<OwnerCarItem[]> {
  const result = await pool.query<OwnerCarItem>(
    `SELECT ${CAR_COLUMNS},
            (SELECT p.id FROM car_photos p
             WHERE p.car_id = cars.id AND p.kind = 'listing'
             ORDER BY p.position, p.created_at LIMIT 1) AS "coverPhotoId"
     FROM cars WHERE owner_id = $1 AND status <> 'retired'
     ORDER BY created_at DESC`,
    [ownerId],
  );
  return result.rows;
}

export async function updateCar(id: string, changes: CarChanges): Promise<Car | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const column = UPDATE_COLUMNS[key];
    if (!column || value === undefined) {
      continue;
    }
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) {
    return getCar(id);
  }
  params.push(id);
  const result = await pool.query<Car>(
    `UPDATE cars SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length} RETURNING ${CAR_COLUMNS}`,
    params,
  );
  return result.rows[0] ?? null;
}

// ----- Cars: status changes (each only works from the allowed starting statuses) -----

async function moveCar(
  id: string,
  fromStatuses: readonly CarStatus[],
  setSql: string,
  extraParams: unknown[] = [],
): Promise<Car | null> {
  const result = await pool.query<Car>(
    `UPDATE cars SET ${setSql}, updated_at = now()
     WHERE id = $1 AND status = ANY($${extraParams.length + 2}::car_status[])
     RETURNING ${CAR_COLUMNS}`,
    [id, ...extraParams, fromStatuses],
  );
  return result.rows[0] ?? null;
}

export function submitCar(id: string, hubId: string): Promise<Car | null> {
  return moveCar(
    id,
    ['draft', 'rejected'],
    `status = 'submitted', hub_id = $2, submitted_at = now(), rejection_reason = NULL`,
    [hubId],
  );
}

export function approveCarDocuments(id: string): Promise<Car | null> {
  return moveCar(id, ['submitted'], `status = 'awaiting_dropoff', approved_at = now()`);
}

export function rejectCar(
  id: string,
  reason: string,
  fromStatuses: readonly CarStatus[] = ['submitted'],
): Promise<Car | null> {
  return moveCar(id, fromStatuses, `status = 'rejected', rejection_reason = $2`, [reason]);
}

export function pauseCar(id: string): Promise<Car | null> {
  return moveCar(id, ['live'], `status = 'paused'`);
}

export function resumeCar(id: string): Promise<Car | null> {
  return moveCar(id, ['paused'], `status = 'live'`);
}

export function retireCar(id: string, fromStatuses: readonly CarStatus[]): Promise<Car | null> {
  return moveCar(id, fromStatuses, `status = 'retired'`);
}

export function suspendCar(id: string, reason: string): Promise<Car | null> {
  return moveCar(id, ['live', 'paused'], `status = 'suspended', rejection_reason = $2`, [reason]);
}

export function reinstateCar(id: string): Promise<Car | null> {
  return moveCar(id, ['suspended'], `status = 'live', rejection_reason = NULL`);
}

// ----- Documents -----

export async function listCarDocuments(carId: string): Promise<CarDocument[]> {
  const result = await pool.query<CarDocument>(
    `SELECT ${DOC_COLUMNS} FROM car_documents WHERE car_id = $1 ORDER BY doc_type`,
    [carId],
  );
  return result.rows;
}

export async function upsertCarDocument(input: {
  carId: string;
  docType: CarDocType;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  expiresOn: string | null;
}): Promise<{ document: CarDocument; replacedKey: string | null }> {
  const previous = await pool.query<{ storageKey: string }>(
    `SELECT storage_key AS "storageKey" FROM car_documents WHERE car_id = $1 AND doc_type = $2`,
    [input.carId, input.docType],
  );
  const result = await pool.query<CarDocument>(
    `INSERT INTO car_documents
       (car_id, doc_type, storage_key, original_name, mime_type, size_bytes, expires_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (car_id, doc_type) DO UPDATE SET
       storage_key = EXCLUDED.storage_key,
       original_name = EXCLUDED.original_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       expires_on = EXCLUDED.expires_on,
       created_at = now()
     RETURNING ${DOC_COLUMNS}`,
    [
      input.carId,
      input.docType,
      input.storageKey,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
      input.expiresOn,
    ],
  );
  const document = result.rows[0];
  if (!document) {
    throw new Error('The document was not saved');
  }
  return { document, replacedKey: previous.rows[0]?.storageKey ?? null };
}

export async function getCarDocumentFile(
  id: string,
): Promise<{ storageKey: string; mimeType: string; carId: string } | null> {
  const result = await pool.query<{ storageKey: string; mimeType: string; carId: string }>(
    `SELECT storage_key AS "storageKey", mime_type AS "mimeType", car_id AS "carId"
     FROM car_documents WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

// ----- Photos -----

export async function listPhotos(carId: string, kind?: PhotoKind): Promise<CarPhoto[]> {
  const result = await pool.query<CarPhoto>(
    `SELECT ${PHOTO_COLUMNS} FROM car_photos
     WHERE car_id = $1 AND ($2::car_photo_kind IS NULL OR kind = $2::car_photo_kind)
     ORDER BY kind, position, created_at`,
    [carId, kind ?? null],
  );
  return result.rows;
}

export async function countPhotos(
  carId: string,
  kind: PhotoKind,
  onlyUnattached = false,
): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM car_photos
     WHERE car_id = $1 AND kind = $2 AND ($3 = false OR inspection_id IS NULL)`,
    [carId, kind, onlyUnattached],
  );
  return result.rows[0]?.count ?? 0;
}

export async function addPhoto(input: {
  carId: string;
  kind: PhotoKind;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  createdBy: string;
}): Promise<CarPhoto> {
  const result = await pool.query<CarPhoto>(
    `INSERT INTO car_photos (car_id, kind, storage_key, mime_type, size_bytes, position, created_by)
     VALUES ($1, $2, $3, $4, $5,
             (SELECT COALESCE(MAX(position) + 1, 0) FROM car_photos WHERE car_id = $1 AND kind = $2),
             $6)
     RETURNING ${PHOTO_COLUMNS}`,
    [input.carId, input.kind, input.storageKey, input.mimeType, input.sizeBytes, input.createdBy],
  );
  const photo = result.rows[0];
  if (!photo) {
    throw new Error('The photo was not saved');
  }
  return photo;
}

export async function getPhotoFile(
  id: string,
): Promise<{ id: string; carId: string; kind: PhotoKind; storageKey: string; mimeType: string } | null> {
  const result = await pool.query<{
    id: string;
    carId: string;
    kind: PhotoKind;
    storageKey: string;
    mimeType: string;
  }>(
    `SELECT id, car_id AS "carId", kind, storage_key AS "storageKey", mime_type AS "mimeType"
     FROM car_photos WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

// Removes a listing photo and returns its storage key so the file can be deleted.
export async function deleteListingPhoto(carId: string, photoId: string): Promise<string | null> {
  const result = await pool.query<{ storageKey: string }>(
    `DELETE FROM car_photos WHERE id = $1 AND car_id = $2 AND kind = 'listing'
     RETURNING storage_key AS "storageKey"`,
    [photoId, carId],
  );
  return result.rows[0]?.storageKey ?? null;
}

// ----- Hub inspections -----

export async function listInspections(carId: string): Promise<Inspection[]> {
  const result = await pool.query<Inspection>(
    `SELECT ${INSPECTION_COLUMNS} FROM car_inspections WHERE car_id = $1 ORDER BY created_at DESC`,
    [carId],
  );
  return result.rows;
}

export async function isHubStaff(hubId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM hub_staff WHERE hub_id = $1 AND user_id = $2`,
    [hubId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export type InspectionOutcome =
  | { ok: true; car: Car; inspection: Inspection }
  | { ok: false; reason: 'state' | 'photos' };

export async function recordInspection(input: {
  carId: string;
  inspectorId: string;
  result: 'passed' | 'failed';
  odometerKm: number;
  fuelLevelPercent: number;
  conditionNotes: string;
  minPhotosForPass: number;
}): Promise<InspectionOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const locked = await client.query<Car>(
      `SELECT ${CAR_COLUMNS} FROM cars WHERE id = $1 FOR UPDATE`,
      [input.carId],
    );
    const car = locked.rows[0];
    if (!car || car.status !== 'awaiting_dropoff' || !car.hubId) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'state' };
    }

    const photoCount = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM car_photos
       WHERE car_id = $1 AND kind = 'inspection' AND inspection_id IS NULL`,
      [input.carId],
    );
    if (input.result === 'passed' && (photoCount.rows[0]?.count ?? 0) < input.minPhotosForPass) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'photos' };
    }

    const inserted = await client.query<Inspection>(
      `INSERT INTO car_inspections
         (car_id, hub_id, inspector_id, result, odometer_km, fuel_level_percent, condition_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${INSPECTION_COLUMNS}`,
      [
        input.carId,
        car.hubId,
        input.inspectorId,
        input.result,
        input.odometerKm,
        input.fuelLevelPercent,
        input.conditionNotes,
      ],
    );
    const inspection = inserted.rows[0];
    if (!inspection) {
      throw new Error('The inspection was not saved');
    }

    await client.query(
      `UPDATE car_photos SET inspection_id = $1
       WHERE car_id = $2 AND kind = 'inspection' AND inspection_id IS NULL`,
      [inspection.id, input.carId],
    );

    const updated =
      input.result === 'passed'
        ? await client.query<Car>(
            `UPDATE cars SET status = 'live', live_at = now(), rejection_reason = NULL,
                             updated_at = now()
             WHERE id = $1 RETURNING ${CAR_COLUMNS}`,
            [input.carId],
          )
        : await client.query<Car>(
            `UPDATE cars SET status = 'rejected', rejection_reason = $2, updated_at = now()
             WHERE id = $1 RETURNING ${CAR_COLUMNS}`,
            [input.carId, input.conditionNotes],
          );
    const updatedCar = updated.rows[0];
    if (!updatedCar) {
      throw new Error('The car was not updated');
    }

    await client.query('COMMIT');
    return { ok: true, car: updatedCar, inspection };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ----- Staff review queue -----

export async function listCarsForReview(filters: {
  status: CarStatus;
  hubId?: string;
  limit: number;
  offset: number;
}): Promise<{ items: QueueCar[]; total: number }> {
  const conditions = ['c.status = $1'];
  const params: unknown[] = [filters.status];
  if (filters.hubId) {
    params.push(filters.hubId);
    conditions.push(`c.hub_id = $${params.length}`);
  }
  const from = `FROM cars c
                JOIN users u ON u.id = c.owner_id
                LEFT JOIN hubs h ON h.id = c.hub_id
                WHERE ${conditions.join(' AND ')}`;

  const total = await pool.query<{ count: number }>(`SELECT count(*)::int AS count ${from}`, params);

  params.push(filters.limit, filters.offset);
  const items = await pool.query<QueueCar>(
    `SELECT ${carColumns('c.')},
            COALESCE(u.company_name, u.full_name) AS "ownerName",
            u.email AS "ownerEmail", h.name AS "hubName"
     ${from}
     ORDER BY c.submitted_at ASC NULLS LAST, c.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

// ----- Public: live cars only, from verified and active owners -----

type ListingRow = Omit<CarListing, 'hub' | 'owner'> & {
  hubId: string;
  hubName: string;
  hubCity: string;
  hubCountryCode: string;
  ownerDisplayName: string;
  ownerAccountType: AccountType;
};

const LISTING_COLUMNS = `
  c.id, c.make, c.model, c.year, c.color, c.seats, c.transmission,
  c.fuel_type AS "fuelType", c.description, c.currency,
  c.daily_price_minor AS "dailyPriceMinor", c.deposit_minor AS "depositMinor",
  c.min_rental_days AS "minRentalDays", c.max_rental_days AS "maxRentalDays",
  c.live_at AS "liveAt",
  h.id AS "hubId", h.name AS "hubName", h.city AS "hubCity", h.country_code AS "hubCountryCode",
  COALESCE(u.company_name, split_part(u.full_name, ' ', 1)) AS "ownerDisplayName",
  u.account_type AS "ownerAccountType",
  (SELECT p.id FROM car_photos p
   WHERE p.car_id = c.id AND p.kind = 'listing'
   ORDER BY p.position, p.created_at LIMIT 1) AS "coverPhotoId"
`;

const LISTING_FROM = `
  FROM cars c
  JOIN hubs h ON h.id = c.hub_id
  JOIN users u ON u.id = c.owner_id
`;

const LISTING_VISIBLE = `
  c.status = 'live' AND h.is_active = true
  AND u.is_active = true AND u.verification_status = 'verified'
`;

function toListing(row: ListingRow): CarListing {
  const { hubId, hubName, hubCity, hubCountryCode, ownerDisplayName, ownerAccountType, ...car } = row;
  return {
    ...car,
    hub: { id: hubId, name: hubName, city: hubCity, countryCode: hubCountryCode },
    owner: { displayName: ownerDisplayName, accountType: ownerAccountType },
  };
}

const SORT_SQL: Record<SearchFilters['sort'], string> = {
  newest: 'c.live_at DESC NULLS LAST, c.id',
  price_asc: 'c.daily_price_minor ASC, c.live_at DESC NULLS LAST, c.id',
  price_desc: 'c.daily_price_minor DESC, c.live_at DESC NULLS LAST, c.id',
};

export async function searchLiveCars(
  filters: SearchFilters,
): Promise<{ items: CarListing[]; total: number }> {
  const conditions = [LISTING_VISIBLE];
  const params: unknown[] = [];

  if (filters.city) {
    params.push(filters.city);
    conditions.push(`lower(h.city) = lower($${params.length})`);
  }
  if (filters.countryCode) {
    params.push(filters.countryCode);
    conditions.push(`h.country_code = $${params.length}`);
  }
  if (filters.make) {
    params.push(`%${escapeLike(filters.make)}%`);
    conditions.push(`c.make ILIKE $${params.length}`);
  }
  if (filters.minDailyPriceMinor !== undefined) {
    params.push(filters.minDailyPriceMinor);
    conditions.push(`c.daily_price_minor >= $${params.length}`);
  }
  if (filters.maxDailyPriceMinor !== undefined) {
    params.push(filters.maxDailyPriceMinor);
    conditions.push(`c.daily_price_minor <= $${params.length}`);
  }
  if (filters.transmission) {
    params.push(filters.transmission);
    conditions.push(`c.transmission = $${params.length}`);
  }
  if (filters.fuelType) {
    params.push(filters.fuelType);
    conditions.push(`c.fuel_type = $${params.length}`);
  }
  if (filters.minSeats !== undefined) {
    params.push(filters.minSeats);
    conditions.push(`c.seats >= $${params.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count ${LISTING_FROM} ${where}`,
    params,
  );

  params.push(filters.limit, filters.offset);
  const rows = await pool.query<ListingRow>(
    `SELECT ${LISTING_COLUMNS} ${LISTING_FROM} ${where}
     ORDER BY ${SORT_SQL[filters.sort]}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: rows.rows.map(toListing), total: total.rows[0]?.count ?? 0 };
}

export async function getLiveCar(id: string): Promise<CarListing | null> {
  const result = await pool.query<ListingRow>(
    `SELECT ${LISTING_COLUMNS} ${LISTING_FROM} WHERE c.id = $1 AND ${LISTING_VISIBLE}`,
    [id],
  );
  const row = result.rows[0];
  return row ? toListing(row) : null;
}

// File: backend/src/cars/repository.ts
// END OF FILE