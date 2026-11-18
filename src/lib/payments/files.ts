import { ServiceError } from "./common";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Validates by file signature (not the client-declared type or extension). */
export function sniffProof(bytes: Uint8Array): { mime: string; ext: string } {
  if (bytes.length === 0) throw new ServiceError(400, "The file is empty.", "BAD_FILE");
  if (bytes.length > MAX_PROOF_BYTES) throw new ServiceError(413, "File is too large (max 5 MB).", "FILE_TOO_LARGE");
  const b = (i: number) => bytes[i];
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { mime: "image/png", ext: "png" };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b(0) === 0x52 && b(1) === 0x49 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return { mime: "image/webp", ext: "webp" };
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return { mime: "application/pdf", ext: "pdf" };
  throw new ServiceError(400, "Please upload a PNG, JPG, WEBP or PDF file.", "BAD_FILE_TYPE");
}
