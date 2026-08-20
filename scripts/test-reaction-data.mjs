import assert from 'node:assert/strict';
import {
  parseReactionCsv,
  resolveCategoryValue,
} from '../app/js/corinemap/reaction-data.js';
import { cloneDefaultCategories } from '../app/js/corinemap/config.js';

function csvParse(csvText) {
  const [headerLine, ...lines] = csvText.trim().split(/\r?\n/);
  const columns = headerLine.split(',').map((value) => value.trim());
  const rows = lines.map((line) => Object.fromEntries(
    line.split(',').map((value, index) => [columns[index], value.trim()]),
  ));
  rows.columns = columns;
  return rows;
}

const categories = cloneDefaultCategories();

assert.deepEqual(
  categories.filter((category) => category.visible).map((category) => category.value),
  [0, 1, 2],
);

assert.equal(resolveCategoryValue('2', categories), 2);
assert.equal(resolveCategoryValue('increased expression', categories), 2);
assert.equal(resolveCategoryValue('unknown', categories), null);

assert.deepEqual(
  parseReactionCsv(
    'reaction_id,category\nPGK,Increased expression\nGND,1',
    categories,
    csvParse,
  ),
  { PGK: 2, GND: 1 },
);

assert.throws(
  () => parseReactionCsv('reaction_id,category\nPGK,missing', categories, csvParse),
  /unknown category/,
);

console.log('Reaction-data tests passed.');
