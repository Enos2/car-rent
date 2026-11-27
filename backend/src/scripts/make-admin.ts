// Project: Via Nostra
// File: backend/src/scripts/make-admin.ts
// Purpose: One-time command that makes an existing account a super admin, so the
//          first staff member can exist. Run: npm run make-admin -- you@example.com
//          It needs access to the database, so only the project owner can run it.

import { pool } from '../db.js';

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error('Usage: npm run make-admin -- someone@example.com');
  process.exit(1);
}

try {
  const result = await pool.query<{ id: string; email: string; roles: string[] }>(
    `UPDATE users
     SET roles = CASE WHEN 'super_admin' = ANY(roles) THEN roles
                      ELSE array_append(roles, 'super_admin') END,
         updated_at = now()
     WHERE lower(email) = $1
     RETURNING id, email, roles`,
    [email],
  );
  const user = result.rows[0];
  if (!user) {
    console.error(`No account found for ${email}. Sign up on the website first.`);
    process.exitCode = 1;
  } else {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata)
       VALUES (NULL, 'user.super_admin.granted', 'user', $1, $2)`,
      [user.id, JSON.stringify({ via: 'make-admin script' })],
    );
    console.log(`${user.email} is now a super admin. Roles: ${user.roles.join(', ')}`);
  }
} finally {
  await pool.end();
}

// File: backend/src/scripts/make-admin.ts
// END OF FILE
