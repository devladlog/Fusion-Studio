// -------------------------------------------------------
// Input validation helpers
// -------------------------------------------------------

const URL_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const SCHEMA_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_BASE64_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

export function validateUrl(url: string, label: string): void {
  if (!url || !URL_PATTERN.test(url)) {
    throw new Error(`Invalid ${label}: "${url}". Must be a valid HTTP(S) URL.`);
  }
}

export function validateSchemaName(name: string, label: string): void {
  if (!name || !SCHEMA_NAME_PATTERN.test(name)) {
    throw new Error(
      `Invalid ${label}: "${name}". Must start with a letter or underscore, contain only alphanumerics/underscores, max 128 chars.`
    );
  }
}

export function validateFileSize(sizeBytes: number, filePath: string): void {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File "${filePath}" is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB, which exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit.`
    );
  }
}

export function validateBase64Size(base64: string): void {
  const approxBytes = (base64.length * 3) / 4;
  if (approxBytes > MAX_BASE64_IMAGE_BYTES) {
    throw new Error(
      `Image is ~${(approxBytes / 1024 / 1024).toFixed(1)} MB, which exceeds the ${MAX_BASE64_IMAGE_BYTES / 1024 / 1024} MB limit.`
    );
  }
}

export function sanitizeForShell(value: string): string {
  // Only allow alphanumerics, hyphens, underscores, dots, slashes, colons
  if (/[^a-zA-Z0-9\-_.:\\/@]/.test(value)) {
    throw new Error(
      `Value "${value}" contains characters not allowed in shell arguments.`
    );
  }
  return value;
}
