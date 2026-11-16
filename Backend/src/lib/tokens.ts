// Minimal HS256 token helper used for the development/test OTP login.
// Real users are authenticated by Supabase; these tokens are only issued for the
// built-in test numbers and are rejected when ALLOW_TEST_LOGIN=false.
import crypto from "node:crypto";

const b64 = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "chaloauto-dev-secret";
}

export const testLoginAllowed = () =>
  process.env.ALLOW_TEST_LOGIN !== undefined
    ? process.env.ALLOW_TEST_LOGIN === "true"
    : process.env.NODE_ENV !== "production";

export function signLocalToken(userId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64(
    JSON.stringify({ sub: userId, test: true, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  );
  const sig = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyLocalToken(token: string): { sub: string } | null {
  if (!testLoginAllowed()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  try {
    const expected = crypto.createHmac("sha256", secret()).update(`${header}.${payload}`).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!data.test || typeof data.sub !== "string") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}
