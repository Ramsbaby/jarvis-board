import test from 'node:test';import assert from'node:assert/strict';import{load}from'./test-support.mjs';
const {movementHeading}=load('lib/company/animation.ts');
test('stopping after a side step preserves heading rather than snapping toward the camera',()=>{const turned=movementHeading(Math.PI,1,0,.05);assert.notEqual(turned,Math.PI);assert.equal(movementHeading(turned,0,0,.05),turned);assert.equal(movementHeading(turned,1,0,0),turned);});
test('steering crosses the angle seam on the shortest arc',()=>{const start=Math.PI-.01,next=movementHeading(start,.01,1,1/60);assert.ok(Math.abs(next-start)<.02);});
test('30Hz and 60Hz steering converge to the same pose for the same elapsed time',()=>{let a=0,b=0;for(let i=0;i<15;i++)a=movementHeading(a,1,0,1/30);for(let i=0;i<30;i++)b=movementHeading(b,1,0,1/60);assert.ok(Math.abs(a-b)<1e-10);assert.ok(Math.abs(a+Math.PI/2)<.001);});
