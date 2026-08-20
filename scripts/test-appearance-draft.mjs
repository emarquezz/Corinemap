import assert from 'node:assert/strict';
import {
  createAnimationFrameScheduler,
  mergeAppearanceDraft,
  parsePositiveAppearanceNumber,
  requireCompleteAppearanceDraft,
} from '../app/js/corinemap/appearance-draft.js';

assert.equal(parsePositiveAppearanceNumber('12'), 12);
assert.equal(parsePositiveAppearanceNumber('2.5'), 2.5);
assert.equal(parsePositiveAppearanceNumber(''), null);
assert.equal(parsePositiveAppearanceNumber('0'), null);
assert.equal(parsePositiveAppearanceNumber('-4'), null);

const base = {
  reactionLabelSize: 30,
  secondaryMetaboliteRadius: 10,
  extracellularFill: '#8254a5',
};

const whileCleared = mergeAppearanceDraft(
  base,
  { reactionLabelSize: '' },
  {},
);
assert.equal(whileCleared.appearance.reactionLabelSize, 30);
assert.deepEqual(whileCleared.invalidNumberKeys, ['reactionLabelSize']);

const firstDigit = mergeAppearanceDraft(
  whileCleared.appearance,
  { reactionLabelSize: '1' },
  {},
);
assert.equal(firstDigit.appearance.reactionLabelSize, 1);

const twoDigits = mergeAppearanceDraft(
  firstDigit.appearance,
  { reactionLabelSize: '12', secondaryMetaboliteRadius: '2.5' },
  { extracellularFill: '#654321' },
);
assert.equal(twoDigits.appearance.reactionLabelSize, 12);
assert.equal(twoDigits.appearance.secondaryMetaboliteRadius, 2.5);
assert.equal(twoDigits.appearance.extracellularFill, '#654321');
assert.deepEqual(twoDigits.invalidNumberKeys, []);

assert.throws(
  () => requireCompleteAppearanceDraft(base, { reactionLabelSize: '' }, {}),
  /positive number/,
);

let callbackCount = 0;
let nextFrame = 0;
const frames = new Map();
const scheduler = createAnimationFrameScheduler(
  () => { callbackCount += 1; },
  (callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  },
  (frame) => frames.delete(frame),
);
scheduler.schedule();
scheduler.schedule();
scheduler.schedule();
assert.equal(frames.size, 1);
const latestFrame = frames.get(nextFrame);
frames.delete(nextFrame);
latestFrame();
assert.equal(callbackCount, 1);
scheduler.schedule();
scheduler.cancel();
assert.equal(frames.size, 0);

console.log('Appearance-draft tests passed.');
