import assert from 'node:assert/strict';
import {
  createReactionDataset,
  getActiveDataset,
  suggestDatasetName,
  uniqueDatasetName,
} from '../app/js/corinemap/reaction-datasets.js';

assert.equal(suggestDatasetName('my_flux_data.csv'), 'My Flux Data');
assert.equal(suggestDatasetName(''), 'Flux data');

const datasets = [];
const mannitol = createReactionDataset({
  id: 'mannitol',
  name: 'Mannitol',
  reactionData: { PGK: 1 },
  source: 'preloaded',
}, datasets);
datasets.push(mannitol);

const duplicateName = createReactionDataset({
  name: 'Mannitol',
  reactionData: { PGK: 2 },
}, datasets);
datasets.push(duplicateName);

assert.equal(mannitol.id, 'mannitol');
assert.equal(duplicateName.id, 'mannitol-2');
assert.equal(duplicateName.name, 'Mannitol (2)');
assert.equal(uniqueDatasetName('Xylose', datasets), 'Xylose');
assert.equal(getActiveDataset({ datasets, activeDatasetId: 'mannitol-2' }), duplicateName);
assert.equal(getActiveDataset({ datasets, activeDatasetId: null }), null);

console.log('Reaction-dataset tests passed.');
