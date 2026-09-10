import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reorderVisible} from '../lib/reorder.ts';
test('filtered reorder retains hidden slots and original content',()=>{const rows=[{id:'a',notes:'A'},{id:'hidden',notes:'H'},{id:'b',notes:'B'},{id:'c',notes:'C'}];const copy=structuredClone(rows);const moved=reorderVisible(rows,['a','b','c'],'c','a');assert.deepEqual(moved.map(x=>x.id),['c','hidden','a','b']);assert.deepEqual(rows,copy);assert.equal(moved[1],rows[1]);for(const row of rows)assert.equal(moved.find(x=>x.id===row.id),row)});
test('moves downward, rejects stale ids, and handles no movement',()=>{const rows=[{id:'a'},{id:'b'},{id:'c'}];assert.deepEqual(reorderVisible(rows,['a','b','c'],'a','c').map(x=>x.id),['b','c','a']);assert.equal(reorderVisible(rows,['a'],'a','a'),rows);assert.throws(()=>reorderVisible(rows,['a','gone'],'a','gone'));assert.throws(()=>reorderVisible(rows,['a','a'],'a','a'))});
