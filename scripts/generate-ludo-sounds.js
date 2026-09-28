#!/usr/bin/env node
/**
 * Renders the web Ludo cartoon sound recipes (web/src/pages/ludo/utils/funSounds.js)
 * into WAV files for the Expo app, so both apps sound the same.
 *
 *   node scripts/generate-ludo-sounds.js
 *
 * Re-run after changing a recipe in funSounds.js.
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../web/src/pages/ludo/utils/funSounds.js');
const OUT_DIR = path.resolve(__dirname, '../src/assets/sounds/ludo');
const SAMPLE_RATE = 22050;

// funSounds.js is a browser ES module; lift out its pure synthesis code
// (everything before the WebAudio playback helpers) and evaluate it here.
const loadRecipes = () => {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const start = source.indexOf('const TWO_PI');
  const end = source.indexOf('const FALLBACK_TONES');
  if (start < 0 || end < 0) throw new Error('Could not find the recipes in funSounds.js');
  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(start, end)}\nreturn RECIPES;`)();
};

const toWav = (samples) => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

const recipes = loadRecipes();
Object.entries(recipes).forEach(([name, recipe]) => {
  const scratch = new Float32Array(Math.ceil(SAMPLE_RATE * 2.2));
  const length = Math.min(scratch.length, Math.ceil(recipe(scratch, SAMPLE_RATE) * SAMPLE_RATE));
  const file = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(file, toWav(Array.from(scratch.subarray(0, length))));
  console.log(`${name}.wav  ${(length / SAMPLE_RATE).toFixed(2)}s`);
});
