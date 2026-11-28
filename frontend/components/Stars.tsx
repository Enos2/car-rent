// Project: Via Nostra
// File: frontend/components/Stars.tsx
// Purpose: Shows a rating from 1 to 5 as stars, such as four filled and one empty.

export default function Stars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span aria-label={`${value} out of 5 stars`} style={{ color: '#e0a100', letterSpacing: 1 }}>
      {'\u2605'.repeat(filled)}
      <span style={{ color: '#c9d2df' }}>{'\u2605'.repeat(5 - filled)}</span>
    </span>
  );
}

// File: frontend/components/Stars.tsx
// END OF FILE