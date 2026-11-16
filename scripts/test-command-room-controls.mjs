import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('components/command-room/world.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(source, { exports, require: () => ({ COLS: 30, ROWS: 19, aStarPath: () => [] }) });
const { createTapGesture, createMovementControls } = exports;

test('mobile reproduced vertical swipe never selects or moves; a stationary tap does', () => {
  const gesture = createTapGesture();
  gesture.begin(1, 280, 245); gesture.move(1, 280, 170);
  assert.equal(gesture.finish(1, 280, 170), false);
  gesture.begin(2, 280, 245);
  assert.equal(gesture.finish(2, 284, 249), true);
});
test('out-and-back swipe, cancellation and a second finger never become taps', () => {
  const gesture = createTapGesture();
  gesture.begin(1, 100, 100); gesture.move(1, 100, 125);
  assert.equal(gesture.finish(1, 100, 100), false);
  gesture.begin(2, 100, 100); gesture.cancel();
  assert.equal(gesture.finish(2, 100, 100), false);
  gesture.begin(3, 100, 100); gesture.begin(4, 100, 100);
  assert.equal(gesture.finish(4, 100, 100), false);
  assert.equal(gesture.finish(3, 100, 100), false);
});
test('hold release outside, pointer cancellation and lost capture stop their input', () => {
  const controls = createMovementControls();
  controls.press('pointer:11', 'right'); assert.equal(controls.vector().x, 1);
  controls.release('pointer:11'); assert.equal(controls.vector().x, 0);
  controls.press('pointer:12', 'up'); controls.release('pointer:12');
  assert.equal(controls.vector().y, 0);
  controls.press('pointer:13', 'left'); controls.release('pointer:13');
  assert.equal(controls.vector().x, 0);
});
test('blur and hidden-tab clear all holds while individual releases preserve other inputs', () => {
  const controls = createMovementControls();
  controls.press('key:arrowright', 'right'); controls.press('pointer:1', 'right');
  controls.release('pointer:1'); assert.equal(controls.vector().x, 1);
  controls.press('pointer:2', 'up'); controls.clear();
  assert.equal(controls.vector().x, 0); assert.equal(controls.vector().y, 0);
});
