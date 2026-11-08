// LetMeUse token 驗證的回歸測試。
//
// 本專案原本**完全沒有測試**，而那兩個洞在 2026-11-08 改用 jwks-verify-kit 之前
// 都是活的。bug 已經修好了，所以不能用 TDD 的「先寫測試」—— RED 那一步是刻意重現
// 的（把舊的 jose 實作放回去跑一次，紀錄在 commit message）。
//
// 一顆對壞碼跟好碼都綠的測試比沒測試更糟：它會讓下一個人相信這條路有人守著。
//
// 跑法：`npm test`（用 node 內建的型別剝離，零新依賴）。
// 起一個真的本機假 IdP（不是 mock fetch）：要驗的東西包含「JWKS 怎麼抓」。
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";

const APP = "app_pdfluv_test";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const future = () => Math.floor(Date.now() / 1000) + 3600;

function keypair(kid: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  return { publicKey, privateKey, kid, jwk };
}
type Pair = ReturnType<typeof keypair>;

/** 簽一顆 ES256 token。header 覆寫放最後 → 負面測試可以在**簽之前**改 kid。 */
function sign(claims: Record<string, unknown>, pair: Pair, header: Record<string, unknown> = {}) {
  const h: Record<string, unknown> = { alg: "ES256", kid: pair.kid, ...header };
  if ("kid" in header && header.kid === undefined) delete h.kid;
  const head = b64(h);
  const body = b64(claims);
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), {
    key: pair.privateKey, dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${sig.toString("base64url")}`;
}

const good = keypair("kid-good");
const other = keypair("kid-other"); // 不在 JWKS 裡的另一把

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ keys: [good.jwk] }));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const { port } = server.address() as { port: number };

// env 要在 import 之前設好：那個模組在 module scope 讀 APP_ID 與 JWKS 網址
process.env.LETMEUSE_JWKS_URL = `http://127.0.0.1:${port}/api/jwks`;
// BASE_URL 也設：這樣「還原成舊實作確認測試變紅」時舊碼也連得上假 IdP。
// （舊的 jose 版讀的是 LETMEUSE_BASE_URL + /api/jwks。只設 JWKS_URL 的話舊碼
//  連基準線都過不了，於是所有負面測試都因為「什麼都驗不動」而通過 —— 那種
//  RED 是假的，證明不了任何事。）
process.env.LETMEUSE_BASE_URL = `http://127.0.0.1:${port}`;
process.env.LETMEUSE_APP_ID = APP;
const { verifyToken, requireUser, jwksStats } = await import("../lib/server/auth.ts");

test.after(() => server.close());

test("✅ 基準線：真 token 通（第一次呼叫就通 —— 不依賴開機預熱）", async () => {
  const u = await verifyToken(sign({ sub: "usr_1", app: APP, email: "a@b.c", name: "寶寶", exp: future() }, good));
  assert.ok(u, "真 token 必須通，不然下面每一條 null 都可能是別的原因造成的");
  assert.equal(u.sub, "usr_1");
  assert.equal(u.email, "a@b.c");
  assert.equal(u.name, "寶寶");
  assert.equal(jwksStats().keys, 1);
});

// ── exp：jose 的 jwtVerify **預設不要求 exp 存在** ───────────────────────────
test("🔒 沒有 exp 的 token 要擋（舊碼用 jose 預設 → 永不過期）", async () => {
  assert.equal(await verifyToken(sign({ sub: "usr_1", app: APP, email: "a@b.c" }, good)), null);
});

test("🔒 字串型 exp 要擋", async () => {
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: String(future()) }, good);
  assert.equal(await verifyToken(t), null);
});

test("🔒 已過期要擋", async () => {
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: Math.floor(Date.now() / 1000) - 10 }, good);
  assert.equal(await verifyToken(t), null);
});

test("🔒 nbf 還在未來要擋", async () => {
  const now = Math.floor(Date.now() / 1000);
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: now + 3600, nbf: now + 600 }, good);
  assert.equal(await verifyToken(t), null);
});

// ── 租戶邊界：舊碼 `if (APP_ID && payload.app !== APP_ID)` ───────────────────
test("🔒 別的 app 的 token 要擋（不然能進別人的書櫃與生詞本）", async () => {
  const t = sign({ sub: "usr_1", app: "app_other", email: "a@b.c", exp: future() }, good);
  assert.equal(await verifyToken(t), null);
});

test("🔒 完全沒帶 app claim 要擋", async () => {
  assert.equal(await verifyToken(sign({ sub: "usr_1", email: "a@b.c", exp: future() }, good)), null);
});

// ── alg / 簽章 / kid ────────────────────────────────────────────────────────
test("🔒 HS256 偽造要擋（app secret 外洩劇本 = pokkit 2026-10-25）", async () => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub: "usr_evil", app: APP, email: "a@b.c", exp: future() });
  const sig = crypto.createHmac("sha256", "leaked-secret").update(`${h}.${p}`).digest("base64url");
  assert.equal(await verifyToken(`${h}.${p}.${sig}`), null);
});

test("🔒 alg:none 要擋", async () => {
  const h = b64({ alg: "none" });
  const p = b64({ sub: "usr_evil", app: APP, email: "a@b.c", exp: future() });
  assert.equal(await verifyToken(`${h}.${p}.`), null);
});

test("🔒 kid 不在 JWKS 要擋（簽章本身有效）", async () => {
  // kid 要在**簽之前**就設好，簽完才改的話簽章本身壞了，那樣的 null 證明不了
  // 「kid 檢查有在運作」。
  assert.equal(await verifyToken(sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: future() }, other)), null);
});

test("🔒 header 沒帶 kid 要擋", async () => {
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: future() }, good, { kid: undefined });
  assert.equal(await verifyToken(t), null);
});

test("🔒 payload 被換掉要擋（驗簽在解析 payload 之前）", async () => {
  const [h, , sig] = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: future() }, good).split(".");
  const evil = b64({ sub: "usr_admin", app: APP, email: "admin@b.c", exp: future() });
  assert.equal(await verifyToken(`${h}.${evil}.${sig}`), null);
});

test("🔒 簽章同義寫法要擋（同一個簽章 16 種等價編碼）", async () => {
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: future() }, good);
  const [h, p, sig] = t.split(".");
  const bytes = Buffer.from(sig, "base64url");
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let alt: string | null = null;
  for (const c of ALPHA) {
    if (c === sig[sig.length - 1]) continue;
    const cand = sig.slice(0, -1) + c;
    if (Buffer.from(cand, "base64url").equals(bytes)) { alt = cand; break; }
  }
  assert.ok(alt, "應該找得到同義寫法");
  assert.equal(await verifyToken(`${h}.${p}.${alt}`), null);
});

test("🔒 sub 不是非空字串要擋", async () => {
  for (const sub of [undefined, "", 123, { a: 1 }, null]) {
    const t = sign({ sub, app: APP, email: "a@b.c", exp: future() }, good);
    assert.equal(await verifyToken(t), null, JSON.stringify(sub));
  }
});

test("🔒 垃圾輸入一律 null，不丟例外", async () => {
  for (const bad of ["", "abc", "a.b", "a.b.c.d", "....", "not.a.jwt"]) {
    assert.equal(await verifyToken(bad), null, JSON.stringify(bad));
  }
});

// ── requireUser（Request → 使用者）─────────────────────────────────────────
test("🔒 requireUser：沒帶 / 壞掉的 Authorization 一律 null", async () => {
  for (const auth of [null, "", "Basic abc", "Bearer", "Bearer   ", "Token xyz"]) {
    const headers = new Headers();
    if (auth) headers.set("authorization", auth);
    assert.equal(await requireUser(new Request("http://x/api", { headers })), null, JSON.stringify(auth));
  }
});

test("✅ requireUser：小寫 bearer 也收（RFC 7235 scheme 不分大小寫）", async () => {
  const t = sign({ sub: "usr_1", app: APP, email: "a@b.c", exp: future() }, good);
  const headers = new Headers({ authorization: `bearer ${t}` });
  const u = await requireUser(new Request("http://x/api", { headers }));
  assert.ok(u);
  assert.equal(u.sub, "usr_1");
});
