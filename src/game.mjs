export const STARTING_TIME = 30;

export function filterPokemon(pokemon, { finalOnly, regulationOnly }, regulationIds = []) {
  const allowedIds = regulationOnly ? new Set(regulationIds) : null;

  return pokemon.filter((entry) => {
    if (!entry || !Number.isFinite(entry.no) || !Number.isFinite(entry.stats?.speed)) {
      return false;
    }

    if (finalOnly && !entry.isMegaEvolution && (!Array.isArray(entry.evolutions) || entry.evolutions.length > 0)) {
      return false;
    }

    return !allowedIds || allowedIds.has(entry.no);
  });
}

export function createQuestion(pool, random = Math.random, answeredCount = 0) {
  if (!Array.isArray(pool) || pool.length < 2) {
    throw new RangeError("2匹以上のポケモンが必要です。");
  }

  const firstIndex = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  const first = pool[firstIndex];
  const alternatives = pool
    .filter((entry) => entry.stats.speed !== first.stats.speed)
    .map((entry) => ({
      entry,
      relativeGap: Math.abs(entry.stats.speed - first.stats.speed) /
        Math.max(1, entry.stats.speed, first.stats.speed),
    }))
    .sort((left, right) => right.relativeGap - left.relativeGap);

  if (alternatives.length === 0) {
    throw new RangeError("素早さ種族値が異なるポケモンが必要です。");
  }

  const difficulty = Math.exp(-Math.max(0, answeredCount) / 22);
  const targetIndex = Math.round((1 - difficulty) * (alternatives.length - 1));
  const radius = Math.max(1, Math.round((alternatives.length - 1) * 0.08 * difficulty));
  const start = Math.max(0, targetIndex - radius);
  const end = Math.min(alternatives.length - 1, targetIndex + radius);
  const secondIndex = start + Math.min(end - start, Math.floor(random() * (end - start + 1)));
  const second = alternatives[secondIndex].entry;
  return random() < 0.5 ? [first, second] : [second, first];
}

export function getTimeChange(answeredCount, isCorrect) {
  const count = Math.max(0, Math.floor(Number.isFinite(answeredCount) ? answeredCount : 0));
  if (isCorrect) {
    return Math.max(1, Number((5 - count * 0.12).toFixed(1)));
  }
  return -Math.min(8, Number((1.5 + count * 0.35).toFixed(1)));
}

export function applyTimeChange(currentTime, change, maximum = STARTING_TIME) {
  return Math.min(maximum, Math.max(0, currentTime + change));
}

export function getSpritePath(pokemon, spriteIds) {
  const key = getSpriteKey(pokemon);
  const spriteId = spriteIds.get(key);
  if (!Number.isInteger(spriteId)) {
    throw new RangeError(`画像データがありません: ${key}`);
  }
  return `./assets/pokemon/${spriteId}.png`;
}

export function getSpriteKey(pokemon) {
  return `${pokemon.no}:${pokemon.form ?? ""}:${pokemon.name}`;
}

export function encodeSharedResult({ finalOnly, regulationOnly, history }, pokemon) {
  const indexes = new Map(pokemon.map((entry, index) => [entry, index]));
  const mode = (finalOnly ? 1 : 0) | (regulationOnly ? 2 : 0);
  const bytes = [2, mode];
  writeVarint(bytes, history.length);
  history.forEach((answer) => {
    const left = indexes.get(answer.left);
    const right = indexes.get(answer.right);
    if (!Number.isInteger(left) || !Number.isInteger(right) ||
      (answer.selectedSide !== "left" && answer.selectedSide !== "right")) {
      throw new TypeError("共有する回答データが不正です。");
    }
    writeVarint(bytes, left);
    writeVarint(bytes, right);
    bytes.push(answer.selectedSide === "right" ? 1 : 0);
  });
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary);
  const code = encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  if (code.length > 100_000) {
    throw new RangeError("結果が長すぎて共有リンクを作成できません。");
  }
  return code;
}

export function decodeSharedResult(code, pokemon) {
  if (typeof code !== "string" || code.length === 0 || code.length > 100_000 ||
    !/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new TypeError("共有リンクの結果データが不正です。");
  }

  let bytes;
  try {
    const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
    bytes = Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      (character) => character.charCodeAt(0),
    );
  } catch {
    throw new TypeError("共有リンクの結果データを読み取れません。");
  }

  if (bytes[0] === 2) {
    return decodeCompactResult(bytes, pokemon);
  }

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new TypeError("共有リンクの結果データを読み取れません。");
  }
  if (!Array.isArray(payload) || payload.length !== 3 || payload[0] !== 1 ||
    !Number.isInteger(payload[1]) || payload[1] < 0 || payload[1] > 3 ||
    !Array.isArray(payload[2])) {
    throw new TypeError("共有リンクの結果データが不正です。");
  }

  const records = payload[2].map((record, index) => {
    if (!Array.isArray(record) || record.length !== 3 ||
      !Number.isInteger(record[0]) || !Number.isInteger(record[1]) ||
      !Number.isInteger(record[2]) || record[2] < 0 || record[2] > 1) {
      throw new TypeError(`共有リンクの第${index + 1}問のデータが不正です。`);
    }
    return record;
  });
  return restoreSharedResult(payload[1], records, pokemon);
}

function decodeCompactResult(bytes, pokemon) {
  if (!Number.isInteger(bytes[1]) || bytes[1] > 3) {
    throw new TypeError("共有リンクの結果データが不正です。");
  }

  let offset = 2;
  const { value: count, nextOffset } = readVarint(bytes, offset);
  offset = nextOffset;
  if (count > Math.floor((bytes.length - offset) / 3)) {
    throw new TypeError("共有リンクの結果データが不正です。");
  }
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const left = readVarint(bytes, offset);
    const right = readVarint(bytes, left.nextOffset);
    const selected = bytes[right.nextOffset];
    if (selected !== 0 && selected !== 1) {
      throw new TypeError(`共有リンクの第${index + 1}問のデータが不正です。`);
    }
    records.push([left.value, right.value, selected]);
    offset = right.nextOffset + 1;
  }
  if (offset !== bytes.length) {
    throw new TypeError("共有リンクの結果データが不正です。");
  }
  return restoreSharedResult(bytes[1], records, pokemon);
}

function restoreSharedResult(mode, records, pokemon) {
  const history = records.map((record, index) => {
    if (record[0] < 0 || record[0] >= pokemon.length ||
      record[1] < 0 || record[1] >= pokemon.length) {
      throw new TypeError(`共有リンクの第${index + 1}問のデータが不正です。`);
    }
    const [left, right] = [pokemon[record[0]], pokemon[record[1]]];
    if (left.stats.speed === right.stats.speed) {
      throw new TypeError(`共有リンクの第${index + 1}問の素早さデータが不正です。`);
    }
    const selectedSide = record[2] === 1 ? "right" : "left";
    const correctSide = left.stats.speed > right.stats.speed ? "left" : "right";
    const isCorrect = selectedSide === correctSide;
    return {
      left,
      right,
      selectedSide,
      correctSide,
      isCorrect,
      change: getTimeChange(index, isCorrect),
    };
  });
  return {
    finalOnly: Boolean(mode & 1),
    regulationOnly: Boolean(mode & 2),
    history,
    score: history.filter((answer) => answer.isCorrect).length,
  };
}

function writeVarint(bytes, value) {
  let remaining = value;
  do {
    const byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    bytes.push(byte | (remaining > 0 ? 128 : 0));
  } while (remaining > 0);
}

function readVarint(bytes, startOffset) {
  let value = 0;
  let multiplier = 1;
  let offset = startOffset;
  while (offset < bytes.length && offset - startOffset < 8) {
    const byte = bytes[offset];
    value += (byte & 127) * multiplier;
    offset += 1;
    if (byte < 128) {
      if (!Number.isSafeInteger(value)) break;
      return { value, nextOffset: offset };
    }
    multiplier *= 128;
  }
  throw new TypeError("共有リンクの結果データが不正です。");
}
