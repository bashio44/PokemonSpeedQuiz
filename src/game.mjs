export const STARTING_TIME = 30;

export function filterPokemon(pokemon, { finalOnly, regulationOnly }, regulationIds = []) {
  const allowedIds = regulationOnly ? new Set(regulationIds) : null;

  return pokemon.filter((entry) => {
    if (!entry || !Number.isFinite(entry.no) || !Number.isFinite(entry.stats?.speed)) {
      return false;
    }

    if (finalOnly && (entry.isMegaEvolution || !Array.isArray(entry.evolutions) || entry.evolutions.length > 0)) {
      return false;
    }

    return !allowedIds || allowedIds.has(entry.no);
  });
}

export function createQuestion(pool, random = Math.random) {
  if (!Array.isArray(pool) || pool.length < 2) {
    throw new RangeError("2匹以上のポケモンが必要です。");
  }

  const firstIndex = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  const first = pool[firstIndex];
  const alternatives = pool.filter((entry) => entry.stats.speed !== first.stats.speed);

  if (alternatives.length === 0) {
    throw new RangeError("素早さ種族値が異なるポケモンが必要です。");
  }

  const secondIndex = Math.min(alternatives.length - 1, Math.floor(random() * alternatives.length));
  const second = alternatives[secondIndex];
  return random() < 0.5 ? [first, second] : [second, first];
}

export function getTimeChange(answeredCount, isCorrect) {
  const count = Math.max(0, Math.floor(answeredCount));
  if (isCorrect) {
    return Math.max(0.5, Number((2.5 - count * 0.15).toFixed(1)));
  }
  return -Number((1 + count * 0.2).toFixed(1));
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
