import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, "data/pokemon-sprites.json");
const pokemonPath = resolve(root, "data/pokemon.json");
const assetsDirectory = resolve(root, "assets/pokemon");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const pokemon = JSON.parse(await readFile(pokemonPath, "utf8"));
const requiredIds = new Set(manifest.flatMap(({ no, spriteId }) => [no, spriteId]));
const available = new Set();
const missing = new Set();
const queue = [...requiredIds];
let downloaded = 0;

if (manifest.length !== pokemon.length) {
  throw new Error("The sprite manifest and Pokémon data have different lengths.");
}
manifest.forEach((entry, index) => {
  const source = pokemon[index];
  if (entry.no !== source.no || entry.form !== source.form) {
    throw new Error(`Sprite manifest order does not match Pokémon data at index ${index}.`);
  }
  entry.name = source.name;
});

await mkdir(assetsDirectory, { recursive: true });

async function download(id) {
  const path = resolve(assetsDirectory, `${id}.png`);
  try {
    const existing = await readFile(path);
    if (existing.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      available.add(id);
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`);
      if (response.status === 404) {
        missing.add(id);
        return;
      }
      if (!response.ok) {
        throw new Error(`Sprite ${id}: HTTP ${response.status}`);
      }
      const image = Buffer.from(await response.arrayBuffer());
      if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error(`Sprite ${id}: invalid PNG data`);
      }
      await writeFile(path, image);
      available.add(id);
      downloaded += 1;
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * (attempt + 1)));
    }
  }
}

async function worker() {
  while (queue.length) {
    await download(queue.shift());
  }
}

await Promise.all(Array.from({ length: 16 }, worker));

for (const entry of manifest) {
  if (!available.has(entry.spriteId)) {
    if (!available.has(entry.no)) {
      throw new Error(`Neither sprite ${entry.spriteId} nor base sprite ${entry.no} is available.`);
    }
    entry.spriteId = entry.no;
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Downloaded ${downloaded} sprites; ${missing.size} unavailable form sprites use their base species image.`);
