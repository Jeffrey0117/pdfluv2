// LetMeUse token 驗證（只收 ES256，公鑰走 JWKS）。
//
// 2026-11-08：改用 `jwks-verify-kit`，同時**移除 jose 依賴**（它在整個專案只被
// 這個檔案用到）。生態系原本有十份各自獨立的驗章拷貝，每份踩到不同的一半坑；
// pdfluv 這份用 jose 看起來最正規，但中了兩個：
//
//   1. **`jose` 的 `jwtVerify` 預設不要求 `exp` 存在。** 一顆沒有 `exp` 的 token
//      簽章有效就通過 → **永不過期**。而 4h 的 exp 是這套設計唯一的撤銷機制：
//      登出、停用帳號、資安事件後強制登出，全靠它。jose 要寫
//      `requiredClaims: ['exp']` 才會擋，而那是「缺少某樣東西」的問題 ——
//      regex 稽核抓不到，只有讀文件或讀測試才知道。
//   2. **`if (APP_ID && payload.app !== APP_ID)`** —— 自己忘了設
//      LETMEUSE_APP_ID 就等於接受任何 LetMeUse app 的任何使用者（可以進別人的
//      書櫃與生詞本）。LetMeUse 用同一把 ES256 金鑰簽發**所有** app 的 token，
//      所以 `app` claim 是唯一的租戶邊界。現在沒設就直接拒絕並 log。
//
// 另外 kit 帶來的：簽章段的正規化比對（同一個簽章 16 種等價編碼）、claims 不走
// 原型鏈、`crit` header 拒收、JWKS 走明文 http 直接 throw、JWK 帶私鑰材料大聲
// 拒絕、抓取逾時 + `Promise.race`、權威的空回應會清空快取（緊急撤銷真的生效）、
// 以及 `onReject` 的逐顆 token 拒絕原因。
//
// ⚠️ 2026-10-28 資安：廢除 HS256（pokkit 事件 — app secret 一洩就能自簽任意 sub
// 偽造任何會員的書櫃/生詞本）。改成只收 ES256 之後驗證只需要公鑰。
import { createJwksCache, verifyJwtAsync, bearerToken, type Claims } from "jwks-verify-kit";

const BASE_URL = (process.env.LETMEUSE_BASE_URL || "").replace(/\/+$/, "");
const APP_ID = process.env.LETMEUSE_APP_ID || process.env.NEXT_PUBLIC_LETMEUSE_APP_ID || "";

export interface AuthUser {
  sub: string;
  email: string;
  name: string;
}

// 跨 hot-reload / 跨 route 共用同一份快取（Next.js dev 會重複載入模組）。
// 延遲建立：import 這個模組不該有網路副作用（build 時也會載入）。
type Cache = ReturnType<typeof createJwksCache>;
const globalAny = globalThis as { __lmuJwksCache?: Cache };

function cache(): Cache {
  if (!globalAny.__lmuJwksCache) {
    globalAny.__lmuJwksCache = createJwksCache({
      url: process.env.LETMEUSE_JWKS_URL || `${BASE_URL}/api/jwks`,
      algorithms: ["ES256"],
      onError: (err) => console.error(`[jwks] 抓取失敗: ${err.message}`),
    });
    void globalAny.__lmuJwksCache.start(); // 定時刷新（計時器已 unref）
  }
  return globalAny.__lmuJwksCache;
}

/**
 * 驗 token，通過回使用者，否則 null（從不丟例外）。
 *
 * 用 async + `getKeyAsync`：Next.js 沒有可靠的開機預熱點，同步版的後果是「重啟
 * 後第一個請求就算帶完全有效的 token 也會 401」。非同步版在快取還沒暖的時候等
 * 一次（有逾時的）抓取。
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  if (!APP_ID) {
    console.error("[auth] 401: 沒設 LETMEUSE_APP_ID，一律拒絕（JWKS 全 app 共用金鑰）");
    return null;
  }

  const claims: Claims | null = await verifyJwtAsync(token, {
    getKey: (kid) => cache().getKeyAsync(kid),
    algorithms: ["ES256"],
    requiredClaims: { app: APP_ID },
    // 逐顆 token 的拒絕原因。只進伺服器 log —— info 裡的值多半是呼叫端送來的，
    // 原樣回給對方等於反射式資訊外洩。
    onReject: (info) => console.warn(`[auth] 401: ${info.reason}`),
  });
  if (!claims) return null;

  // kit 已保證 sub 是非空字串
  const sub = String(claims.sub);
  return {
    sub,
    email: typeof claims.email === "string" ? claims.email : "",
    name: typeof claims.name === "string" ? claims.name : "",
  };
}

export async function requireUser(req: Request): Promise<AuthUser | null> {
  // scheme 依 RFC 7235 §2.1 不分大小寫（`bearer xxx` 是合法請求，擋掉它只是製造
  // 「為什麼我這支 client 一直 401」的災難）。
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return null;
  return verifyToken(token);
}

/** 診斷用 — 讓健檢看得到「公鑰到底抓到了沒」。 */
export function jwksStats() {
  return cache().stats();
}
