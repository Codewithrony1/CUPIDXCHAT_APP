import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function deleteStoredImage(imageUrlOrFilename: string | null | undefined): Promise<boolean> {
  if (!imageUrlOrFilename) return false;
  const raw = String(imageUrlOrFilename).split('?')[0];
  const filename = path.basename(raw);
  if (!filename || filename === '.' || filename === '..') return false;
  const relative = raw.startsWith('/') ? raw.slice(1) : raw;
  const candidates = new Set<string>([
    path.join(process.cwd(), 'public', relative),
    path.join(process.cwd(), relative),
    path.join(os.tmpdir(), relative),
  ]);
  for (const dir of ['uploads', 'public/uploads', 'public/uploads/qr', 'public/uploads/receipts']) {
    candidates.add(path.join(process.cwd(), dir, filename));
    candidates.add(path.join(os.tmpdir(), dir, filename));
  }
  let removed = false;
  for (const filePath of candidates) {
    try { await fs.unlink(filePath); removed = true; }
    catch (error: any) { if (error?.code !== 'ENOENT') console.warn('Image delete failed:', filePath, error); }
  }
  return removed;
}

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Validates base64 image data against strict size limits and binary magic bytes signatures.
 * Strictly derives extension from binary magic bytes (never trusting user MIME or filename).
 * Enforces a strict 5 MB limit ("Image must be 5 MB or smaller.").
 * Generates collision-resistant unique filenames and safely writes to persistent & fallback directories.
 */
export async function saveBase64Image(
  dataUri: string,
  subDirectory: string = 'uploads',
  filenamePrefix: string = 'img',
  maxBytes: number = 5 * 1024 * 1024 // 5MB strict limit
): Promise<ImageUploadResult> {
  if (!dataUri || typeof dataUri !== 'string') {
    return { success: false, error: 'Invalid or missing image data.', statusCode: 400 };
  }

  // 1. Resilient base64 payload extraction (handles headers, newlines, and raw base64)
  const commaIdx = dataUri.indexOf(',');
  const rawBase64 = commaIdx !== -1 ? dataUri.slice(commaIdx + 1) : dataUri;
  const cleanBase64 = rawBase64.replace(/\s+/g, '');

  if (!cleanBase64) {
    return { success: false, error: 'Empty image payload.', statusCode: 400 };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch (err) {
    return { success: false, error: 'Invalid base64 encoding.', statusCode: 400 };
  }

  if (buffer.length === 0) {
    return { success: false, error: 'Empty image buffer.', statusCode: 400 };
  }

  // 2. Strict 5 MB file size enforcement
  if (buffer.length > maxBytes) {
    return {
      success: false,
      error: 'Image must be 5 MB or smaller.',
      statusCode: 400,
    };
  }

  // 3. Binary Magic Bytes Validation (JPEG, PNG, WebP only)
  // Rejects PDF, ZIP, EXE, JS, HTML, SVG, and arbitrary binaries
  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  const isJpg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isWebp =
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (!isPng && !isJpg && !isWebp) {
    return {
      success: false,
      error: 'Invalid image file format. Only JPG, PNG, and WebP images are allowed.',
      statusCode: 400,
    };
  }

  const ext = isPng ? 'png' : isWebp ? 'webp' : 'jpg';
  const mimeType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

  // 4. Collision-resistant unique filename generation
  const safePrefix = filenamePrefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  const randomHex = crypto.randomBytes(4).toString('hex');
  const filename = `${safePrefix}_${Date.now()}_${randomHex}.${ext}`;

  // 5. Multi-tier storage persistence with fallback
  const subPath = subDirectory.replace(/^\/+|\/+$/g, '');
  const candidateDirs = [
    path.join(process.cwd(), 'public', subPath),
    path.join(process.cwd(), subPath),
    path.join(os.tmpdir(), subPath),
  ];

  let writeSuccess = false;
  let lastWriteError: any = null;

  for (const targetDir of candidateDirs) {
    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, filename), buffer);
      writeSuccess = true;
    } catch (err) {
      lastWriteError = err;
    }
  }

  if (!writeSuccess) {
    console.error('Image storage failure across all directories:', lastWriteError);
    return {
      success: false,
      error: 'Failed to write image to server storage. Please try again.',
      statusCode: 500,
    };
  }

  const relativeUrl = `/${subPath}/${filename}`.replace(/\/+/g, '/');

  return {
    success: true,
    url: relativeUrl,
    filename,
    size: buffer.length,
    mimeType,
  };
}
