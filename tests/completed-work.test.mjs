import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedWork } from '../lib/completed-work.ts';
test('completed work includes historical guidance and meetings without creating tasks', () => {
 const data = {tasks: [{id:'t',title:'任务',done:true,completedOn:'2026-09-09',affairsType:'学生工作',studentId:'s'},{id:'pending',done:false}], students:[{id:'s',title:'学生',guidance:[{id:'g',date:'2026-09-09',content:'讨论论文'},{id:'old',date:'2026-09-08'}]}], meetings:[{id:'m',title:'组会',completed:true,date:'2026-09-09'},{id:'next',completed:false,date:'2026-09-09'},{id:'undated',completed:true,date:''}]};
 const original=structuredClone(data); const all=completedWork(data);
 assert.equal(all.filter(w=>w.completedOn==='2026-09-09').length,3);
 assert.equal(all.filter(w=>w.source==='tasks').length,1);
 assert.equal(all.filter(w=>w.source==='students').length,2);
 assert.equal(new Set(all.map(w=>w.workKey)).size,all.length);
 assert.deepEqual(data,original);
 data.students[0].guidance[0].date='2026-09-08';data.meetings[0].completed=false;
 assert.equal(completedWork(data).filter(w=>w.completedOn==='2026-09-09').length,1);
});
