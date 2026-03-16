function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seedInput) {
  let seed = hashString(String(seedInput));

  return function nextRandom() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomBetween(random, min, max) {
  return min + (max - min) * random();
}

export function jitterPair(random, rangeX, rangeY) {
  return {
    x: Math.round(randomBetween(random, -rangeX, rangeX)),
    y: Math.round(randomBetween(random, -rangeY, rangeY)),
  };
}

export function pickOne(random, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  const index = Math.floor(random() * values.length);
  return values[index];
}
