import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { APP_CONFIG } from '../app/js/corinemap/config.js';

const modelPath = new URL(`../app/${APP_CONFIG.modelUrl.replace(/^\.\//, '')}`, import.meta.url);
const mapPath = new URL('../app/Corinebacterium_Glutamicum.json', import.meta.url);
const model = JSON.parse(readFileSync(modelPath, 'utf8'));
const map = JSON.parse(readFileSync(mapPath, 'utf8'));

assert.equal(model.id, 'iCW773');
assert.equal(model.reactions.length, 1212);
assert.equal(model.metabolites.length, 954);
assert.equal(model.genes.length, 773);

const modelReactionIds = new Set(model.reactions.map((reaction) => reaction.id));
assert.equal(modelReactionIds.size, model.reactions.length);
for (const reaction of model.reactions) {
  assert.equal(typeof reaction.id, 'string');
  assert.equal(typeof reaction.metabolites, 'object');
  assert.ok(Number.isFinite(Number(reaction.lower_bound)));
  assert.ok(Number.isFinite(Number(reaction.upper_bound)));
}

const mapReactionIds = new Set(Object.values(map[1].reactions).map(
  (reaction) => reaction.bigg_id,
));
for (const reactionId of mapReactionIds) {
  assert.ok(modelReactionIds.has(reactionId), `${reactionId} is missing from the default model.`);
}

// Exercise the same COBRA parser that Escher uses in the browser. escher.js is
// a CommonJS bundle, so run it in an isolated CommonJS-compatible context.
const escherSource = readFileSync(new URL('../app/js/escher.js', import.meta.url), 'utf8');
const escherModule = { exports: {} };
vm.runInNewContext(escherSource, {
  module: escherModule,
  exports: escherModule.exports,
  require: createRequire(import.meta.url),
  console,
  setTimeout,
  clearTimeout,
});
const parsedModel = escherModule.exports.CobraModel.from_cobra_json(model);
assert.equal(Object.keys(parsedModel.reactions).length, model.reactions.length);
assert.equal(Object.keys(parsedModel.metabolites).length, model.metabolites.length);

console.log('Default COBRA-model tests passed.');
