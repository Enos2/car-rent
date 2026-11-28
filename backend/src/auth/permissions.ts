// Project: Via Nostra
// File: backend/src/auth/permissions.ts
// Purpose: Defines the staff ranks and exactly what each rank is allowed to do.
//          Renters and owners have no staff permissions. permissionsFor lists
//          everything a set of roles may do, which the website uses for its menus.

import type { UserRole } from '../users/repository.js';

export const STAFF_ROLES = [
  'support_agent',
  'verification_officer',
  'hub_manager',
  'finance_admin',
  'content_moderator',
  'super_admin',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ALL_ROLES = ['renter', 'owner', ...STAFF_ROLES] as const;

export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'staff.manage',
  'hubs.manage',
  'verification.review',
  'cars.review',
  'cars.inspect',
  'bookings.read',
  'bookings.manage',
  'finance.read',
  'finance.manage',
  'reports.review',
  'content.manage',
  'support.handle',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  renter: [],
  owner: [],
  support_agent: [
    'users.read',
    'bookings.read',
    'bookings.manage',
    'reports.review',
    'support.handle',
  ],
  verification_officer: ['users.read', 'verification.review'],
  hub_manager: ['hubs.manage', 'cars.inspect', 'cars.review', 'bookings.read'],
  finance_admin: ['finance.read', 'finance.manage', 'bookings.read'],
  content_moderator: ['content.manage', 'reports.review'],
  super_admin: PERMISSIONS,
};

export function hasPermission(roles: readonly UserRole[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function permissionsFor(roles: readonly UserRole[]): Permission[] {
  return PERMISSIONS.filter((permission) => hasPermission(roles, permission));
}

export function isStaff(roles: readonly UserRole[]): boolean {
  return roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
}

// File: backend/src/auth/permissions.ts
// END OF FILE