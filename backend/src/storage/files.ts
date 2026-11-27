// Project: Via Nostra
// File: backend/src/storage/files.ts
// Purpose: Saves and reads uploaded files on the computer's disk, inside a private
//          folder, under random names. Also checks the real type of a file by its
//          first bytes. Later this can be swapped for cloud storage.

import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { ReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const root = path.resolve(config.uploadDir);

function resolveKey(key: string): string {
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

export async function saveFile(folder: string, data: Buffer): Promise<string> {
  const key = `${folder}/${randomUUID()}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: 'wx' });
  return key;
}

export function openFile(key: string): ReadStream {
  return createReadStream(resolveKey(key));
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    return (await stat(resolveKey(key))).isFile();
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<void> {
  await unlink(resolveKey(key));
}

export type AllowedMime = 'image/jpeg' | 'image/png' | 'application/pdf';

// Looks at the first bytes of the file, not the name or what the browser claims.
export function detectMime(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  const pngStart = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngStart)) {
    return 'image/png';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

// File: backend/src/storage/files.ts
// END OF FILE
