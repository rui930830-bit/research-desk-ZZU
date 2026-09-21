import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affairParties,assignAffairProject,saveAffairProject,deleteAffairProject} from '../lib/affairs-hierarchy.ts';
import {applyClassification} from '../lib/work-classification.ts';
const state=()=>({projects:[{id:'research',title:'科研'}],tasks:[{id:'a',title:'任务',affairsType:'行政任务',requester:'甲',done:true,actualMinutes:60},{id:'b',title:'另一任务',affairsType:'行政任务',requester:''}],affairProjects:[]});
test('administrative projects organize tasks without changing research or time records',()=>{
 const original=state();let s=saveAffairProject(original,{id:'p',title:' 项目 ',requester:'甲'});
 s=assignAffairProject(s,'a','p');assert.deepEqual(s.projects,original.projects);assert.equal(s.tasks[0].actualMinutes,60);assert.equal(original.tasks[0].affairProjectId,undefined);
 s=saveAffairProject(s,{id:'p',title:'更名',requester:'乙'});assert.equal(s.tasks[0].requester,'乙');
 s=deleteAffairProject(s,'p');assert.equal(s.tasks.length,2);assert.equal(s.tasks[0].affairProjectId,'');assert.equal(s.tasks[0].done,true);
 assert.throws(()=>assignAffairProject(s,'a','missing'));
});
test('completed and unnamed groups remain navigable, empty projects have a group',()=>{
 const s=state();const groups=affairParties(s.tasks,[{id:'p',title:'项目',requester:'乙'}],'行政任务');
 assert.equal(groups.find(g=>g.name==='甲').done,1);assert.equal(groups.find(g=>g.name==='').total,1);assert.equal(groups.find(g=>g.name==='乙').projectCount,1);
 assert.equal(affairParties([{reviewJournal:'期刊',requester:'编辑'}],[],'期刊审稿')[0].name,'期刊');
});
test('category changes detach administrative project; duplicate project names within owner rejected',()=>{
 const s=saveAffairProject(state(),{id:'p',title:'项目',requester:'甲'});
 assert.throws(()=>saveAffairProject(s,{id:'p2',title:'项目',requester:'甲'}));
 assert.equal(applyClassification({affairProjectId:'p'},'科研项目','论文写作').affairProjectId,'');
});
