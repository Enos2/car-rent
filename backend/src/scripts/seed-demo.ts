// Project: Via Nostra
// File: backend/src/scripts/seed-demo.ts
// Purpose: Creates demo data for development: a hub, four demo accounts (renter,
//          owner, company, super admin) and six live cars with generated photos, so
//          the website has something to show. Never runs in production.
//          Run: npm run seed

import { deflateSync } from 'node:zlib';
import type pg from 'pg';
import { hashPassword } from '../auth/password.js';
import { config } from '../config.js';
import { pool } from '../db.js';
import { saveFile } from '../storage/files.js';

if (config.isProduction) {
  console.error('Refusing to create demo data when NODE_ENV=production.');
  process.exit(1);
}

const PASSWORD = 'Demo-pass-1234';
const DOMAIN = 'demo.vianostra.test';

// ----- A tiny PNG maker, so the demo cars get photos without any downloads -----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

type Rgb = [number, number, number];

function gradientPng(width: number, height: number, top: Rgb, bottom: Rgb): Buffer {
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const red = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const green = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const blue = Math.round(top[2] + (bottom[2] - top[2]) * t);
    const offset = y * rowSize;
    raw[offset] = 0;
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 3] = red;
      raw[offset + 2 + x * 3] = green;
      raw[offset + 3 + x * 3] = blue;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----- Demo content -----

type DemoCar = {
  make: string;
  model: string;
  year: number;
  seats: number;
  transmission: 'manual' | 'automatic';
  fuelType: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  color: string;
  dailyPriceMinor: number;
  depositMinor: number;
  company: boolean;
  description: string;
  base: Rgb;
};

const CARS: DemoCar[] = [
  {
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    seats: 5,
    transmission: 'automatic',
    fuelType: 'petrol',
    color: 'White',
    dailyPriceMinor: 4500,
    depositMinor: 20000,
    company: false,
    description: 'Reliable and economical, perfect for city driving.',
    base: [70, 120, 190],
  },
  {
    make: 'Honda',
    model: 'CR-V',
    year: 2020,
    seats: 5,
    transmission: 'automatic',
    fuelType: 'petrol',
    color: 'Grey',
    dailyPriceMinor: 7500,
    depositMinor: 30000,
    company: false,
    description: 'A comfortable family SUV with plenty of boot space.',
    base: [60, 150, 140],
  },
  {
    make: 'Suzuki',
    model: 'Swift',
    year: 2022,
    seats: 5,
    transmission: 'manual',
    fuelType: 'petrol',
    color: 'Red',
    dailyPriceMinor: 3500,
    depositMinor: 15000,
    company: true,
    description: 'Small, light and easy to park. Great fuel economy.',
    base: [190, 80, 80],
  },
  {
    make: 'Nissan',
    model: 'Leaf',
    year: 2021,
    seats: 5,
    transmission: 'automatic',
    fuelType: 'electric',
    color: 'Blue',
    dailyPriceMinor: 5500,
    depositMinor: 25000,
    company: true,
    description: 'Quiet, fully electric and cheap to run around town.',
    base: [60, 100, 200],
  },
  {
    make: 'Toyota',
    model: 'Land Cruiser',
    year: 2019,
    seats: 7,
    transmission: 'automatic',
    fuelType: 'diesel',
    color: 'Black',
    dailyPriceMinor: 14000,
    depositMinor: 60000,
    company: true,
    description: 'A seven-seat 4x4 for long trips and rough roads.',
    base: [55, 60, 75],
  },
  {
    make: 'Hyundai',
    model: 'Tucson',
    year: 2022,
    seats: 5,
    transmission: 'automatic',
    fuelType: 'hybrid',
    color: 'Silver',
    dailyPriceMinor: 8000,
    depositMinor: 35000,
    company: false,
    description: 'A modern hybrid SUV that is smooth and efficient.',
    base: [120, 130, 150],
  },
];

async function insertUser(
  client: pg.PoolClient,
  user: {
    email: string;
    fullName: string;
    accountType: 'individual' | 'company';
    companyName?: string;
    roles: string[];
    passwordHash: string;
  },
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users
       (email, password_hash, full_name, account_type, company_name, roles, verification_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'verified')
     RETURNING id`,
    [
      user.email,
      user.passwordHash,
      user.fullName,
      user.accountType,
      user.companyName ?? null,
      user.roles,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new Error(`Could not create ${user.email}`);
  }
  return id;
}

function shade(color: Rgb, amount: number): Rgb {
  return color.map((part) => Math.max(0, Math.min(255, part + amount))) as Rgb;
}

async function main(): Promise<void> {
  const existing = await pool.query(`SELECT 1 FROM users WHERE lower(email) = $1`, [
    `owner@${DOMAIN}`,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
    console.log('Demo data already exists. Nothing was changed.');
    return;
  }

  const passwordHash = await hashPassword(PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ownerId = await insertUser(client, {
      email: `owner@${DOMAIN}`,
      fullName: 'Olivia Owner',
      accountType: 'individual',
      roles: ['owner'],
      passwordHash,
    });
    const fleetId = await insertUser(client, {
      email: `fleet@${DOMAIN}`,
      fullName: 'Frank Fleet',
      accountType: 'company',
      companyName: 'Demo Fleet Ltd',
      roles: ['owner'],
      passwordHash,
    });
    await insertUser(client, {
      email: `renter@${DOMAIN}`,
      fullName: 'Riley Renter',
      accountType: 'individual',
      roles: ['renter'],
      passwordHash,
    });
    await insertUser(client, {
      email: `admin@${DOMAIN}`,
      fullName: 'Ada Admin',
      accountType: 'individual',
      roles: ['super_admin'],
      passwordHash,
    });

    const hub = await client.query<{ id: string }>(
      `INSERT INTO hubs (name, city, country_code, address, opening_hours, contact_phone)
       VALUES ('Demo Central Hub', 'Demo City', 'XX', '1 Demo Street', '08:00-18:00 every day', '+000 000 0000')
       RETURNING id`,
    );
    const hubId = hub.rows[0]?.id;
    if (!hubId) {
      throw new Error('Could not create the demo hub');
    }

    let index = 0;
    for (const car of CARS) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO cars
           (owner_id, hub_id, status, make, model, year, plate_number, color, seats,
            transmission, fuel_type, description, currency, daily_price_minor,
            deposit_minor, min_rental_days, max_rental_days,
            submitted_at, approved_at, live_at)
         VALUES ($1, $2, 'live', $3, $4, $5, $6, $7, $8, $9, $10, $11, 'USD', $12, $13, 1, 30,
                 now(), now(), now() - make_interval(hours => $14::int))
         RETURNING id`,
        [
          car.company ? fleetId : ownerId,
          hubId,
          car.make,
          car.model,
          car.year,
          `DEMO ${String(index + 1).padStart(3, '0')}`,
          car.color,
          car.seats,
          car.transmission,
          car.fuelType,
          car.description,
          car.dailyPriceMinor,
          car.depositMinor,
          index * 3,
        ],
      );
      const carId = result.rows[0]?.id;
      if (!carId) {
        throw new Error(`Could not create ${car.make} ${car.model}`);
      }

      for (let photo = 0; photo < 3; photo++) {
        const png = gradientPng(480, 300, shade(car.base, photo * 25), shade(car.base, -70 + photo * 10));
        const storageKey = await saveFile('car-photos', png);
        await client.query(
          `INSERT INTO car_photos (car_id, kind, storage_key, mime_type, size_bytes, position, created_by)
           VALUES ($1, 'listing', $2, 'image/png', $3, $4, $5)`,
          [carId, storageKey, png.length, photo, car.company ? fleetId : ownerId],
        );
      }
      index += 1;
    }

    await client.query('COMMIT');
    console.log('Demo data created. Every demo account uses the password: ' + PASSWORD);
    console.log(`  Renter:      renter@${DOMAIN}`);
    console.log(`  Owner:       owner@${DOMAIN}`);
    console.log(`  Company:     fleet@${DOMAIN}`);
    console.log(`  Super admin: admin@${DOMAIN}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await main();
} finally {
  await pool.end();
}

// File: backend/src/scripts/seed-demo.ts
// END OF FILE