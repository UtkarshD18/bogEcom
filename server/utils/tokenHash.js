import crypto from "crypto";

const HASH_ALGORITHM = "sha256";

export const normalizeTokenString = (value) =>
  typeof value === "string" ? value.trim() : "";

export const hashTokenValue = (token) => {
  const normalized = normalizeTokenString(token);
  if (!normalized) return "";

  return crypto.createHash(HASH_ALGORITHM).update(normalized).digest("hex");
};

const isHexString = (value) =>
  typeof value === "string" && value.length > 0 && /^[a-f0-9]+$/i.test(value);

const timingSafeHexEqual = (leftHex, rightHex) => {
  if (!isHexString(leftHex) || !isHexString(rightHex)) {
    return false;
  }

  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  if (left.length !== right.length || left.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
};

export const matchesStoredToken = (storedToken, candidateToken) => {
  const normalizedStored = normalizeTokenString(storedToken);
  const normalizedCandidate = normalizeTokenString(candidateToken);

  if (!normalizedStored || !normalizedCandidate) {
    return false;
  }

  // Backward compatibility for legacy rows that still store raw tokens.
  if (normalizedStored === normalizedCandidate) {
    return true;
  }

  const candidateHash = hashTokenValue(normalizedCandidate);
  if (!candidateHash) {
    return false;
  }

  return timingSafeHexEqual(normalizedStored, candidateHash);
};

