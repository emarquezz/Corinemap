import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_CONFIG, cloneDefaultCategories } from '../app/js/corinemap/config.js';
import { parseReactionCsv } from '../app/js/corinemap/reaction-data.js';

function csvParse(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
  const columns = headerLine.split(',').map((value) => value.trim());
  const rows = lines.map((line) => Object.fromEntries(
    line.split(',').map((value, index) => [columns[index], value.trim()]),
  ));
  rows.columns = columns;
  return rows;
}

const expectedCounts = new Map([
  ['Mannitol', 361],
  ['Xylose', 348],
]);

for (const definition of APP_CONFIG.preloadedReactionDatasets) {
  const csvPath = new URL(`../app/${definition.url.replace(/^\.\//, '')}`, import.meta.url);
  const reactionData = parseReactionCsv(
    readFileSync(csvPath, 'utf8'),
    cloneDefaultCategories(),
    csvParse,
  );
  assert.equal(Object.keys(reactionData).length, expectedCounts.get(definition.name));
}

console.log('Preloaded flux-data tests passed.');
