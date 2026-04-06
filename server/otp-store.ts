interface OtpEntry {
  code: string;
  expiresAt: number;
  verified: boolean;
}

const store = new Map<string, OtpEntry>();

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setOtp(email: string, code: string, ttlMs = 10 * 60 * 1000) {
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + ttlMs,
    verified: false,
  });
}

export function verifyOtp(email: string, code: string): "valid" | "expired" | "invalid" {
  const entry = store.get(email.toLowerCase());
  if (!entry) return "invalid";
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return "expired";
  }
  if (entry.code !== code) return "invalid";
  entry.verified = true;
  return "valid";
}

export function isOtpVerified(email: string): boolean {
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return false;
  }
  return entry.verified === true;
}

export function clearOtp(email: string) {
  store.delete(email.toLowerCase());
}
