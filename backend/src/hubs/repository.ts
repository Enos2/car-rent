// Project: Via Nostra
// File: backend/src/hubs/repository.ts
// Purpose: All database queries about hubs (drop-off and inspection locations)
//          and the staff assigned to them.

import { pool } from '../db.js';
import type { UserRole } from '../users/repository.js';

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
  createdAt: Date;
};

export type NewHub = {
  name: string;
  city: string;
  countryCode: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: string | null;
  contactPhone?: string | null;
};

export type HubChanges = Partial<NewHub> & { isActive?: boolean };

export type HubStaffMember = {
  id: string;
  fullName: string;
  email: string;
  roles: UserRole[];
};

const HUB_COLUMNS = `
  id,
  name,
  city,
  country_code AS "countryCode",
  address,
  latitude::float8 AS latitude,
  longitude::float8 AS longitude,
  opening_hours AS "openingHours",
  contact_phone AS "contactPhone",
  is_active AS "isActive",
  created_at AS "createdAt"
`;

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  city: 'city',
  countryCode: 'country_code',
  address: 'address',
  latitude: 'latitude',
  longitude: 'longitude',
  openingHours: 'opening_hours',
  contactPhone: 'contact_phone',
  isActive: 'is_active',
};

export async function listHubs(filters: {
  city?: string;
  countryCode?: string;
  includeInactive?: boolean;
}): Promise<Hub[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!filters.includeInactive) {
    conditions.push('is_active = true');
  }
  if (filters.city) {
    params.push(filters.city);
    conditions.push(`lower(city) = lower($${params.length})`);
  }
  if (filters.countryCode) {
    params.push(filters.countryCode);
    conditions.push(`country_code = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query<Hub>(
    `SELECT ${HUB_COLUMNS} FROM hubs ${where} ORDER BY country_code, city, name`,
    params,
  );
  return result.rows;
}

export async function getHub(id: string): Promise<Hub | null> {
  const result = await pool.query<Hub>(`SELECT ${HUB_COLUMNS} FROM hubs WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function createHub(input: NewHub): Promise<Hub> {
  const result = await pool.query<Hub>(
    `INSERT INTO hubs (name, city, country_code, address, latitude, longitude, opening_hours, contact_phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${HUB_COLUMNS}`,
    [
      input.name,
      input.city,
      input.countryCode,
      input.address,
      input.latitude ?? null,
      input.longitude ?? null,
      input.openingHours ?? null,
      input.contactPhone ?? null,
    ],
  );
  const hub = result.rows[0];
  if (!hub) {
    throw new Error('The hub was not created');
  }
  return hub;
}

export async function updateHub(id: string, changes: HubChanges): Promise<Hub | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(changes)) {
    const column = COLUMN_MAP[key];
    if (!column || value === undefined) {
      continue;
    }
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) {
    return getHub(id);
  }
  params.push(id);
  const result = await pool.query<Hub>(
    `UPDATE hubs SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length} RETURNING ${HUB_COLUMNS}`,
    params,
  );
  return result.rows[0] ?? null;
}

export async function listHubStaff(hubId: string): Promise<HubStaffMember[]> {
  const result = await pool.query<HubStaffMember>(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.roles
     FROM hub_staff hs JOIN users u ON u.id = hs.user_id
     WHERE hs.hub_id = $1 ORDER BY u.full_name`,
    [hubId],
  );
  return result.rows;
}

export async function addHubStaff(hubId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO hub_staff (hub_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [hubId, userId],
  );
}

export async function removeHubStaff(hubId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM hub_staff WHERE hub_id = $1 AND user_id = $2`,
    [hubId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

// File: backend/src/hubs/repository.ts
// END OF FILE
