import taxonomy from './work-types.json' with { type: 'json' };
import type { Item } from './desk';

export const taskCategories = Object.keys(taxonomy);
export const workTypesFor = (category: string): string[] => taxonomy[category as keyof typeof taxonomy] || [];
export const workTypes = Object.values(taxonomy).flat();
export const categoryFor = (type: string) => taskCategories.find(c => workTypesFor(c).includes(type)) || '';
export type WorkClassification = { taskCategory: string; workType: string };
export function validClassification(category: string, type: string) {
  return taskCategories.includes(category) && workTypesFor(category).includes(type);
}
// Read historical records conservatively. Do not rewrite data or infer a subtype from a title.
export function classificationOf(record: Partial<Item>, source = 'tasks'): WorkClassification {
  if (source === 'meetings') return { taskCategory: '学生指导', workType: '组会' };
  if (source === 'students') return { taskCategory: '学生指导', workType: workTypesFor('学生指导').includes(record.workType) ? record.workType : '' };
  if (taskCategories.includes(record.taskCategory)) return {
    taskCategory: record.taskCategory,
    workType: validClassification(record.taskCategory, record.workType) ? record.workType : '',
  };
  const explicit = categoryFor(record.workType);
  if (explicit) return { taskCategory: explicit, workType: record.workType };
  if (workTypesFor('事务管理').includes(record.affairsType)) return { taskCategory: '事务管理', workType: record.affairsType };
  if (record.affairsType === '学生工作') return { taskCategory: '学生指导', workType: '学生事务' };
  if (record.workType === '科研项目') return { taskCategory: '科研项目', workType: '' };
  if (record.workType === '学生指导') return { taskCategory: '学生指导', workType: '' };
  if (record.workType === '学术事务') return { taskCategory: '事务管理', workType: '' };
  if (record.meetingId) return { taskCategory: '学生指导', workType: '' };
  if (record.studentId) return { taskCategory: '学生指导', workType: '' };
  if (record.projectId) return { taskCategory: '科研项目', workType: '' };
  return { taskCategory: '', workType: '' };
}
export function classificationLabel(record: Partial<Item>, source = 'tasks') {
  const c = classificationOf(record, source);
  return c.taskCategory ? `${c.taskCategory} · ${c.workType || '待细分'}` : '待分类';
}
export function applyClassification<T extends Partial<Item>>(record: T, category: string, type: string): T {
  if (!validClassification(category, type)) throw new Error('请选择任务类别及对应的工作类型');
  return { ...record, taskCategory: category, workType: type,
    // Keep the older affairs integrations in sync while retaining all review metadata.
    affairsType: category === '事务管理' ? type : '',
    ...(record.affairProjectId && !(category === '事务管理' && type === '行政任务') ? { affairProjectId: '' } : {}),
  };
}
