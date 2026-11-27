// Project: Via Nostra
// File: backend/src/hubs/access.ts
// Purpose: Decides whether a staff member may work at a given hub. Super admins may
//          work at any hub; other staff only at hubs they are assigned to.

import { isHubStaff } from '../cars/repository.js';
import type { User } from '../users/repository.js';

export async function mayWorkAtHub(account: User, hubId: string | null): Promise<boolean> {
  if (account.roles.includes('super_admin')) {
    return true;
  }
  return hubId !== null && (await isHubStaff(hubId, account.id));
}

// File: backend/src/hubs/access.ts
// END OF FILE