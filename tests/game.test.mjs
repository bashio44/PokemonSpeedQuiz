import test from "node:test";
import assert from "node:assert/strict";
import {
  STARTING_TIME,
  applyTimeChange,
  createQuestion,
  decodeSharedResult,
  encodeSharedResult,
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
    [sample[1], sample[2], sample[4]],
  );
});

test("each filter can be used independently or turned off", () => {
  assert.deepEqual(
    filterPokemon(sample, { finalOnly: true, regulationOnly: false }),
    [sample[1], sample[2], sample[3], sample[4]],
  );
  assert.deepEqual(
    filterPokemon(sample, { finalOnly: false, regulationOnly: true }, [1, 2]),
    [sample[0], sample[1], sample[4]],
  );
  assert.equal(filterPokemon(sample, { finalOnly: false, regulationOnly: false }).length, 5);
});

test("final-only filtering keeps mega evolutions and every form remains selectable", () => {
  const finalPool = filterPokemon(sample, { finalOnly: true, regulationOnly: false });
  assert.ok(finalPool.includes(sample[4]));
  assert.ok(finalPool.every((entry) => entry.isMegaEvolution || entry.evolutions.length === 0));
  const allPool = filterPokemon(sample, { finalOnly: false, regulationOnly: false });
  assert.deepEqual(allPool, sample);
  allPool.forEach((entry, index) => {
    const pair = createQuestion(allPool, () => index / allPool.length);
    assert.ok(pair.includes(entry));
  });
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

test("correct bonuses shrink to a sustainable floor and incorrect penalties are capped", () => {
  assert.equal(getTimeChange(0, true), 2.5);
  assert.equal(getTimeChange(1, true), 2.4);
  assert.equal(getTimeChange(20, true), 0.8);
  assert.equal(getTimeChange(0, false), -1.5);
  assert.equal(getTimeChange(1, false), -1.9);
  assert.equal(getTimeChange(100, false), -8);
  assert.equal(getTimeChange(Number.MAX_SAFE_INTEGER, true), 0.8);
});

test("a very long perfect streak keeps time arithmetic finite and bounded", () => {
  let time = STARTING_TIME;
  let score = 0;
  for (let question = 0; question < 100_000; question += 1) {
    time = applyTimeChange(time, getTimeChange(question, true));
    score += 1;
    assert.ok(Number.isFinite(time));
    assert.ok(time >= 0 && time <= STARTING_TIME);
  }
  assert.equal(score, 100_000);
  assert.ok(time > 0);
});

test("question pairs get progressively closer in relative speed", () => {
  const pool = Array.from({ length: 101 }, (_, index) => ({
    no: index + 1,
    stats: { speed: index + 1 },
  }));
  const averageGap = (answeredCount) => {
    let seed = 41;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    let total = 0;
    for (let index = 0; index < 1000; index += 1) {
      const [left, right] = createQuestion(pool, random, answeredCount);
      total += Math.abs(left.stats.speed - right.stats.speed) /
        Math.max(left.stats.speed, right.stats.speed);
    }
    return total / 1000;
  };
  assert.ok(averageGap(0) > averageGap(20));
  assert.ok(averageGap(20) > averageGap(80));
  for (const count of [0, 100, 1_000_000, Number.MAX_SAFE_INTEGER]) {
    assert.doesNotThrow(() => createQuestion(pool, () => 0.5, count));
  }
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

test("shared result links restore history, score, and the selected mode", () => {
  const history = [
    { left: sample[0], right: sample[1], selectedSide: "right" },
    { left: sample[2], right: sample[0], selectedSide: "left" },
    { left: sample[4], right: sample[3], selectedSide: "right" },
  ];
  const code = encodeSharedResult(
    { finalOnly: false, regulationOnly: true, history },
    sample,
  );
  const restored = decodeSharedResult(code, sample);
  assert.equal(restored.finalOnly, false);
  assert.equal(restored.regulationOnly, true);
  assert.equal(restored.score, 2);
  assert.deepEqual(
    restored.history.map(({ left, right, selectedSide, isCorrect }) => ({
      left, right, selectedSide, isCorrect,
    })),
    [
      { left: sample[0], right: sample[1], selectedSide: "right", isCorrect: true },
      { left: sample[2], right: sample[0], selectedSide: "left", isCorrect: true },
      { left: sample[4], right: sample[3], selectedSide: "right", isCorrect: false },
    ],
  );
  assert.throws(() => decodeSharedResult("not-valid!", sample), TypeError);
});
