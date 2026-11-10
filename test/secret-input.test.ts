// 2026-11-11 回歸:「不是登入用、卻是 type=password」的欄位會被瀏覽器自動填入。
//
// LetMeUse 的登入框是畫在本站頁面上的,所以瀏覽器會幫「這個站」存一組登入密碼,
// 之後本站任何 type=password 的欄位都可能被它填進去(Chrome 對密碼欄刻意無視
// autocomplete="off")。同一晚 pokkit 的上傳密碼欄就這樣中了。
//
// 這裡的 API Key 欄位如果被填入,存下來的「金鑰」其實是使用者的登入密碼,而且會
// 被當成 Bearer token 送到 OpenAI 或使用者填的 API 網址。
//
// 金鑰不是密碼:改成一般文字欄位 + CSS 遮罩,瀏覽器就不會把它當密碼欄來填。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { SECRET_INPUT_CLASS, SECRET_INPUT_PROPS } from "../lib/secret-input.ts";

test("a secret field is not a password field, so credential autofill never targets it", () => {
  assert.notEqual(SECRET_INPUT_PROPS.type, "password");
  assert.equal(SECRET_INPUT_PROPS.type, "text");
});

test("ordinary text autofill and password managers are told to stay out", () => {
  assert.equal(SECRET_INPUT_PROPS.autoComplete, "off");
  assert.equal(SECRET_INPUT_PROPS.spellCheck, false);
  for (const attr of ["data-lpignore", "data-1p-ignore", "data-bwignore", "data-form-type"]) {
    assert.ok(attr in SECRET_INPUT_PROPS, `${attr} is set`);
  }
});

test("the value is still masked on screen", () => {
  assert.match(SECRET_INPUT_CLASS, /-webkit-text-security:disc/);
});

test("the API key field uses it and no password-type input is left in the settings UI", () => {
  const src = fs.readFileSync(new URL("../components/ProviderSettings.tsx", import.meta.url), "utf8");
  assert.ok(!/type=["']password["']/.test(src), "ProviderSettings must not render a type=password input");
  assert.match(src, /\{\.\.\.SECRET_INPUT_PROPS\}/);
  assert.match(src, /SECRET_INPUT_CLASS/);
});
