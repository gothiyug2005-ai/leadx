import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenCryptoError";
  }
}

/** Parse TOKEN_ENCRYPTION_KEY: 32 random bytes, base64 encoded (openssl rand -base64 32). */
export function parseKey(raw: string | undefined): Buffer {
  if (!raw) throw new TokenCryptoError("TOKEN_ENCRYPTION_KEY is not set.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new TokenCryptoError(
      "TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).",
    );
  }
  return key;
}

function key(): Buffer {
  return parseKey(getEnv().TOKEN_ENCRYPTION_KEY);
}

/** AES-256-GCM: a fresh random IV per value, and the auth tag detects any tampering. */
export function encryptWithKey(plaintext: string, secret: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, secret, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptWithKey(payload: string, secret: Buffer): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new TokenCryptoError("Unrecognised encrypted token format.");
  }
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      secret,
      Buffer.from(iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new TokenCryptoError(
      "Could not decrypt the token (wrong key or tampered data).",
    );
  }
}

export function encryptToken(plaintext: string): string {
  return encryptWithKey(plaintext, key());
}

export function decryptToken(payload: string): string {
  return decryptWithKey(payload, key());
}
