import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removeCollaborator,linkCollaborators} from '../lib/collaborator-links.ts';
const state=()=>({version:2,revision:0,collaborators:[{id:'c',title:'测试甲'},{id:'other',title:'测试乙'}],projects:[{id:'p',title:'项目',collaboratorIds:['c','other'],notes:'项目记录',stages:[]}],students:[],meetings:[],tasks:[{id:'t',title:'评阅',affairsType:'协助评阅',requester:'测试甲',requesterId:'c',requesterLinkedName:'测试甲',initiatorId:'c',initiatorLinkedName:'测试甲',ownerName:'测试甲',ownerId:'c',ownerLinkedName:'测试甲',actualMinutes:90,notes:'任务记录',done:true},{id:'unrelated',title:'其他',requester:'测试乙',initiatorId:'other',initiatorLinkedName:'测试乙'}]});
test('deletion detaches links and preserves work records; repeated relinking never resurrects the profile',()=>{
 const s=state(),original=structuredClone(s);let next=removeCollaborator(s,'c');
 for(let i=0;i<3;i++)next=linkCollaborators(JSON.parse(JSON.stringify(next)));
 assert.deepEqual(next.collaborators,[s.collaborators[1]]);assert.deepEqual(next.projects[0].collaboratorIds,['other']);
 assert.equal(next.projects[0].notes,'项目记录');assert.equal(next.tasks.length,2);
 for(const key of ['requester','ownerName','notes','actualMinutes','done'])assert.deepEqual(next.tasks[0][key],s.tasks[0][key]);
 for(const key of ['requesterId','ownerId','initiatorId'])assert.equal(next.tasks[0][key],undefined);
 assert.deepEqual(next.tasks[1],s.tasks[1]);assert.deepEqual(s,original);
 assert.throws(()=>removeCollaborator(s,'missing'));
});
test('name change resumes normal linking and same-name different profiles keep their links',()=>{
 let s=removeCollaborator(state(),'c');s.tasks[0].requester='测试乙';s.tasks[0].ownerName='测试乙';s=linkCollaborators(s);
 assert.equal(s.tasks[0].requesterId,'other');assert.equal(s.tasks[0].ownerId,'other');assert.equal(s.tasks[0].requesterDetachedName,undefined);
 const d=state();d.collaborators[1].title='测试甲';d.tasks[1]={id:'other-task',title:'其他',affairsType:'协助评阅',requester:'测试甲',requesterId:'other',requesterLinkedName:'测试甲',initiatorId:'other',initiatorLinkedName:'测试甲'};
 const next=linkCollaborators(removeCollaborator(d,'c'));assert.equal(next.tasks[1].requesterId,'other');assert.equal(next.tasks[1].requesterDetachedName,undefined);
});
test('unlinked historical review names and archived profiles can be deleted without resurrection',()=>{
 const s=state();s.collaborators[0].archived=true;s.tasks=[{id:'t',title:'旧评阅',affairsType:'协助评阅',requester:'测试甲'}];
 const next=linkCollaborators(removeCollaborator(s,'c'));assert.equal(next.collaborators.length,1);assert.equal(next.tasks[0].requester,'测试甲');assert.equal(next.tasks[0].requesterId,undefined);
});
