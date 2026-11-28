// Project: Via Nostra
// File: frontend/lib/paging.ts
// Purpose: Shared paging rules for the staff lists: how many rows per page, which
//          page a request is on, and where that page starts.

export const PAGE_SIZE = 20;

export function pageFrom(value: string): number {
  return Math.max(1, Math.floor(Number(value)) || 1);
}

export function offsetFor(page: number): number {
  return (page - 1) * PAGE_SIZE;
}

// File: frontend/lib/paging.ts
// END OF FILE