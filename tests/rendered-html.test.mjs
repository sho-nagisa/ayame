import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("トップページにサイト本体のUIがある", async () => {
  const page = await source("app/page.tsx");
  const layout = await source("app/layout.tsx");
  assert.match(layout, /<html lang="ja">/);
  assert.match(page, /ヨミトク|漢字/);
  assert.doesNotMatch(page, /Your site is taking shape|Building your site/);
});

test("管理画面と問題管理画面のルートがある", async () => {
  const admin = await source("app/admin/page.tsx");
  const questions = await source("app/admin/questions/page.tsx");
  assert.match(admin, /export default/);
  assert.match(questions, /export default/);
});
