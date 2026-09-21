import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyClassification, classificationOf, classificationLabel, taskCategories, workTypesFor } from '../lib/work-classification.ts';
import { completedWork } from '../lib/completed-work.ts';
import { summarizeWork, summaryText, updateWorkDetails } from '../lib/work-summary.ts';
const task = (id, fields={}) => ({id,title:id,bucket:'今天',done:true,completedOn:'2026-09-20',...fields});

test('approved category pairs reject mismatches and clear obsolete affairs membership without losing context', () => {
 assert.deepEqual(taskCategories,['科研项目','事务管理','学生指导']);
 assert.deepEqual(workTypesFor('学生指导'),['组会','论文指导','学生事务']);
 const original=task('t',{affairsType:'期刊审稿',projectId:'p',studentId:'s',meetingId:'m',reviewJournal:'J',notes:'保留笔记',actualMinutes:95});
 const updated=applyClassification(original,'科研项目','论文写作');
 assert.equal(updated.affairsType,'');assert.equal(original.affairsType,'期刊审稿');
 for(const key of ['projectId','studentId','meetingId','reviewJournal','notes','actualMinutes']) assert.equal(updated[key],original[key]);
 assert.throws(()=>applyClassification(original,'科研项目','组会'));
 assert.throws(()=>applyClassification(original,'学生指导','个别指导'));
});
test('legacy records map only unambiguous categories and remain unmodified',()=>{
 const cases=[
 [{workType:'论文写作'},'科研项目 · 论文写作'],
 [{affairsType:'期刊审稿',workType:'学术事务'},'事务管理 · 期刊审稿'],
 [{affairsType:'学生工作',workType:'日常任务'},'学生指导 · 学生事务'],
 [{affairsType:'学生工作',workType:'组会'},'学生指导 · 组会'],
 [{workType:'科研项目'},'科研项目 · 待细分'],
 [{studentId:'s'},'学生指导 · 待细分'],
 [{meetingId:'m',title:'准备会议'},'学生指导 · 待细分'],
 [{workType:'日常任务'},'待分类'],
 ];
 for(const [record,label] of cases){const before=structuredClone(record);assert.equal(classificationLabel(record),label);assert.deepEqual(record,before);}
});
test('daily weekly monthly totals partition tasks, meetings and guidance exactly once',()=>{
 const data={tasks:[task('writing', {taskCategory:'科研项目',workType:'论文写作',actualMinutes:90}),task('data',{taskCategory:'科研项目',workType:'数据分析',actualMinutes:45}),task('admin',{affairsType:'行政任务',actualMinutes:30}),task('old',{workType:'科研项目',actualMinutes:15})],meetings:[{id:'m',title:'组会',completed:true,date:'2026-09-20',actualMinutes:60}],students:[{id:'s',title:'学生',guidance:[{id:'g',date:'2026-09-20',content:'论文反馈',workType:'论文指导',actualMinutes:20},{id:'old-g',date:'2026-09-20',content:'旧记录'}]}]};
 const original=structuredClone(data),work=completedWork(data);
 for(const period of ['day','week','month']){
  const s=summarizeWork(work,period,'2026-09-20','2026-09-20');
  assert.equal(s.minutes,260);assert.equal(s.items.length,7);assert.equal(s.missingCount,1);
  assert.equal(s.groups.reduce((n,g)=>n+g.count,0),7);assert.equal(s.categoryTotals.reduce((n,g)=>n+g.minutes,0),260);
  assert.equal(s.categoryTotals.find(g=>g.name==='科研项目').minutes,150);
  assert.match(summaryText(s),/科研项目 · 论文写作 · 1小时30分/);
  assert.match(summaryText(s),/学生指导 · 组会 · 1小时/);
 }
 const guidance=work.find(w=>w.id==='old-g');
 const next=updateWorkDetails(data,guidance,undefined,'学生事务','学生指导');
 assert.equal(next.students[0].guidance[1].workType,'学生事务');
 assert.throws(()=>updateWorkDetails(data,guidance,30,'论文写作','科研项目'));
 assert.deepEqual(data,original);
});
