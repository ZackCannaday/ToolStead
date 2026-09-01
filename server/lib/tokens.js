import { createHash, randomBytes } from "node:crypto";

export function createRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiry(days) {
  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + days);
  return expiry;
}

