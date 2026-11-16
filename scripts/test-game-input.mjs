import test from 'node:test';import assert from 'node:assert/strict';import {load} from './test-support.mjs';
const {gameInputAllowed}=load('lib/company/game-input.ts'),base={metaKey:false,ctrlKey:false,altKey:false,isComposing:false};
test('owner movement respects browser shortcuts, composition, focus and modal controls',()=>{
 assert.equal(gameInputAllowed(base,true,false,false),true);
 for(const key of Object.keys(base))assert.equal(gameInputAllowed({...base,[key]:true},true,false,false),false,key);
 assert.equal(gameInputAllowed(base,false,false,false),false);assert.equal(gameInputAllowed(base,true,true,false),false);assert.equal(gameInputAllowed(base,true,false,true),false);
});
