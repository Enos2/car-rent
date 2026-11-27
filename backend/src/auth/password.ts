// Project: Via Nostra
// File: backend/src/auth/password.ts
// Purpose: Hashes and checks passwords with scrypt, a strong password-hashing
//          method built into Node.js. Real passwords are never stored.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 32768; // scrypt "N"
const BLOCK_SIZE = 8; // scrypt "r"
const PARALLELISM = 3; // scrypt "p"

function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: blockSize, p: parallelism, maxmem: 128 * cost * blockSize * 2 },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM);
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, blockSize, parallelism, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !cost || !blockSize || !parallelism || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64'),
    Number(cost),
    Number(blockSize),
    Number(parallelism),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// File: backend/src/auth/password.ts
// END OF FILE
