import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createQuestion, filterPokemon, getSpriteKey, getSpritePath } from "../src/game.mjs";

const pokemon = JSON.parse(
  await readFile(new URL("../data/pokemon.json", import.meta.url), "utf8"),
);
const regulationIds = JSON.parse(
  await readFile(new URL("../data/regulation-mc.json", import.meta.url), "utf8"),
);
const spriteManifest = JSON.parse(
  await readFile(new URL("../data/pokemon-sprites.json", import.meta.url), "utf8"),
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

test("every bundled Pokémon has a valid local PNG sprite", async () => {
  assert.equal(spriteManifest.length, pokemon.length);
  const spriteIds = new Map(
    spriteManifest.map((entry) => [getSpriteKey(entry), entry.spriteId]),
  );
  assert.equal(spriteIds.size, spriteManifest.length);
  const paths = [...new Set(pokemon.map((entry) => getSpritePath(entry, spriteIds)))];

  for (const path of paths) {
    const file = new URL(`../${path.slice(2)}`, import.meta.url);
    const image = await readFile(file);
    assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), path);
    assert.ok(image.readUInt32BE(16) > 0 && image.readUInt32BE(20) > 0, path);
  }
});
