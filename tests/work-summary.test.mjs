import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodBounds, summarizeWork, parseMinutes, parseHours, hoursInput, updateWorkDetails, summaryText } from '../lib/work-summary.ts';
import { completedWork } from '../lib/completed-work.ts';
import { zipFiles } from '../lib/share-zip.ts';
const record=(id,date,minutes)=>({id,workKey:`task:${id}`,source:'tasks',sourceId:id,title:`任务${id}`,done:true,completedOn:date,actualMinutes:minutes});
test('calendar boundaries cover Sunday, cross-year weeks and leap month',()=>{
 assert.deepEqual(periodBounds('week','2027-01-03'),{start:'2026-12-28',end:'2027-01-03'});
 assert.deepEqual(periodBounds('month','2024-02-29'),{start:'2024-02-01',end:'2024-02-29'});
 assert.throws(()=>periodBounds('day','2026-02-30'));
});
test('completion dates determine coverage; missing time is not inferred; zero is valid',()=>{
 const work=[record('a','2026-09-17',60),record('b','2026-09-17',undefined),record('c','2026-09-18',40),record('d','',20),record('e','2026-09-13',90)];
 const s=summarizeWork(work,'week','2026-09-17','2026-09-17');
 assert.equal(s.items.length,2);assert.equal(s.minutes,60);assert.equal(s.showChart,false);assert.equal(s.undatedCount,1);assert.equal(s.effectiveEnd,'2026-09-17');
 const zero=summarizeWork([record('z','2026-09-17',0)],'day','2026-09-17','2026-09-17');
 assert.equal(zero.complete,true);assert.equal(zero.showChart,false);assert.equal(zero.timedCount,1);
 work[1].actualMinutes=30;assert.equal(summarizeWork(work,'day','2026-09-17','2026-09-17').showChart,true);
 assert.equal(parseMinutes(''),undefined);assert.equal(parseMinutes('0'),0);
 for(const bad of ['-1','1.5','NaN','Infinity','10000001'])assert.throws(()=>parseMinutes(bad));
 const day=summarizeWork(work,'day','2026-09-17','2026-09-17');assert.match(summaryText(day),/任务a/);assert.doesNotMatch(summaryText(s),/任务c/);
});
test('editing duration reaches the original guidance, meeting or task without mutating input',()=>{
 const data={tasks:[record('t','2026-09-17',15)],students:[{id:'s',title:'学生',guidance:[{id:'g',date:'2026-09-17',content:'反馈',actualMinutes:20}]}],meetings:[{id:'m',title:'组会',completed:true,date:'2026-09-17',actualMinutes:30}]};
 const rows=completedWork(data);assert.equal(rows.length,3);assert.equal(summarizeWork(rows,'day','2026-09-17','2026-09-17').minutes,65);
 const next=updateWorkDetails(data,rows.find(w=>w.source==='students'),45);
 assert.equal(next.students[0].guidance[0].actualMinutes,45);assert.equal(data.students[0].guidance[0].actualMinutes,20);assert.equal(next.students[0].guidance[0].content,'反馈');
 const task=updateWorkDetails(next,rows.find(w=>w.source==='tasks'),undefined,'论文写作');assert.equal(task.tasks[0].workType,'论文写作');assert.equal(task.tasks[0].actualMinutes,undefined);
 const meeting=updateWorkDetails(task,rows.find(w=>w.source==='meetings'),0);assert.equal(meeting.meetings[0].actualMinutes,0);
 assert.throws(()=>updateWorkDetails({...data,tasks:[]},rows.find(w=>w.source==='tasks'),30));
});
test('ZIP keeps UTF-8 names and original bytes',()=>{
 const z=zipFiles([{name:'分享图.png',bytes:new Uint8Array([1,2,3])}]);const v=new DataView(z.buffer);
 assert.equal(v.getUint32(0,true),0x04034b50);assert.equal(v.getUint16(6,true),0x800);
 const n=v.getUint16(26,true);assert.equal(new TextDecoder().decode(z.slice(30,30+n)),'分享图.png');assert.deepEqual([...z.slice(30+n,33+n)],[1,2,3]);
 assert.equal(v.getUint32(z.length-22,true),0x06054b50);
});

test('decimal hour inputs convert safely and existing minute records survive a round trip',()=>{
 assert.equal(parseHours('1.5'),90);assert.equal(parseHours('0.5'),30);assert.equal(parseHours('0.25'),15);assert.equal(parseHours('0'),0);assert.equal(parseHours(''),undefined);
 for (const minutes of [1,5,30,45,60,80,90,125,10000000]) assert.equal(parseHours(hoursInput(minutes)),minutes);
 for (const invalid of ['-1','Infinity','NaN','166667']) assert.throws(()=>parseHours(invalid));
});

test('weekly and monthly text show category counts and only recorded duration, never individual titles',()=>{
 const work=[{...record('a','2026-09-17',90),workType:'论文写作'},{...record('b','2026-09-17',undefined),workType:'论文写作'},{...record('c','2026-09-17',undefined),workType:'学生指导'},{...record('d','2026-09-17',0),workType:'组会'}];
 for(const period of ['week','month']) {
  const s=summarizeWork(work,period,'2026-09-17','2026-09-17'), text=summaryText(s);
  assert.match(text,/科研项目 · 论文写作 · 已记录 1小时30分 · 2 项/);assert.match(text,/学生指导 · 待细分 · 1 项/);assert.match(text,/学生指导 · 组会 · 0分钟 · 1 项/);
  assert.doesNotMatch(text,/任务[a-d]|未填写|未计时/);assert.equal(s.groups.reduce((n,g)=>n+g.count,0),4);
  const none=summaryText(summarizeWork(work.map(w=>({...w,actualMinutes:undefined})),period,'2026-09-17','2026-09-17'));
  assert.doesNotMatch(none,/耗时|小时|分钟/);
 }
});
