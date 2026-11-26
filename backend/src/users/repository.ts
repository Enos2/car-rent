// File: backend/src/users/repository.ts
// Purpose: All database queries about user accounts: create, find, search with
//          filters, change roles, suspend or reactivate, and count by role.

import { pool } from '../db.js';

export type AccountType = 'individual' | 'company';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type UserRole =
  | 'renter'
  | 'owner'
  | 'support_agent'
  | 'verification_officer'
  | 'hub_manager'
  | 'finance_admin'
  | 'content_moderator'
  | 'super_admin';

export type User = {
  id: string;
  email: string;
  fullName: string;
  accountType: AccountType;
  companyName: string | null;
  roles: UserRole[];
  verificationStatus: VerificationStatus;
  isActive: boolean;
  createdAt: Date;
};

export type UserWithPassword = User & { passwordHash: string };

export type NewUser = {
  email: string;
  passwordHash: string;
  fullName: string;
  accountType: AccountType;
  companyName: string | null;
  roles: UserRole[];
};

export type UserFilters = {
  search?: string;
  role?: UserRole;
  verificationStatus?: VerificationStatus;
  isActive?: boolean;
  limit: number;
  offset: number;
};

const USER_COLUMNS = `
  id,
  email,
  full_name AS "fullName",
  account_type AS "accountType",
  company_name AS "companyName",
  roles,
  verification_status AS "verificationStatus",
  is_active AS "isActive",
  created_at AS "createdAt"
`;

export async function createUser(input: NewUser): Promise<User> {
  const result = await pool.query<User>(
    `INSERT INTO users (email, password_hash, full_name, account_type, company_name, roles)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${USER_COLUMNS}`,
    [
      input.email,
      input.passwordHash,
      input.fullName,
      input.accountType,
      input.companyName,
      input.roles,
    ],
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error('The user was not created');
  }
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findUserWithPasswordByEmail(
  email: string,
): Promise<UserWithPassword | null> {
  const result = await pool.query<UserWithPassword>(
    `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash"
     FROM users WHERE lower(email) = $1`,
    [email.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listUsers(
  filters: UserFilters,
): Promise<{ items: User[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${escapeLike(filters.search)}%`);
    conditions.push(
      `(email ILIKE $${params.length} OR full_name ILIKE $${params.length})`,
    );
  }
  if (filters.role) {
    params.push(filters.role);
    conditions.push(`$${params.length} = ANY(roles)`);
  }
  if (filters.verificationStatus) {
    params.push(filters.verificationStatus);
    conditions.push(`verification_status = $${params.length}`);
  }
  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    conditions.push(`is_active = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM users ${where}`,
    params,
  );

  params.push(filters.limit, filters.offset);
  const itemsResult = await pool.query<User>(
    `SELECT ${USER_COLUMNS} FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { items: itemsResult.rows, total: totalResult.rows[0]?.count ?? 0 };
}

export async function setUserRoles(id: string, roles: UserRole[]): Promise<User | null> {
  const result = await pool.query<User>(
    `UPDATE users SET roles = $2, updated_at = now()
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, roles],
  );
  return result.rows[0] ?? null;
}

export async function setUserActive(id: string, isActive: boolean): Promise<User | null> {
  const result = await pool.query<User>(
    `UPDATE users SET is_active = $2, updated_at = now()
     WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, isActive],
  );
  return result.rows[0] ?? null;
}

export async function countUsersWithRole(role: UserRole): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM users WHERE $1 = ANY(roles)`,
    [role],
  );
  return result.rows[0]?.count ?? 0;
}

// File: backend/src/users/repository.ts
// END OF FILE
