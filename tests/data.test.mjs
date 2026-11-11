import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createQuestion, filterPokemon } from "../src/game.mjs";

const pokemon = JSON.parse(
  await readFile(new URL("../data/pokemon.json", import.meta.url), "utf8"),
);
const regulationIds = JSON.parse(
  await readFile(new URL("../data/regulation-mc.json", import.meta.url), "utf8"),
);

test("the bundled data includes all national dex entries through 1025", () => {
  assert.equal(Math.max(...pokemon.map((entry) => entry.no)), 1025);
  assert.ok(pokemon.every((entry) => Number.isFinite(entry.stats.speed)));
});

test("the M-C list contains 231 species and each maps to bundled data", () => {
  assert.equal(regulationIds.length, 231);
  assert.ok(regulationIds.every((number) => pokemon.some((entry) => entry.no === number)));
});

test("the default filters provide enough distinct-speed questions", () => {
  const pool = filterPokemon(
    pokemon,
    { finalOnly: true, regulationOnly: true },
    regulationIds,
  );
  assert.equal(pool.length, 244);
  assert.equal(new Set(pool.map((entry) => entry.stats.speed)).size, 81);
  for (let index = 0; index < 500; index += 1) {
    const [left, right] = createQuestion(pool);
    assert.notEqual(left.stats.speed, right.stats.speed);
  }
});
