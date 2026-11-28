// Project: Via Nostra
// File: frontend/components/ReportForm.tsx
// Purpose: A "Report" link that opens a small form: the reader picks a reason and
//          describes the problem. It reports a car, a person, a review or a post to
//          our team.

import { submitReportAction } from '@/app/trust-actions';
import { REPORT_REASONS } from '@/lib/trust';
import type { ReportTarget } from '@/lib/trust';

export default function ReportForm({
  targetType,
  targetId,
  back,
  label = 'Report',
}: {
  targetType: ReportTarget;
  targetId: string;
  back: string;
  label?: string;
}) {
  return (
    <details className="cancel-box">
      <summary>{label}</summary>
      <form action={submitReportAction}>
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="back" value={back} />
        <select name="reason" aria-label="Reason" defaultValue="" required>
          <option value="" disabled>
            Why are you reporting this?
          </option>
          {REPORT_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
        <textarea
          name="details"
          rows={3}
          minLength={10}
          maxLength={1000}
          placeholder="Tell us what happened"
          required
        />
        <button type="submit" className="btn btn-ghost btn-small">
          Send report
        </button>
      </form>
    </details>
  );
}

// File: frontend/components/ReportForm.tsx
// END OF FILE