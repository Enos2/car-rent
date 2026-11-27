// Project: Via Nostra
// File: backend/src/cars/uploads.ts
// Purpose: Reads one uploaded file from a request, enforces the size limit and
//          checks the real file type. Used for car documents and photos.

import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendError } from '../http.js';
import { detectMime } from '../storage/files.js';
import type { AllowedMime } from '../storage/files.js';

export type UploadedFile = {
  buffer: Buffer;
  mime: AllowedMime;
  originalName: string;
};

// Returns the file, or an already-sent error reply when the upload is not acceptable.
export async function readUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  options: { allowPdf: boolean },
): Promise<UploadedFile | FastifyReply> {
  const upload = await request.file();
  if (!upload) {
    return sendError(reply, 400, 'Bad Request', 'Please attach a file');
  }
  const buffer = await upload.toBuffer();
  if (upload.file.truncated) {
    return sendError(reply, 413, 'Payload Too Large', 'The file is too large');
  }
  const mime = detectMime(buffer);
  if (!mime || (mime === 'application/pdf' && !options.allowPdf)) {
    return sendError(
      reply,
      415,
      'Unsupported Media Type',
      options.allowPdf
        ? 'Only JPG, PNG or PDF files are allowed'
        : 'Only JPG or PNG images are allowed',
    );
  }
  return { buffer, mime, originalName: path.basename(upload.filename).slice(0, 120) };
}

// File: backend/src/cars/uploads.ts
// END OF FILE