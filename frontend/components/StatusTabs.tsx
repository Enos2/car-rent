// Project: Via Nostra
// File: frontend/components/StatusTabs.tsx
// Purpose: A row of tabs that filter a list by status, such as "Waiting for review"
//          and "Approved". The active tab is highlighted. Used by the staff queues.

import Link from 'next/link';

export type Tab = { value: string; label: string };

export default function StatusTabs({
  tabs,
  current,
  basePath,
  param = 'status',
}: {
  tabs: Tab[];
  current: string;
  basePath: string;
  param?: string;
}) {
  return (
    <div className="subnav">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={`${basePath}?${param}=${encodeURIComponent(tab.value)}`}
          className={tab.value === current ? 'active' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

// File: frontend/components/StatusTabs.tsx
// END OF FILE