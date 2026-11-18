import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM. ENCRYPTION_KEY: any string >= 32 chars (hashed to 32 bytes) or 64 hex chars.
const key = () => {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (raw.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  return /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : createHash("sha256").update(raw).digest();
};

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(enc!), d.final()]).toString("utf8");
}

export const pkce = () => {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge, state: randomBytes(16).toString("hex") };
};
