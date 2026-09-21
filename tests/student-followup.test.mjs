import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingFollowup, latestGuidance, defaultNextFollowup, guidanceSnapshot, guidanceUpdate } from '../lib/student-followup.ts';
const now='2026-09-20';
const note=(id,date,followup='',extra={})=>({id,title:'',date,content:'已指导',feedback:'',followup,workType:'论文指导',...extra});
const student=(extra={})=>({id:'s',title:'测试学生',followup:'2026-09-14',feedback:'保留反馈',guidance:[],...extra});
const save=(s,n)=>({...s,...guidanceUpdate(s,n,guidanceSnapshot(s),now)});

test('legacy completed guidance resolves the old overdue reminder without rewriting history',()=>{
 const s=student({guidance:[note('g','2026-09-15','2026-09-14')]});const before=structuredClone(s);
 assert.equal(pendingFollowup(s,now),'');assert.equal(latestGuidance(s,now).date,'2026-09-15');assert.equal(defaultNextFollowup(s,now),'');assert.deepEqual(s,before);
 assert.equal(pendingFollowup(student({guidance:[note('old','2026-09-13')]}),now),'2026-09-14');
 assert.equal(pendingFollowup(student({guidance:[note('future','2026-09-21')]}),now),'2026-09-14');
 assert.equal(pendingFollowup(student({followup:'2026-09-30',guidance:[note('g','2026-09-15','2026-09-30')]}),now),'2026-09-30');
});
test('completing without another date clears pending reminders and preserves duration, feedback and history',()=>{
 const s=student({followupPending:true,guidance:[note('old','2026-09-01')]}),before=structuredClone(s);
 const next=save(s,note('new',now,'',{actualMinutes:90}));
 assert.equal(next.followup,'');assert.equal(next.followupPending,false);assert.equal(pendingFollowup(next,now),'');
 assert.equal(next.guidance.length,2);assert.equal(next.guidance[1].actualMinutes,90);assert.equal(next.feedback,'保留反馈');assert.deepEqual(s,before);
 const scheduled=save(s,note('new',now,'2026-09-25'));assert.equal(pendingFollowup(scheduled,now),'2026-09-25');assert.equal(defaultNextFollowup(scheduled,now),'2026-09-25');
});
test('editing or backfilling older records cannot restore reminders or overwrite current feedback',()=>{
 const s=student({followup:'2026-09-30',followupPending:true,feedback:'最新反馈',guidance:[note('old','2026-09-10','2026-09-14'),note('latest','2026-09-15','2026-09-30')]});
 for(const n of [note('old','2026-09-10','2026-09-16',{feedback:'旧反馈修正'}),note('backfill','2026-09-12','',{feedback:'补记旧反馈'})]){
  const next=save(s,n);assert.equal(next.followup,'2026-09-30');assert.equal(next.feedback,'最新反馈');assert.equal(next.followupPending,true);
 }
 const edited=save(s,note('latest','2026-09-15','2026-09-30',{content:'修正内容'}));assert.equal(edited.followup,'2026-09-30');
 const cleared=save(s,note('latest','2026-09-15',''));assert.equal(cleared.followup,'');
});
test('explicit replanning overrides historical completion, but a later completion resolves it',()=>{
 const s=student({followupPending:true,guidance:[note('g','2026-09-15')]});
 assert.equal(pendingFollowup(s,now),'2026-09-14');
 const next=save(s,note('new',now));assert.equal(pendingFollowup(next,now),'');
 // Merely correcting the latest note content must preserve a separately set reminder.
 const edited=save(s,note('g','2026-09-15','',{content:'修正笔记'}));assert.equal(pendingFollowup(edited,now),'2026-09-14');
});
test('stale forms and invalid dates cannot clear or overwrite active reminders',()=>{
 const s=student(),snapshot=guidanceSnapshot(s);
 assert.throws(()=>guidanceUpdate({...s,guidance:[note('other','2026-09-19')]},note('new',now),snapshot,now),/已更新/);
 for(const n of [note('g','2026-09-21'),note('g','2026-02-30'),note('g',now,'2026-09-19'),note('g',now,now),note('g',now,'',{content:' '})])assert.throws(()=>save(s,n));
});
