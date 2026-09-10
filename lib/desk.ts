export type Item = {
  id: string;
  title: string;
  isTemporary?: boolean;
  [key: string]: any;
};
export type Collection =
  | 'tasks'
  | 'projects'
  | 'students'
  | 'meetings'
  | 'collaborators';
export type State = {
  version: number;
  revision: number;
  affairsFolders?: Record<string, string>;
  tasks: Item[];
  projects: Item[];
  students: Item[];
  meetings: Item[];
  collaborators: Item[];
};
export const fresh = (): State => ({
  version: 2,
  revision: 0,
  tasks: [],
  projects: [],
  students: [],
  meetings: [],
  collaborators: [],
});
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const groups = ['博士生', '全日制研究生', 'MPA', '本科生'];
export const kinds = ['学术论文', '项目申报', '其他事项'];
export function stagesFor(kind: string) {
  return (
    kind === '学术论文'
      ? ['选题与设计', '数据与分析', '论文初稿', '修改定稿', '投稿与返修']
      : kind === '项目申报'
        ? ['申报准备', '方案撰写', '论证修改', '材料提交']
        : ['准备', '执行', '交付']
  ).map((title) => ({
    id: uid(),
    title,
    weight: 1,
    done: false,
    start: '',
    end: '',
  }));
}
export function progress(p: Item) {
  const s = p.stages || [];
  const sum = s.reduce((n: number, x: any) => n + Number(x.weight), 0);
  return sum
    ? Math.round(
        (100 *
          s
            .filter((x: any) => x.done)
            .reduce((n: number, x: any) => n + Number(x.weight), 0)) /
          sum,
      )
    : 0;
}
export function stageName(p: Item) {
  return (
    p.stages?.find((x: any) => !x.done)?.title ||
    (p.stages?.length ? '已完成' : '待划分阶段')
  );
}
export function nextMeeting(date: string, group: string) {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00');
  if (group === 'MPA') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 2);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  } else d.setDate(d.getDate() + 14);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export async function api(path: string, body?: unknown) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'X-Desk-Request': '1',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(data.error || '操作失败');
  return data;
}
