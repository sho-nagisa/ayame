import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/questions.ts", import.meta.url), "utf8");
const rows = [...source.matchAll(
  /\{ id: "([^"]+)", level: "([456])", targetKanji: "([^"]+)",.*?reading: "([^"]+)".*?kind: "(音読み|訓読み)" \},/g,
)];

test("全問題にID・級・対象漢字・読み・種別がある", () => {
  assert.equal(rows.length, 5958);
  for (const [, id, level, targetKanji, reading, kind] of rows) {
    assert.match(id, new RegExp(`^${level}-[0-9a-f]+-(on|kun)$`));
    assert.equal([...targetKanji].length, 1);
    assert.match(reading, /^[ぁ-ゖー]+$/);
    assert.ok(kind === "音読み" || kind === "訓読み");
  }
});

test("各級に音読み・訓読みの両方があり、出題漢字が重複IDを持たない", () => {
  const ids = new Set(rows.map((row) => row[1]));
  assert.equal(ids.size, rows.length);
  for (const level of ["4", "5", "6"]) {
    const levelRows = rows.filter((row) => row[2] === level);
    assert.ok(levelRows.some((row) => row[5] === "音読み"));
    assert.ok(levelRows.some((row) => row[5] === "訓読み"));
    assert.ok(levelRows.every((row) => row[1].startsWith(`${level}-`)));
  }
});
