// LetMeUse token 驗證：新 token ES256（JWKS 公鑰），舊 token HS256（app secret）
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from "jose";

const BASE_URL = process.env.LETMEUSE_BASE_URL || "";
const APP_ID = process.env.LETMEUSE_APP_ID || "";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
}

type Jwks = ReturnType<typeof createRemoteJWKSet>;
const globalAny = globalThis as { __lmuJwks?: Jwks };

function getJwks(): Jwks {
  if (!globalAny.__lmuJwks) {
    globalAny.__lmuJwks = createRemoteJWKSet(new URL(BASE_URL + "/api/jwks"));
  }
  return globalAny.__lmuJwks;
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const header = decodeProtectedHeader(token);
    const result =
      header.alg === "ES256"
        ? await jwtVerify(token, getJwks(), { algorithms: ["ES256"] })
        : await jwtVerify(token, new TextEncoder().encode(process.env.LETMEUSE_APP_SECRET || ""), {
            algorithms: ["HS256"],
          });
    const payload = result.payload as Record<string, unknown>;
    if (APP_ID && payload.app !== APP_ID) return null; // 別的 app 的 token 不準借用
    const sub = String(payload.sub || payload.userId || "");
    if (!sub) return null;
    return { sub, email: String(payload.email || ""), name: String(payload.name || "") };
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<AuthUser | null> {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7));
}
