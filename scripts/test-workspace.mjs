import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cloneDefaultAppearance,
  cloneDefaultCategories,
} from '../app/js/corinemap/config.js';
import {
  createWorkspace,
  validateWorkspace,
  WORKSPACE_FORMAT,
  WORKSPACE_VERSION,
} from '../app/js/corinemap/workspace.js';

const map = JSON.parse(readFileSync(
  new URL('../app/Corinebacterium_Glutamicum.json', import.meta.url),
  'utf8',
));
const builder = { map: { map_for_export: () => map } };
const state = {
  categories: cloneDefaultCategories(),
  datasets: [
    { id: 'mannitol', name: 'Mannitol', reactionData: { PGK: 1 } },
    { id: 'xylose', name: 'Xylose', reactionData: { PGK: 2 } },
  ],
  activeDatasetId: 'xylose',
  appearance: cloneDefaultAppearance(),
  appearancePreview: {
    ...cloneDefaultAppearance(),
    reactionLabelSize: 99,
  },
  legend: { title: 'Reaction regulation', x: 10, y: 20, fontSize: 82 },
};

const workspace = createWorkspace(builder, state);
assert.equal(workspace.format, WORKSPACE_FORMAT);
assert.equal(workspace.version, WORKSPACE_VERSION);
assert.equal(workspace.activeDatasetId, 'xylose');
assert.equal(workspace.appearance.reactionLabelSize, 30);
assert.notEqual(workspace.appearance.reactionLabelSize, state.appearancePreview.reactionLabelSize);
assert.deepEqual(workspace.datasets[1].reactionData, { PGK: 2 });
assert.equal(validateWorkspace(workspace).datasets.length, 2);

const versionOneWorkspace = {
  ...workspace,
  version: 1,
  reactionData: { PGK: 1 },
};
delete versionOneWorkspace.datasets;
delete versionOneWorkspace.activeDatasetId;
const migrated = validateWorkspace(versionOneWorkspace);
assert.equal(migrated.version, WORKSPACE_VERSION);
assert.equal(migrated.activeDatasetId, 'imported-data');
assert.deepEqual(migrated.datasets[0].reactionData, { PGK: 1 });
assert.equal(migrated.appearance, null);

const versionTwoWorkspace = {
  ...workspace,
  version: 2,
};
delete versionTwoWorkspace.appearance;
const migratedVersionTwo = validateWorkspace(versionTwoWorkspace);
assert.equal(migratedVersionTwo.version, WORKSPACE_VERSION);
assert.equal(migratedVersionTwo.appearance, null);

assert.throws(
  () => validateWorkspace({ ...workspace, activeDatasetId: 'missing' }),
  /missing active flux dataset/,
);
assert.throws(
  () => validateWorkspace({
    ...workspace,
    datasets: [{ id: 'bad', name: 'Bad', reactionData: { PGK: 99 } }],
    activeDatasetId: 'bad',
  }),
  /invalid flux dataset/,
);
assert.throws(
  () => validateWorkspace({
    ...workspace,
    appearance: { ...workspace.appearance, reactionLabelSize: 0 },
  }),
  /invalid appearance settings/,
);

console.log('Workspace tests passed.');
