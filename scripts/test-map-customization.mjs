import assert from 'node:assert/strict';
import { cloneDefaultAppearance } from '../app/js/corinemap/config.js';
import {
  getActiveAppearance,
  resolveMetaboliteAppearance,
} from '../app/js/corinemap/map-customization.js';

const appearance = {
  ...cloneDefaultAppearance(),
  primaryMetaboliteLabelSize: 61,
  secondaryMetaboliteLabelSize: 31,
  highlightedMetaboliteLabelSize: 81,
  extracellularMetaboliteLabelSize: 71,
  primaryMetaboliteRadius: 21,
  secondaryMetaboliteRadius: 7,
  highlightedMetaboliteRadius: 29,
  extracellularMetaboliteRadius: 25,
};
const highlighted = new Set(['mnl_e']);

const secondaryExtracellular = resolveMetaboliteAppearance(
  { bigg_id: 'h_e', node_is_primary: false },
  highlighted,
  appearance,
);
assert.equal(secondaryExtracellular.radius, 7);
assert.equal(secondaryExtracellular.labelSize, 31);
assert.equal(secondaryExtracellular.fill, appearance.extracellularFill);
assert.equal(secondaryExtracellular.stroke, appearance.extracellularStroke);

const primaryExtracellular = resolveMetaboliteAppearance(
  { bigg_id: 'fum_e', node_is_primary: true },
  highlighted,
  appearance,
);
assert.equal(primaryExtracellular.radius, 25);
assert.equal(primaryExtracellular.labelSize, 71);

const primaryHighlighted = resolveMetaboliteAppearance(
  { bigg_id: 'mnl_e', node_is_primary: true },
  highlighted,
  appearance,
);
assert.equal(primaryHighlighted.radius, 29);
assert.equal(primaryHighlighted.labelSize, 81);
assert.equal(primaryHighlighted.fill, appearance.highlightedFill);

const secondaryHighlighted = resolveMetaboliteAppearance(
  { bigg_id: 'mnl_e', node_is_primary: false },
  highlighted,
  appearance,
);
assert.equal(secondaryHighlighted.radius, 7);
assert.equal(secondaryHighlighted.labelSize, 31);
assert.equal(secondaryHighlighted.fill, appearance.highlightedFill);

const committedAppearance = { reactionLabelSize: 30 };
const previewAppearance = { reactionLabelSize: 54 };
assert.equal(getActiveAppearance({
  appearance: committedAppearance,
  appearancePreview: null,
}), committedAppearance);
assert.equal(getActiveAppearance({
  appearance: committedAppearance,
  appearancePreview: previewAppearance,
}), previewAppearance);

console.log('Map-customization tests passed.');
