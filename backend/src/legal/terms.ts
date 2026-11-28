// Project: Via Nostra
// File: backend/src/legal/terms.ts
// Purpose: Records which version of the Terms and Conditions a person accepted when
//          they signed up. Change CURRENT_TERMS_VERSION whenever the terms change.

import { pool } from '../db.js';

export const CURRENT_TERMS_VERSION = '2026-11-28';

export async function recordTermsAcceptance(
  userId: string,
  version: string = CURRENT_TERMS_VERSION,
): Promise<void> {
  await pool.query(
    `UPDATE users SET terms_version = $2, terms_accepted_at = now() WHERE id = $1`,
    [userId, version],
  );
}

// File: backend/src/legal/terms.ts
// END OF FILE