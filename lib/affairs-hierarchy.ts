import type { Item, State } from './desk';
import { classificationOf } from './work-classification.ts';

export const affairKind = (task: Item): string => classificationOf(task).taskCategory === '事务管理' ? classificationOf(task).workType : '';
export const partyName = (task: Item, kind: string): string => (kind === '期刊审稿' ? task.reviewJournal || '' : task.requester || '').trim();
export const counts = (tasks: Item[]) => ({ total: tasks.length, pending: tasks.filter(t => !t.done).length, done: tasks.filter(t => t.done).length });
export function affairParties(tasks: Item[], projects: Item[], kind: string) {
  const groups = new Map<string, Item[]>();
  for (const task of tasks) {
    const key = partyName(task, kind);
    groups.set(key, [...(groups.get(key) || []), task]);
  }
  if (kind === '行政任务') for (const project of projects) {
    const key = (project.requester || '').trim();
    if (!groups.has(key)) groups.set(key, []);
  }
  return [...groups].map(([name, rows]) => ({ name, ...counts(rows), projectCount: projects.filter(p => (p.requester || '').trim() === name).length }))
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, 'zh-CN'));
}
export function assignAffairProject(data: State, taskId: string, projectId: string): State {
  const next = structuredClone(data), task = next.tasks.find(t => t.id === taskId);
  if (!task || affairKind(task) !== '行政任务') throw new Error('该行政任务已变更，请刷新后重试');
  const project = next.affairProjects?.find(p => p.id === projectId);
  if (projectId && !project) throw new Error('事务项目已不存在，请重新选择');
  task.affairProjectId = projectId;
  if (project) task.requester = project.requester;
  return next;
}
export function saveAffairProject(data: State, input: Item): State {
  const project = { ...input, title: input.title.trim(), requester: (input.requester || '').trim() };
  if (!project.title || !project.requester) throw new Error('请填写发起人 / 部门和事务项目名称');
  if (data.affairProjects?.some(p => p.id !== project.id && p.title.trim() === project.title && p.requester.trim() === project.requester)) throw new Error('该发起方已有同名事务项目');
  const next = structuredClone(data), projects = next.affairProjects || [];
  next.affairProjects = projects.some(p => p.id === project.id) ? projects.map(p => p.id === project.id ? project : p) : [...projects, project];
  for (const task of next.tasks) if (task.affairProjectId === project.id) task.requester = project.requester;
  return next;
}
export function deleteAffairProject(data: State, id: string): State {
  if (!data.affairProjects?.some(p => p.id === id)) throw new Error('事务项目已不存在，请刷新后重试');
  const next = structuredClone(data);
  next.affairProjects = next.affairProjects!.filter(p => p.id !== id);
  for (const task of next.tasks) if (task.affairProjectId === id) task.affairProjectId = '';
  return next;
}
