import { applyClassification, categoryFor, classificationOf, classificationLabel, taskCategories, workTypes, workTypesFor, validClassification } from './work-classification.ts';
import type { Item, State } from './desk';

export type SummaryPeriod = 'day' | 'week' | 'month';
export { workTypes };
export function validMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10000000;
}
export function parseMinutes(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  if (!validMinutes(number)) throw new Error('耗时请填写非负整数分钟');
  return number;
}
// Keep existing stored minutes intact; the editor accepts decimal hours.
export function hoursInput(minutes: unknown): string {
  return validMinutes(minutes) ? String(minutes / 60) : '';
}
export function parseHours(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const hours = Number(value), minutes = Math.round(hours * 60);
  if (!Number.isFinite(hours) || hours < 0 || hours > 10000000 / 60 || !validMinutes(minutes)) throw new Error('耗时请填写非负小时数，可使用小数');
  return minutes;
}
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  return y >= 1000 && localDate(new Date(y, m - 1, d, 12)) === value;
}
export function periodBounds(period: SummaryPeriod, anchor: string) {
  if (!validDate(anchor)) throw new Error('请选择有效日期');
  const [y, m, d] = anchor.split('-').map(Number);
  const start = new Date(y, m - 1, d, 12), end = new Date(start);
  if (period === 'week') {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    end.setTime(start.getTime()); end.setDate(end.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1); end.setMonth(end.getMonth() + 1, 0);
  }
  return { start: localDate(start), end: localDate(end) };
}
export function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}小时${m ? `${m}分` : ''}` : `${m}分钟`;
}
export function summarizeWork(work: Item[], period: SummaryPeriod, anchor: string, now: string) {
  const bounds = periodBounds(period, anchor);
  const end = bounds.end < now ? bounds.end : now;
  const items = work.filter(w => validDate(w.completedOn) && w.completedOn >= bounds.start && w.completedOn <= end)
    .map((w): Item => ({ ...w, ...classificationOf(w, w.source), workLabel: classificationLabel(w, w.source) }))
    .sort((a, b) => a.completedOn.localeCompare(b.completedOn) || String(a.workKey).localeCompare(String(b.workKey)));
  const timed = items.filter(w => validMinutes(w.actualMinutes));
  const minutes = timed.reduce((sum, w) => sum + w.actualMinutes, 0);
  const labels = taskCategories.flatMap(category => [...workTypesFor(category), '待细分'].map(type => `${category} · ${type}`)).concat('待分类');
  const groups = labels.map(name => {
    const rows = items.filter(w => w.workLabel === name);
    return { name, count: rows.length, timedCount: rows.filter(w => validMinutes(w.actualMinutes)).length, minutes: rows.reduce((sum, w) => sum + (validMinutes(w.actualMinutes) ? w.actualMinutes : 0), 0) };
  }).filter(g => g.count > 0);
  const categoryTotals = [...taskCategories, '待分类'].map(name => {
    const rows = items.filter(w => (w.taskCategory || '待分类') === name);
    return { name, count: rows.length, timedCount: rows.filter(w => validMinutes(w.actualMinutes)).length, minutes: rows.reduce((sum, w) => sum + (validMinutes(w.actualMinutes) ? w.actualMinutes : 0), 0) };
  }).filter(g => g.count > 0);
  const complete = items.length > 0 && timed.length === items.length;
  return { ...bounds, effectiveEnd: end, period, anchor, currentDay: now, items, groups, categoryTotals, minutes, timedCount: timed.length,
    missingCount: items.length - timed.length, complete, showChart: complete && minutes > 0,
    days: new Set(items.map(w => w.completedOn)).size,
    undatedCount: work.filter(w => !validDate(w.completedOn)).length };
}
export type WorkSummaryData = ReturnType<typeof summarizeWork>;
export function groupSummary(g: WorkSummaryData['groups'][number]) {
  return `${g.timedCount ? `${g.timedCount < g.count ? '已记录 ' : ''}${formatMinutes(g.minutes)} · ` : ''}${g.count} 项`;
}
export function summaryText(s: WorkSummaryData) {
  const title = { day: '每日工作总结', week: '每周工作总结', month: '月度工作总结' }[s.period];
  const range = s.period === 'day' ? s.anchor : `${s.start} 至 ${s.effectiveEnd}`;
  if (s.period !== 'day') return [title, range, `已完成 ${s.items.length} 项${s.timedCount ? ` · ${s.complete ? '总耗时' : '已记录耗时'} ${formatMinutes(s.minutes)}` : ''}`, '', ...s.groups.map(g => `${g.name} · ${groupSummary(g)}`)].join('\n');
  const timing = s.timedCount ? `${s.complete ? '记录总耗时' : '已记录耗时'}：${formatMinutes(s.minutes)}${s.missingCount ? `（另 ${s.missingCount} 项未填写）` : ''}` : '耗时未填写';
  return [title, range, `已完成 ${s.items.length} 项，涉及 ${s.days} 天。${timing}。`, '',
    ...s.groups.flatMap(g => [`${g.name} · ${groupSummary(g)}`, ...s.items.filter(w => w.workLabel === g.name)
      .map(w => `- ${w.completedOn} ${w.title}${validMinutes(w.actualMinutes) ? `（${formatMinutes(w.actualMinutes)}）` : ''}`), ''])].join('\n');
}
export function updateWorkDetails(data: State, work: Item, minutes: number | undefined, type?: string, category?: string): State {
  if (minutes !== undefined && !validMinutes(minutes)) throw new Error('耗时请填写非负整数分钟');
  if (type !== undefined && !validClassification(category || categoryFor(type), type)) throw new Error('请选择任务类别及对应的工作类型');
  const next = structuredClone(data);
  let record: Item | undefined;
  if (work.source === 'tasks') record = next.tasks.find(t => t.id === work.sourceId && t.done);
  else if (work.source === 'meetings') record = next.meetings.find(m => m.id === work.sourceId && m.completed);
  else if (work.source === 'students') record = next.students.find(s => s.id === work.sourceId)?.guidance?.find((n: Item) => n.id === work.id);
  if (!record) throw new Error('记录已更改，请刷新后再试');
  if (minutes === undefined) delete record.actualMinutes; else record.actualMinutes = minutes;
  if (type !== undefined) {
    const targetCategory = category || categoryFor(type);
    if (work.source === 'tasks') Object.assign(record, applyClassification(record, targetCategory, type));
    else if (work.source === 'students') {
      if (targetCategory !== '学生指导') throw new Error('指导记录请选择学生指导下的工作类型');
      record.workType = type;
    } else if (type !== '组会' || targetCategory !== '学生指导') throw new Error('组会记录的分类为学生指导 · 组会');
  }
  return next;
}
