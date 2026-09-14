import type {Item} from './desk.ts';
export function dueReminders(tasks:Item[],today:string):Item[]{
 return tasks.filter(t=>!t.done&&!t.archived&&['近期','以后'].includes(t.bucket)&&t.reminderEnabled===true&&typeof t.reminderDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.reminderDate)&&t.reminderDate<=today).sort((a,b)=>a.reminderDate.localeCompare(b.reminderDate));
}
export function validateTaskReminder(t:Item){
 if(t.reminderEnabled&&['近期','以后'].includes(t.bucket)){
  const d=t.reminderDate;
  if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw new Error('请填写有效的提醒日期');
 }
}
