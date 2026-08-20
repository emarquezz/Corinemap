import assert from 'node:assert/strict';
import { isolateMapKeyboardShortcuts } from '../app/js/corinemap/ui.js';

const listeners = new Map();
const container = {
  addEventListener(eventName, listener) {
    listeners.set(eventName, listener);
  },
};

isolateMapKeyboardShortcuts(container);
assert.deepEqual([...listeners.keys()], ['keydown', 'keypress', 'keyup']);

for (const eventName of ['keydown', 'keypress', 'keyup']) {
  let propagationStopped = false;
  let defaultPrevented = false;
  listeners.get(eventName)({
    stopPropagation() {
      propagationStopped = true;
    },
    preventDefault() {
      defaultPrevented = true;
    },
  });
  assert.equal(propagationStopped, true);
  assert.equal(defaultPrevented, false);
}

console.log('UI keyboard-guard tests passed.');
