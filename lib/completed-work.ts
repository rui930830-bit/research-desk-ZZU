import type { Item, State } from './desk';

// References to a student/meeting do not mean a task is the same activity.
export function completedWork(data: State): Item[] {
  const tasks = data.tasks
    .filter((t) => t.done)
    .map((t) => ({
      ...t,
      workKey: `task:${t.id}`,
      source: 'tasks',
      sourceId: t.id,
    }));
  const guidance = data.students.flatMap((student) =>
    (student.guidance || []).map((note: Item) => ({
      id: note.id,
      workKey: `guidance:${student.id}:${note.id}`,
      title: `指导学生 · ${student.title}`,
      summary: note.content || '',
      completedOn: note.date || '',
      done: true,
      source: 'students',
      sourceId: student.id,
      workType: '学生指导',
    })),
  );
  const meetings = data.meetings
    .filter((m) => m.completed)
    .map((m) => ({
      id: m.id,
      workKey: `meeting:${m.id}`,
      title: m.title,
      completedOn: m.date || '',
      done: true,
      source: 'meetings',
      sourceId: m.id,
      workType: '组会',
    }));
  return [...tasks, ...guidance, ...meetings].sort((a, b) =>
    (b.completedOn || '').localeCompare(a.completedOn || ''),
  );
}
