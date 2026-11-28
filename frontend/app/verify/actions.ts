// Project: Via Nostra
// File: frontend/app/verify/actions.ts
// Purpose: The server-side logic behind the identity verification page: uploading
//          one document and submitting everything for review.

'use server';

import { redirect } from 'next/navigation';
import { field, runApiAction, withMessage } from '@/lib/action-helpers';

export async function uploadVerificationDocumentAction(formData: FormData): Promise<void> {
  const docType = field(formData, 'docType');
  const file = formData.get('file');
  if (!docType || !(file instanceof File) || file.size === 0) {
    redirect(withMessage('/verify', 'error', 'Please choose a file to upload.'));
  }

  const body = new FormData();
  body.append('file', file, file.name);
  await runApiAction({
    path: `/verification/documents/${encodeURIComponent(docType)}`,
    formData: body,
    back: '/verify',
    notice: 'Document uploaded.',
  });
}

export async function submitVerificationAction(): Promise<void> {
  await runApiAction({
    path: '/verification/submit',
    back: '/verify',
    notice: 'Submitted. Our team will review your documents soon.',
  });
}

// File: frontend/app/verify/actions.ts
// END OF FILE