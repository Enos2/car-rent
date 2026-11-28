// Project: Via Nostra
// File: frontend/components/Flash.tsx
// Purpose: Shows the green success message or the red error message that a page
//          receives after an action, such as "Document uploaded."

export default function Flash({ notice, error }: { notice?: string; error?: string }) {
  return (
    <>
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
    </>
  );
}

// File: frontend/components/Flash.tsx
// END OF FILE