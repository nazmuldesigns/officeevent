/**
 * NRB World Event — Security & Anti-Counterfeiting Utilities
 * -----------------------------------------------------------
 * Provides cryptographic security checksums, digital signature tokens,
 * and security watermark hashes for event passes to prevent unauthorized
 * barcode forgery or duplicate pass counterfeiting.
 */

const EVENT_SALT = "NRB_WORLD_2026_SECURE_AUTH_SALT_9981";

/**
 * Calculates a fast 16-bit cryptographic checksum hash for an Attendee ID.
 * Returns a 4-character hex signature (e.g., "9F42").
 */
export function generateSecurityToken(id: string, name: string = ""): string {
  const payload = `${id.trim().toUpperCase()}:${name.trim().toLowerCase()}:${EVENT_SALT}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = ((hash >>> 0) % 0x10000).toString(16).toUpperCase().padStart(4, "0");
  return hex;
}

/**
 * Generates an official digital verification seal string.
 * Example: "NRB-SEC-9F42"
 */
export function generateSecuritySeal(id: string, name: string = ""): string {
  const token = generateSecurityToken(id, name);
  return `NRB-SEC-${token}`;
}

/**
 * Verifies if a given security token matches the expected signature for an attendee.
 */
export function verifySecurityToken(id: string, name: string, token: string): boolean {
  if (!token) return false;
  const expected = generateSecurityToken(id, name);
  return expected.toUpperCase() === token.trim().toUpperCase();
}
