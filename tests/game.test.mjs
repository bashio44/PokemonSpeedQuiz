import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTING_TIME,
  applyTimeChange,
  createQuestion,
  filterPokemon,
  getSpriteKey,
  getSpritePath,
  getTimeChange,
} from "../src/game.mjs";

const sample = [
  { no: 1, stats: { speed: 45 }, evolutions: [2], isMegaEvolution: false },
  { no: 2, stats: { speed: 60 }, evolutions: [], isMegaEvolution: false },
  { no: 3, stats: { speed: 80 }, evolutions: [], isMegaEvolution: false },
  { no: 4, stats: { speed: 80 }, evolutions: [], isMegaEvolution: false },
  { no: 2, stats: { speed: 100 }, evolutions: [], isMegaEvolution: true },
];

test("the default filters only include final Pokémon in the M-C ID set", () => {
  assert.deepEqual(
    filterPokemon(sample, { finalOnly: true, regulationOnly: true }, [2, 3]),
    [sample[1], sample[2]],
  );
});

test("each filter can be used independently or turned off", () => {
  assert.deepEqual(
    filterPokemon(sample, { finalOnly: true, regulationOnly: false }),
    [sample[1], sample[2], sample[3]],
  );
  assert.deepEqual(
    filterPokemon(sample, { finalOnly: false, regulationOnly: true }, [1, 2]),
    [sample[0], sample[1], sample[4]],
  );
  assert.equal(filterPokemon(sample, { finalOnly: false, regulationOnly: false }).length, 5);
});

test("filtering discards entries without usable speed data", () => {
  assert.deepEqual(
    filterPokemon([{ no: 6, evolutions: [], stats: {} }], { finalOnly: false, regulationOnly: false }),
    [],
  );
});

test("questions always contain two Pokémon with different speed stats", () => {
  for (let index = 0; index < 100; index += 1) {
    const [left, right] = createQuestion(sample, () => (index % 10) / 10);
    assert.notEqual(left.stats.speed, right.stats.speed);
  }
});

test("question creation reports pools that cannot make a valid pair", () => {
  assert.throws(() => createQuestion([sample[0]]), RangeError);
  assert.throws(() => createQuestion([sample[2], sample[3]]), RangeError);
});

test("correct bonuses shrink and incorrect penalties grow as questions progress", () => {
  assert.equal(getTimeChange(0, true), 2.5);
  assert.equal(getTimeChange(1, true), 2.4);
  assert.equal(getTimeChange(20, true), 0.5);
  assert.equal(getTimeChange(0, false), -1);
  assert.equal(getTimeChange(1, false), -1.2);
});

test("time adjustments never exceed the cap or fall below zero", () => {
  assert.equal(applyTimeChange(29, 2.5), STARTING_TIME);
  assert.equal(applyTimeChange(5, -10), 0);
  assert.equal(applyTimeChange(10, 2.5), 12.5);
});

test("sprite paths use the form-specific local asset mapping", () => {
  const sprites = new Map([
    [getSpriteKey({ no: 25, name: "ピカチュウ", form: "" }), 25],
    [getSpriteKey({ no: 25, name: "ピカチュウ", form: "アローラのすがた" }), 10091],
  ]);
  assert.equal(getSpritePath({ no: 25, name: "ピカチュウ", form: "" }, sprites), "./assets/pokemon/25.png");
  assert.equal(getSpritePath({ no: 25, name: "ピカチュウ", form: "アローラのすがた" }, sprites), "./assets/pokemon/10091.png");
  assert.throws(() => getSpritePath({ no: 25, name: "ピカチュウ", form: "別のすがた" }, sprites), RangeError);
});
