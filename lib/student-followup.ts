import type { Item } from './desk';
import { today } from './desk.ts';
import { validDate } from './work-summary.ts';

export function latestGuidance(student: Item, now = today()): Item | undefined {
  return (student.guidance || []).reduce((latest: Item | undefined, note: Item) =>
    validDate(note.date) && note.date <= now && (!latest || note.date >= latest.date) ? note : latest, undefined);
}

// Historical forms copied the old reminder back into the next-date field.
// Resolve those reminders for display without rewriting the original records.
export function pendingFollowup(student: Item, now = today()): string {
  const date = student.followup || '';
  if (!validDate(date)) return '';
  if (student.followupPending === true) return date;
  const latest = latestGuidance(student, now);
  return latest && latest.date >= date ? '' : date;
}
export function defaultNextFollowup(student: Item, now = today()): string {
  const date = pendingFollowup(student, now);
  return date > now ? date : '';
}
export function guidanceSnapshot(student: Item): string {
  return JSON.stringify([student.followup || '', student.followupPending, student.feedback || '', student.guidance || []]);
}
export function guidanceUpdate(student: Item, input: Item, snapshot: string, now = today()): Partial<Item> {
  if (guidanceSnapshot(student) !== snapshot) throw new Error('该学生的指导记录或跟进安排已更新，请关闭后重新打开');
  if (!validDate(input.date) || input.date > now) throw new Error('指导日期应为已发生的有效日期');
  if (!input.content?.trim()) throw new Error('请填写本次指导内容');
  if (input.followup && (!validDate(input.followup) || input.followup <= input.date)) throw new Error('下次跟进日期应晚于本次指导日期，也可以留空');
  const note: Item = { ...input, content: input.content.trim(), followup: input.followup || '', feedback: input.feedback || '' };
  const records: Item[] = student.guidance || [];
  const old = records.find(r => r.id === note.id);
  const guidance = old ? records.map(r => r.id === note.id ? note : r) : [...records, note];
  const fields: Partial<Item> = { guidance };
  // Backfilled or edited older notes must not reset a newer reminder or feedback.
  if (latestGuidance({ ...student, guidance }, now)?.id === note.id) {
    if (!old || old.date !== note.date || old.followup !== note.followup) {
      fields.followup = note.followup;
      fields.followupPending = !!note.followup;
    }
    if (note.feedback.trim() || (old && student.feedback === old.feedback)) fields.feedback = note.feedback;
  }
  return fields;
}
