'use client';
import { completedWork } from '@/lib/completed-work';
import { isOverdue, matchesTaskOrigin } from '@/lib/task-display';
import { finishStage } from '@/lib/gantt';
import { PaperJournals } from '@/components/paper-journals';
import { Affairs, affairTypes } from '@/components/affairs';
import { reorderVisible } from '@/lib/reorder';
import { ProjectGantt } from '@/components/project-gantt';
import { Collaborators } from '@/components/collaborators';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Empty,
  EmptyTitle,
  EmptyDescription,
  EmptyHeader,
} from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  GripVertical,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  GraduationCap,
  Users,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  FolderOpen,
  FileText,
  ChevronRight,
  Pin,
  CalendarDays,
  Clock3,
  Download,
  Upload,
  RefreshCw,
  Pencil,
  Check,
  X,
  Folder,
  ExternalLink,
} from 'lucide-react';
import { Editor, Markdown } from '@/components/desk-editor';
import {
  api,
  fresh,
  uid,
  today,
  groups,
  kinds,
  stagesFor,
  progress,
  stageName,
  nextMeeting,
  type State,
  type Collection,
  type Item,
} from '@/lib/desk';
const labels: Record<string, string> = {
  home: '总览',
  tasks: '日常任务',
  affairs: '事务管理',
  projects: '科研项目',
  students: '学生管理',
  collaborators: '合作者',
  meetings: '组会记录',
  settings: '设置与备份',
};
const nav = [
  [LayoutDashboard, 'home'],
  [CheckSquare, 'tasks'],
  [ClipboardList, 'affairs'],
  [BookOpen, 'projects'],
  [GraduationCap, 'students'],
  [Users, 'meetings'],
  [Handshake, 'collaborators'],
] as const;
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  label?: string;
}) {
  return (
    <Select
      value={value || '_none'}
      onValueChange={(v) => onChange(v === '_none' ? '' : String(v))}
    >
      <SelectTrigger aria-label={label} className="pick">
        <SelectValue>
          {options
            .map((x) => (typeof x === 'string' ? { value: x, label: x } : x))
            .find((x) => x.value === value)?.label || '请选择'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => {
          const o = typeof x === 'string' ? { value: x, label: x } : x;
          return (
            <SelectItem key={o.value || '_none'} value={o.value || '_none'}>
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
function Blank({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{desc}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
function Due({
  date,
  completed = false,
}: {
  date: string;
  completed?: boolean;
}) {
  const overdue = isOverdue(date, completed, today());
  return date ? (
    <span className={'due ' + (overdue ? 'late' : '')}>
      <CalendarDays size={14} />
      {date}
      {overdue ? ' · 已逾期' : ''}
    </span>
  ) : (
    <small>未设日期</small>
  );
}
export default function Home() {
  const [taskOrigin, setTaskOrigin] = useState('全部');
  const [calendarDay, setCalendarDay] = useState(today);
  const [showTodayDone, setShowTodayDone] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setCalendarDay(today()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const [data, setData] = useState<State>(fresh),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('正在连接'),
    [page, setPage] = useState('home'),
    [selected, setSelected] = useState(''),
    [modal, setModal] = useState<{ collection: Collection; item: Item } | null>(
      null,
    ),
    [message, setMessage] = useState(''),
    [filter, setFilter] = useState('全部'),
    [archive, setArchive] = useState(false),
    [restore, setRestore] = useState<State | null>(null);
  const stateRef = useRef(data),
    chain = useRef(Promise.resolve()),
    backupInput = useRef<HTMLInputElement>(null);
  const notify = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(''), 4500);
  };
  useEffect(() => {
    api('state')
      .then((d) => {
        setData(d);
        stateRef.current = d;
        setReady(true);
        setStatus('已保存到本地');
      })
      .catch((e) => {
        setError(e.message);
        setStatus('连接失败');
      });
  }, []);
  const mutate = useCallback((fn: (s: State) => State) => {
    const job = chain.current.then(async () => {
      setStatus('正在保存…');
      try {
        const next = fn(structuredClone(stateRef.current));
        const saved = await api('state', next);
        stateRef.current = saved;
        setData(saved);
        setStatus('已保存到本地');
      } catch (e: any) {
        setStatus('保存未完成');
        setError(e.message);
        throw e;
      }
    });
    chain.current = job.catch(() => {});
    return job;
  }, []);
  const dragging = useRef<{
    collection: 'projects' | 'students';
    id: string;
    visible: string[];
  } | null>(null);
  const [dropTarget, setDropTarget] = useState('');
  function moveRecord(
    collection: 'projects' | 'students',
    visible: string[],
    id: string,
    target: string,
  ) {
    void mutate((current) => ({
      ...current,
      [collection]: reorderVisible(current[collection], visible, id, target),
    })).catch(() => {});
  }
  function reorderHandle(
    collection: 'projects' | 'students',
    id: string,
    title: string,
    visible: string[],
  ) {
    return (
      <button
        type="button"
        className="reorder-handle"
        draggable
        aria-label={'拖动排序 ' + title + '；也可用方向键移动'}
        title="拖动排序；聚焦后可按方向键移动"
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => {
          e.stopPropagation();
          dragging.current = { collection, id, visible };
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', id);
        }}
        onDragEnd={() => {
          dragging.current = null;
          setDropTarget('');
        }}
        onKeyDown={(e) => {
          const direction = ['ArrowUp', 'ArrowLeft'].includes(e.key)
            ? -1
            : ['ArrowDown', 'ArrowRight'].includes(e.key)
              ? 1
              : 0;
          if (!direction) return;
          e.preventDefault();
          const index = visible.indexOf(id),
            target = visible[index + direction];
          if (target) moveRecord(collection, visible, id, target);
        }}
      >
        <GripVertical size={17} />
      </button>
    );
  }
  function dropProps(collection: 'projects' | 'students', id: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (
          dragging.current?.collection === collection &&
          dragging.current.visible.includes(id)
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTarget(id);
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setDropTarget('');
      },
      onDrop: (e: React.DragEvent) => {
        const source = dragging.current;
        if (
          !source ||
          source.collection !== collection ||
          !source.visible.includes(id)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        dragging.current = null;
        setDropTarget('');
        moveRecord(collection, source.visible, source.id, id);
      },
    };
  }
  const put = (c: Collection, item: Item) =>
    mutate((s) => ({
      ...s,
      [c]: s[c].some((x) => x.id === item.id)
        ? s[c].map((x) => (x.id === item.id ? item : x))
        : [...s[c], item],
    }));
  const patch = (c: Collection, id: string, fields: Partial<Item>) =>
    mutate((s) => ({
      ...s,
      [c]: s[c].map((x) => (x.id === id ? { ...x, ...fields } : x)),
    }));
  const go = (p: string, id = '') => {
    setPage(p);
    setSelected(id);
    setFilter('全部');
    setArchive(false);
    window.scrollTo({ top: 0 });
  };
  const create = (c: Collection, extra: Record<string, any> = {}) => {
    const common = { id: uid(), title: '', notes: '', archived: false };
    const obj =
      c === 'tasks'
        ? {
            ...common,
            bucket: '今天',
            done: false,
            deadline: '',
            projectId: '',
            studentId: '',
            meetingId: '',
          }
        : c === 'projects'
          ? {
              ...common,
              kind: '学术论文',
              deadline: '',
              next: '',
              folder: '',
              pinned: true,
              collaborators: '',
              collaboratorIds: [],
              studentIds: [],
              stages: stagesFor('学术论文'),
            }
          : c === 'students'
            ? {
                ...common,
                kind: '全日制研究生',
                topic: '',
                graduation: '',
                followup: '',
                folder: '',
                feedback: '',
                guidance: [],
              }
            : {
                ...common,
                group: '全日制',
                date: '',
                agenda: '',
                attendees: '',
                completed: false,
              };
    setModal({ collection: c, item: { ...obj, ...extra } });
  };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'start_task_creation',
            title: '打开新建任务',
            description: '打开工作台的新建任务表单，由用户填写保存。',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute(input: any) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw new Error('不接受参数');
              setModal({
                collection: 'tasks',
                item: {
                  id: uid(),
                  title: '',
                  notes: '',
                  bucket: '今天',
                  done: false,
                  deadline: '',
                  projectId: '',
                  studentId: '',
                  meetingId: '',
                },
              });
              return { opened: true };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  const tasks = data.tasks.filter((t) => !t.done && !t.archived),
    projects = data.projects.filter((p) => !p.archived),
    students = data.students.filter((s) => !s.archived);
  const week = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const deadlines = [
    ...tasks
      .filter((t) => t.deadline && !t.projectId && t.bucket !== '今天')
      .map((t) => ({ ...t, section: 'tasks', due: t.deadline })),
    ...projects
      .filter((p) => p.deadline && !p.pinned && progress(p) < 100)
      .map((p) => ({ ...p, section: 'projects', due: p.deadline })),
    ...students
      .filter((s) => s.graduation)
      .map((s) => ({
        ...s,
        section: 'students',
        due: s.graduation,
        title: s.title + ' · 毕业节点',
      })),
  ]
    .filter((x) => x.due <= week)
    .sort((a, b) => a.due.localeCompare(b.due));
  const follow = students
    .filter((s) => s.followup && s.followup <= week)
    .sort((a, b) => a.followup.localeCompare(b.followup));
  const item = ['projects', 'students', 'meetings'].includes(page)
    ? data[page as Collection].find((x) => x.id === selected)
    : null;
  const allCompletedWork = completedWork(data);
  const todayCompletedWork = allCompletedWork.filter(
    (w) => w.completedOn === calendarDay,
  );
  function completedWorkRow(w: Item) {
    if (w.source === 'tasks') return taskRow(w);
    return (
      <div className="task-row" key={w.workKey}>
        <CheckSquare size={18} aria-label="已完成" />
        <button className="task-text" onClick={() => go(w.source, w.sourceId)}>
          <span>{w.title}</span>
          <small>
            {w.workType}
            {w.summary
              ? ' · ' + w.summary.replace(/[#*`\n]/g, ' ').slice(0, 90)
              : ''}
          </small>
        </button>
        <Due date={w.completedOn} completed />
      </div>
    );
  }
  function tasksInBucket(bucket: string) {
    return bucket === '已完成'
      ? allCompletedWork.filter((w) => matchesTaskOrigin(w, taskOrigin))
      : data.tasks.filter(
          (t) =>
            !t.archived &&
            !t.done &&
            t.bucket === bucket &&
            matchesTaskOrigin(t, taskOrigin),
        );
  }
  function taskRow(t: Item) {
    return (
      <div className={'task-row ' + (t.done ? 'completed' : '')} key={t.id}>
        <Checkbox
          aria-label={'完成 ' + t.title}
          checked={t.done}
          onCheckedChange={(v) => {
            void patch('tasks', t.id, { done: !!v }).catch(() => {});
          }}
        />
        <button
          className="task-text"
          onClick={() =>
            setModal({ collection: 'tasks', item: structuredClone(t) })
          }
        >
          <span>{t.title}</span>
          {t.isTemporary && (
            <small>
              <em className="temporary-badge">临时</em>
            </small>
          )}
          {t.affairsType && (
            <small>
              {t.affairsType}
              {t.reviewJournal ? ' · ' + t.reviewJournal : ''}
            </small>
          )}
          <small>
            {[
              data.projects.find((p) => p.id === t.projectId)?.title,
              data.students.find((s) => s.id === t.studentId)?.title,
              data.meetings.find((m) => m.id === t.meetingId)?.title,
            ]
              .filter(Boolean)
              .join(' · ') || '独立事项'}
          </small>
        </button>
        <Due date={t.deadline} completed={!!t.done} />
        {t.bucket !== '今天' && !t.done && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void patch('tasks', t.id, { bucket: '今天' }).catch(() => {});
            }}
          >
            今天做
          </Button>
        )}
      </div>
    );
  }
  function projectCard(p: Item, visible?: string[]) {
    const card = (
      <button
        className="project-card"
        key={p.id}
        onClick={() => go('projects', p.id)}
      >
        <div className="flex-between">
          <span className="eyebrow">{p.kind}</span>
          {p.pinned && <Pin size={14} />}
        </div>
        <h3>{p.title}</h3>
        <div className="flex-between">
          <span>{stageName(p)}</span>
          <strong>{progress(p)}%</strong>
        </div>
        <Progress aria-label={p.title + '阶段进度'} value={progress(p)} />
        <p className="next-line">下一步 · {p.next || '待安排'}</p>
        <Due date={p.deadline} completed={progress(p) >= 100} />
      </button>
    );
    return visible ? (
      <div
        key={p.id}
        className={
          'project-sortable ' + (dropTarget === p.id ? 'reorder-target' : '')
        }
        {...dropProps('projects', p.id)}
      >
        {card}
        {reorderHandle('projects', p.id, p.title, visible)}
      </div>
    ) : (
      card
    );
  }
  function relatedTasks(c: Collection, id: string) {
    const field =
      c === 'projects'
        ? 'projectId'
        : c === 'students'
          ? 'studentId'
          : 'meetingId';
    const list = data.tasks.filter((t) => t[field] === id);
    return (
      <section className="panel">
        <div className="section-head">
          <h2>关联任务</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => create('tasks', { [field]: id })}
          >
            <Plus size={15} />
            添加任务
          </Button>
        </div>
        {list.length ? (
          list.map(taskRow)
        ) : (
          <Blank title="暂无任务" desc="这里添加的任务也会出现在日常任务中。" />
        )}
      </section>
    );
  }
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <button className="brand" onClick={() => go('home')}>
            <span>研</span>
            <div>
              研间<small>个人科研工作台</small>
            </div>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-caption">工作空间</div>
          <SidebarMenu>
            {nav.map(([Icon, key]) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  isActive={page === key}
                  onClick={() => go(key)}
                >
                  <Icon />
                  <span>{labels[key]}</span>
                  {key === 'tasks' && tasks.length > 0 && (
                    <span className="nav-count">{tasks.length}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-note">
            <span>本周节奏</span>
            <p>{tasks.filter((t) => t.bucket === '今天').length} 项今日待办</p>
            <p>
              {projects.filter((p) => progress(p) < 100).length} 个进行中项目
            </p>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <small>LOCAL WORKSPACE</small>
          <SidebarMenuButton
            isActive={page === 'settings'}
            onClick={() => go('settings')}
          >
            <Settings />
            设置与备份
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="workspace">
          <header>
            <div className="breadcrumb">
              <SidebarTrigger />
              <button onClick={() => go('home')}>我的工作台</button>
              <ChevronRight size={13} />
              <button onClick={() => go(page)}>{labels[page]}</button>
              {item && (
                <>
                  <ChevronRight size={13} />
                  <span>{item.title}</span>
                </>
              )}
            </div>
            <span className="tag" role="status">
              {status}
            </span>
          </header>
          {error && (
            <div role="alert" className="error-banner">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => setError('')}>
                关闭
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => location.reload()}
              >
                重新加载
              </Button>
            </div>
          )}
          {!ready ? (
            <Blank
              title={error ? '无法连接本地工作台' : '正在读取工作台'}
              desc="请保持本地服务运行。"
            />
          ) : (
            <>
              {page === 'home' && (
                <>
                  <section className="cover">
                    <div>
                      <p>
                        {new Date().toLocaleDateString('zh-CN', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'long',
                        })}
                      </p>
                      <h1>今日研间</h1>
                      <p>日常 · 研究 · 指导</p>
                    </div>
                    <span className="art-credit">葛饰北斋 · 神奈川冲浪里</span>
                  </section>
                  <div className="page-title">
                    <h2>今天的工作</h2>
                    <Button onClick={() => create('tasks')}>
                      <Plus />
                      添加任务
                    </Button>
                  </div>
                  <div className="stats">
                    {[
                      [
                        '今日待办',
                        tasks.filter((t) => t.bucket === '今天').length,
                        'tasks',
                      ],
                      ['今日已完成', todayCompletedWork.length, 'todayDone'],
                      [
                        '进行中项目',
                        projects.filter((p) => progress(p) < 100).length,
                        'projects',
                      ],
                      ['待跟进学生', follow.length, 'students'],
                      ['近期截止', deadlines.length, 'tasks'],
                    ].map(([l, n, p]) => (
                      <button
                        key={l}
                        className={p === 'todayDone' ? 'today-done-stat' : ''}
                        onClick={() =>
                          p === 'todayDone'
                            ? setShowTodayDone(!showTodayDone)
                            : go(String(p))
                        }
                      >
                        <small>{l}</small>
                        <strong>{n}</strong>
                      </button>
                    ))}
                  </div>
                  <p className="achievement-copy">
                    {todayCompletedWork.length
                      ? `今天已经完成 ${todayCompletedWork.length} 件事，每一件都算数。`
                      : '完成一件，记录一份进展。'}
                  </p>
                  {showTodayDone && (
                    <section className="panel today-done-panel">
                      <div className="section-head">
                        <h2>今天完成的事</h2>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTodayDone(false)}
                        >
                          收起
                        </Button>
                      </div>
                      <p className="settings-copy">
                        汇总日常任务、学生指导和已完成组会，按各自的实际日期统计。
                      </p>
                      {todayCompletedWork.length ? (
                        todayCompletedWork.map(completedWorkRow)
                      ) : (
                        <Blank
                          title="今天还没有记录完成的工作"
                          desc="完成任务、保存指导记录或标记组会完成后，会自动汇总到这里。"
                        />
                      )}
                    </section>
                  )}
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="section-head">
                        <h2>今日事项</h2>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => go('tasks')}
                        >
                          全部任务 <ArrowUpRight size={15} />
                        </Button>
                      </div>
                      {tasks.filter((t) => t.bucket === '今天').length ? (
                        tasks.filter((t) => t.bucket === '今天').map(taskRow)
                      ) : (
                        <Blank
                          title="今天还没有安排任务"
                          desc="添加任务，或从近期事项中选入今天。"
                          action={
                            <Button
                              variant="outline"
                              onClick={() => create('tasks')}
                            >
                              <Plus />
                              添加第一项任务
                            </Button>
                          }
                        />
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-head">
                        <h2>关键项目</h2>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => go('projects')}
                        >
                          全部项目 <ArrowUpRight size={15} />
                        </Button>
                      </div>
                      {projects.filter((p) => p.pinned).length ? (
                        <div className="compact-projects">
                          {projects
                            .filter((p) => p.pinned)
                            .map((p) =>
                              projectCard(
                                p,
                                projects
                                  .filter((x) => x.pinned)
                                  .map((x) => x.id),
                              ),
                            )}
                        </div>
                      ) : (
                        <Blank
                          title="让重要的研究出现在这里"
                          desc="新建项目并置顶，持续关注阶段与下一步。"
                          action={
                            <Button
                              variant="outline"
                              onClick={() => create('projects')}
                            >
                              <Plus />
                              新建项目
                            </Button>
                          }
                        />
                      )}
                    </section>
                    <section className="panel">
                      <h2>
                        近期截止 <small>未来 7 天及逾期</small>
                      </h2>
                      {deadlines.length ? (
                        deadlines.map((x) => (
                          <button
                            className="reminder"
                            key={x.id}
                            onClick={() =>
                              x.section === 'tasks'
                                ? setModal({
                                    collection: 'tasks',
                                    item: structuredClone(
                                      data.tasks.find((t) => t.id === x.id)!,
                                    ),
                                  })
                                : go(x.section, x.id)
                            }
                          >
                            <span>{x.title}</span>
                            <Due date={x.due} />
                          </button>
                        ))
                      ) : (
                        <Blank title="近期没有截止事项" />
                      )}
                    </section>
                    <section className="panel">
                      <h2>
                        指导与组会 <small>未来 7 天及待跟进</small>
                      </h2>
                      {follow.map((s) => (
                        <button
                          className="reminder"
                          key={s.id}
                          onClick={() => go('students', s.id)}
                        >
                          <span>
                            {s.title}
                            <small> · {s.kind}</small>
                          </span>
                          <Due date={s.followup} />
                        </button>
                      ))}
                      {data.meetings
                        .filter(
                          (m) =>
                            !m.archived &&
                            !m.completed &&
                            m.date &&
                            m.date <= week,
                        )
                        .map((m) => (
                          <button
                            className="reminder"
                            key={m.id}
                            onClick={() => go('meetings', m.id)}
                          >
                            <span>{m.title}</span>
                            <Due date={m.date} completed={!!m.completed} />
                          </button>
                        ))}
                      {!follow.length &&
                        !data.meetings.some(
                          (m) =>
                            !m.archived &&
                            !m.completed &&
                            m.date &&
                            m.date <= week,
                        ) && (
                          <Blank
                            title="暂无待跟进安排"
                            desc="为学生设置跟进日期，或安排下一次组会。"
                          />
                        )}
                    </section>
                  </div>
                </>
              )}
              {page === 'affairs' && (
                <Affairs
                  tasks={data.tasks}
                  folders={data.affairsFolders || {}}
                  renderFiles={(kind) => (
                    <Files
                      key={kind}
                      collection="affairs"
                      item={{
                        id: kind,
                        title: kind,
                        folder: data.affairsFolders?.[kind] || '',
                      }}
                      save={(folder) =>
                        mutate((current) => ({
                          ...current,
                          affairsFolders: {
                            ...current.affairsFolders,
                            [kind]: folder,
                          },
                        }))
                      }
                      notify={setStatus}
                    />
                  )}
                  create={(affairsType) =>
                    create('tasks', {
                      affairsType,
                      reviewJournal: '',
                      manuscriptTitle: '',
                      reviewNumber: '',
                      requester: '',
                      assistanceType: '论文',
                    })
                  }
                  edit={(item) =>
                    setModal({
                      collection: 'tasks',
                      item: structuredClone(item),
                    })
                  }
                  patch={(id, fields) => patch('tasks', id, fields)}
                />
              )}
              {page === 'tasks' && (
                <>
                  <div className="page-title">
                    <div>
                      <p className="eyebrow">DAILY TASKS</p>
                      <h1>日常任务</h1>
                    </div>
                    <Button
                      onClick={() =>
                        create('tasks', { isTemporary: taskOrigin === '临时' })
                      }
                    >
                      <Plus />
                      添加任务
                    </Button>
                  </div>
                  <div className="task-origin-filter">
                    <label>任务来源</label>
                    <Pick
                      value={taskOrigin}
                      onChange={setTaskOrigin}
                      options={[
                        { value: '全部', label: '全部任务' },
                        { value: '计划', label: '计划任务（未标记临时）' },
                        { value: '临时', label: '临时任务' },
                      ]}
                    />
                  </div>
                  <Tabs defaultValue="今天">
                    <TabsList>
                      {['今天', '近期', '以后', '已完成'].map((b) => (
                        <TabsTrigger key={b} value={b}>
                          {b} <small>{tasksInBucket(b).length}</small>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {['今天', '近期', '以后', '已完成'].map((b) => (
                      <TabsContent value={b} key={b}>
                        <section className="panel task-panel">
                          {b === '已完成' && (
                            <p className="settings-copy">
                              包括已完成任务、学生指导和已完成组会。指导与组会的日期来自原记录，点击可查看。
                            </p>
                          )}
                          {tasksInBucket(b).length ? (
                            tasksInBucket(b).map(
                              b === '已完成' ? completedWorkRow : taskRow,
                            )
                          ) : (
                            <Blank
                              title={
                                b === '已完成'
                                  ? '完成的事项会留在这里'
                                  : `暂无${b}任务`
                              }
                              action={
                                b !== '已完成' ? (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      create('tasks', {
                                        bucket: b,
                                        isTemporary: taskOrigin === '临时',
                                      })
                                    }
                                  >
                                    <Plus />
                                    添加任务
                                  </Button>
                                ) : undefined
                              }
                            />
                          )}
                        </section>
                      </TabsContent>
                    ))}
                  </Tabs>
                </>
              )}
              {['projects', 'students', 'meetings'].includes(page) && !item && (
                <>
                  <section
                    className={
                      'cover ' +
                      (page === 'projects'
                        ? 'monet'
                        : page === 'students'
                          ? 'vangogh'
                          : 'meeting-cover')
                    }
                  >
                    <div>
                      <p>
                        {page === 'projects'
                          ? 'RESEARCH & PROJECTS'
                          : page === 'students'
                            ? 'STUDENTS & MENTORING'
                            : 'MEETINGS & NOTES'}
                      </p>
                      <h1>{labels[page]}</h1>
                    </div>
                    <span className="art-credit">
                      {page === 'projects'
                        ? '克劳德·莫奈 · 睡莲'
                        : page === 'students'
                          ? '文森特·梵高 · 诗人花园'
                          : '讨论 · 记录 · 行动'}
                    </span>
                  </section>
                  <div className="page-title">
                    <div className="filter-bar">
                      <Pick
                        label="类型筛选"
                        value={filter}
                        onChange={setFilter}
                        options={[
                          '全部',
                          ...(page === 'projects'
                            ? kinds
                            : page === 'students'
                              ? groups
                              : ['全日制', 'MPA']),
                        ]}
                      />
                      <label className="check-label">
                        <Checkbox
                          checked={archive}
                          onCheckedChange={(v) => setArchive(!!v)}
                        />
                        已归档
                      </label>
                    </div>
                    <Button onClick={() => create(page as Collection)}>
                      <Plus />
                      {page === 'projects'
                        ? '新建项目'
                        : page === 'students'
                          ? '添加学生'
                          : '安排组会'}
                    </Button>
                  </div>
                  {page === 'meetings' && (
                    <div className="frequency-note">
                      <Clock3 size={17} />
                      全日制组会每两周 · MPA
                      组会每两个月。记录完成后可生成下次安排，日期可调整。
                    </div>
                  )}
                  {(() => {
                    const list = data[page as Collection].filter(
                      (x) =>
                        !!x.archived === archive &&
                        (filter === '全部' || (x.kind || x.group) === filter),
                    );
                    return !list.length ? (
                      <section className="panel">
                        <Blank
                          title={
                            archive
                              ? '没有归档记录'
                              : page === 'projects'
                                ? '从一个研究方向开始'
                                : page === 'students'
                                  ? '添加第一位学生'
                                  : '安排一次讨论'
                          }
                          desc={
                            page === 'students'
                              ? '按培养类型管理研究、毕业节点和每次指导。'
                              : '记录当前阶段，把下一步落到具体任务。'
                          }
                          action={
                            !archive ? (
                              <Button
                                variant="outline"
                                onClick={() => create(page as Collection)}
                              >
                                <Plus />
                                添加记录
                              </Button>
                            ) : undefined
                          }
                        />
                      </section>
                    ) : page === 'projects' ? (
                      <div className="project-grid">
                        {list.map((p) =>
                          projectCard(
                            p,
                            list.map((x) => x.id),
                          ),
                        )}
                      </div>
                    ) : page === 'students' ? (
                      <section className="panel table-panel">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {[
                                '姓名',
                                '培养类型',
                                '研究题目 / 方向',
                                '毕业节点',
                                '下次跟进',
                                '',
                              ].map((x, i) => (
                                <TableHead key={i}>{x}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {list.map((s) => (
                              <TableRow
                                key={s.id}
                                className={
                                  dropTarget === s.id ? 'reorder-target' : ''
                                }
                                {...dropProps('students', s.id)}
                              >
                                <TableCell>
                                  <div className="student-sortable">
                                    {reorderHandle(
                                      'students',
                                      s.id,
                                      s.title,
                                      list.map((x) => x.id),
                                    )}
                                    <button
                                      className="student-name"
                                      onClick={() => go('students', s.id)}
                                    >
                                      <span className="avatar">
                                        {s.title.slice(0, 1)}
                                      </span>
                                      {s.title}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="pill">{s.kind}</span>
                                </TableCell>
                                <TableCell className="topic-cell">
                                  {s.topic || '待确定'}
                                </TableCell>
                                <TableCell>
                                  <Due date={s.graduation} />
                                </TableCell>
                                <TableCell>
                                  <Due date={s.followup} />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => go('students', s.id)}
                                  >
                                    <ChevronRight />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </section>
                    ) : (
                      <div className="meeting-list">
                        {list
                          .sort((a, b) =>
                            (b.date || '').localeCompare(a.date || ''),
                          )
                          .map((m) => (
                            <button
                              className="panel meeting-item"
                              key={m.id}
                              onClick={() => go('meetings', m.id)}
                            >
                              <div className="meeting-calendar">
                                <CalendarDays />
                                <span>{m.date || '日期待定'}</span>
                              </div>
                              <div>
                                <span className="eyebrow">
                                  {m.group}组会 ·{' '}
                                  {m.completed ? '已完成' : '待召开'}
                                </span>
                                <h2>{m.title}</h2>
                                <p>{m.attendees || '参会人员待定'}</p>
                              </div>
                              <ChevronRight />
                            </button>
                          ))}
                      </div>
                    );
                  })()}
                </>
              )}
              {item && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => go(page)}
                    className="back-button"
                  >
                    <ArrowLeft size={16} />
                    返回{labels[page]}
                  </Button>
                  <section
                    className={
                      'detail-cover ' +
                      (page === 'projects'
                        ? 'monet'
                        : page === 'students'
                          ? 'vangogh'
                          : 'meeting-cover')
                    }
                  />
                  <div className="document-title">
                    <div>
                      <p className="eyebrow">
                        {item.kind || item.group + '组会'}
                        {item.archived ? ' · 已归档' : ''}
                      </p>
                      <h1>{item.title}</h1>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setModal({
                          collection: page as Collection,
                          item: structuredClone(item),
                        })
                      }
                    >
                      <Pencil size={15} />
                      编辑信息
                    </Button>
                  </div>
                  {page === 'projects' && (
                    <>
                      <div className="metadata-grid">
                        <div>
                          <small>当前阶段</small>
                          <strong>{stageName(item)}</strong>
                        </div>
                        <div>
                          <small>下一步行动</small>
                          <strong>{item.next || '待安排'}</strong>
                        </div>
                        <div>
                          <small>Deadline</small>
                          <Due
                            date={item.deadline}
                            completed={progress(item) >= 100}
                          />
                        </div>
                        <div>
                          <small>阶段完成比例</small>
                          <strong>{progress(item)}%</strong>
                          <Progress
                            value={progress(item)}
                            aria-label="阶段完成比例"
                          />
                        </div>
                      </div>
                      {item.kind === '学术论文' && (
                        <PaperJournals
                          key={item.id}
                          target={item.targetJournal || ''}
                          submissions={item.submissions || []}
                          save={(fields) => patch('projects', item.id, fields)}
                        />
                      )}
                      <section className="panel">
                        <ProjectGantt
                          stages={item.stages || []}
                          deadline={item.deadline || ''}
                          save={(stages) =>
                            patch('projects', item.id, { stages })
                          }
                          editAll={() =>
                            setModal({
                              collection: 'projects',
                              item: structuredClone(item),
                            })
                          }
                        />
                        {(item.collaborators ||
                          item.collaboratorIds?.length > 0 ||
                          item.studentIds?.length > 0) && (
                          <div className="linked-people">
                            <small>合作人员</small>
                            {item.collaboratorIds?.map((id: string) => {
                              const person = data.collaborators.find(
                                (p) => p.id === id,
                              );
                              return person ? (
                                <Button
                                  key={id}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => go('collaborators', id)}
                                >
                                  {person.title}
                                  <ArrowUpRight size={13} />
                                </Button>
                              ) : null;
                            })}
                            {item.collaborators &&
                              !item.collaboratorIds?.some(
                                (id: string) =>
                                  data.collaborators.find((p) => p.id === id)
                                    ?.title === item.collaborators.trim(),
                              ) && <span>{item.collaborators}</span>}
                            {item.studentIds?.map((id: string) => {
                              const s = data.students.find((x) => x.id === id);
                              return s ? (
                                <Button
                                  key={id}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => go('students', id)}
                                >
                                  {s.title}
                                  <ArrowUpRight size={13} />
                                </Button>
                              ) : null;
                            })}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                  {page === 'students' && (
                    <>
                      <div className="metadata-grid student-meta">
                        <div>
                          <small>研究题目 / 方向</small>
                          <strong>{item.topic || '待确定'}</strong>
                        </div>
                        <div>
                          <small>毕业节点</small>
                          <Due date={item.graduation} />
                        </div>
                        <div>
                          <small>下次跟进</small>
                          <Due date={item.followup} />
                        </div>
                      </div>
                      <Guidance
                        student={item}
                        save={(fields) => patch('students', item.id, fields)}
                        addTask={() => create('tasks', { studentId: item.id })}
                      />
                      {data.projects.some((p) =>
                        p.studentIds?.includes(item.id),
                      ) && (
                        <section className="panel">
                          <h2>参与项目</h2>
                          <div className="project-grid">
                            {data.projects
                              .filter((p) => p.studentIds?.includes(item.id))
                              .map((p) => projectCard(p))}
                          </div>
                        </section>
                      )}
                    </>
                  )}
                  {page === 'meetings' && (
                    <>
                      <div className="metadata-grid">
                        <div>
                          <small>组会日期</small>
                          <Due date={item.date} completed={!!item.completed} />
                        </div>
                        <div>
                          <small>参会人员</small>
                          <strong>{item.attendees || '待填写'}</strong>
                        </div>
                        <div>
                          <small>状态</small>
                          <strong>
                            {item.completed ? '已完成' : '待召开'}
                          </strong>
                        </div>
                        <div>
                          <small>下次建议日期</small>
                          <strong>
                            {nextMeeting(item.date, item.group) ||
                              '首次日期待定'}
                          </strong>
                        </div>
                      </div>
                      <section className="panel">
                        <div className="section-head">
                          <h2>组会议题</h2>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              create('meetings', {
                                group: item.group,
                                date: nextMeeting(item.date, item.group),
                                attendees: item.attendees,
                                title: `${item.group}学生组会`,
                              })
                            }
                          >
                            <Plus size={15} />
                            安排下次组会
                          </Button>
                        </div>
                        <Markdown value={item.agenda || '暂无议题。'} />
                      </section>
                    </>
                  )}
                  {relatedTasks(page as Collection, item.id)}
                  <section className="panel">
                    <div className="section-head">
                      <h2>
                        {page === 'meetings'
                          ? '讨论记录'
                          : page === 'students'
                            ? '学生档案笔记'
                            : '研究笔记'}
                      </h2>
                      <small>离开编辑框时自动保存</small>
                    </div>
                    <Notes
                      key={item.id}
                      value={item.notes || ''}
                      save={(v) =>
                        patch(page as Collection, item.id, { notes: v })
                      }
                    />
                  </section>
                  {page !== 'meetings' && (
                    <Files
                      key={item.id}
                      collection={page as Collection}
                      item={item}
                      save={(folder) =>
                        patch(page as Collection, item.id, { folder })
                      }
                      notify={notify}
                    />
                  )}
                </>
              )}
              {page === 'collaborators' && (
                <Collaborators
                  data={data}
                  selected={selected}
                  select={(id) => setSelected(id)}
                  openProject={(id) => go('projects', id)}
                  save={(person) => put('collaborators', person)}
                />
              )}
              {page === 'settings' && (
                <>
                  <div className="page-title">
                    <div>
                      <p className="eyebrow">LOCAL WORKSPACE</p>
                      <h1>设置与备份</h1>
                    </div>
                  </div>
                  <section className="panel">
                    <h2>数据备份</h2>
                    <p className="settings-copy">
                      工作台记录自动保存在本机。每次保存前保留历史副本，最多保留最近
                      100 份。
                    </p>
                    <p className="settings-copy">
                      导出包含任务、项目、学生、合作者、组会、笔记和文件夹路径；关联文件夹内的
                      Word、Excel 等原文件不包含在备份中，请另外备份。
                    </p>
                    <div className="button-row">
                      <Button
                        onClick={() => {
                          const blob = new Blob(
                            [JSON.stringify(stateRef.current, null, 2)],
                            { type: 'application/json' },
                          );
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `研间备份-${today()}.json`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                        }}
                      >
                        <Download />
                        导出备份
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => backupInput.current?.click()}
                      >
                        <Upload />
                        恢复备份
                      </Button>
                      <input
                        type="file"
                        accept=".json,application/json"
                        hidden
                        ref={backupInput}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try {
                            if (f.size > 10_000_000)
                              throw new Error('备份过大');
                            const d = JSON.parse(await f.text());
                            if (
                              ![1, 2].includes(d.version) ||
                              ![
                                'tasks',
                                'projects',
                                'students',
                                'meetings',
                              ].every((k) => Array.isArray(d[k]))
                            )
                              throw new Error('不是有效的研间备份');
                            setRestore(d);
                          } catch (err: any) {
                            setError(err.message);
                          }
                        }}
                      />
                    </div>
                  </section>
                  <section className="panel">
                    <h2>工作空间</h2>
                    <div className="settings-copy">
                      仅本机使用 · 首页提醒 · 文件保持在原位置
                    </div>
                    <p>
                      当前共有 {data.tasks.length} 项任务、
                      {data.projects.length} 个项目、{data.students.length}{' '}
                      名学生和 {data.meetings.length} 次组会。
                    </p>
                  </section>
                  <section className="panel">
                    <h2>画作与来源</h2>
                    <div className="art-grid">
                      {[
                        [
                          'hokusai-great-wave.jpg',
                          '葛饰北斋 · 神奈川冲浪里',
                          'https://commons.wikimedia.org/wiki/File:Katsushika_Hokusai_The_Great_Wave_off_Kanagawa_1830.jpg',
                        ],
                        [
                          'monet-water-lilies.jpg',
                          '克劳德·莫奈 · 睡莲',
                          'https://commons.wikimedia.org/wiki/File:Claude_Monet_-_Water_Lilies_-_1933.1157_-_Art_Institute_of_Chicago.jpg',
                        ],
                        [
                          'van-gogh-poets-garden.jpg',
                          '文森特·梵高 · 诗人花园',
                          'https://commons.wikimedia.org/wiki/File:The_Poet%27s_Garden_1888_Vincent_van_Gogh.jpg',
                        ],
                      ].map(([img, title, url]) => (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          key={img}
                        >
                          <img src={'/art/' + img} alt={title} />
                          <small>{title} ↗</small>
                        </a>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </SidebarInset>
      {modal && (
        <RecordForm
          modal={modal}
          data={data}
          close={() => setModal(null)}
          save={async (item) => {
            await put(modal.collection, item);
            setModal(null);
          }}
        />
      )}
      <AlertDialog
        open={!!restore}
        onOpenChange={(v) => {
          if (!v) setRestore(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>用备份恢复工作台？</AlertDialogTitle>
            <AlertDialogDescription>
              将替换当前工作台记录。恢复前会自动保存当前数据副本，原文件不会被改动。备份包含{' '}
              {restore?.projects.length} 个项目、{restore?.students.length}{' '}
              名学生和 {restore?.tasks.length} 项任务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!restore) return;
                chain.current = chain.current.then(async () => {
                  try {
                    const saved = await api('restore', restore);
                    stateRef.current = saved;
                    setData(saved);
                    setRestore(null);
                    setSelected('');
                    setStatus('已保存到本地');
                    notify('备份已恢复');
                  } catch (e: any) {
                    setError(e.message);
                  }
                });
              }}
            >
              恢复备份
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {message && (
        <div className="toast" role="status">
          <Check size={16} />
          {message}
        </div>
      )}
    </SidebarProvider>
  );
}
function Notes({
  value,
  save,
}: {
  value: string;
  save: (v: string) => Promise<void>;
}) {
  const [text, setText] = useState(value),
    [err, setErr] = useState('');
  const textRef = useRef(text),
    previousValue = useRef(value);
  useEffect(() => {
    // A completed older save must not overwrite text typed while it was pending.
    if (textRef.current === previousValue.current) {
      textRef.current = value;
      setText(value);
    }
    previousValue.current = value;
  }, [value]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (textRef.current !== previousValue.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  return (
    <>
      <Editor
        value={text}
        onChange={(v) => {
          textRef.current = v;
          setText(v);
        }}
        onBlur={() => {
          if (text !== value)
            void save(text)
              .then(() => setErr(''))
              .catch((e) => setErr(e.message));
        }}
      />
      {err && (
        <p className="error-text">
          {err}{' '}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void save(text)
                .then(() => setErr(''))
                .catch((e) => setErr(e.message))
            }
          >
            重试保存
          </Button>
        </p>
      )}
    </>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function RecordForm({
  modal,
  data,
  close,
  save,
}: {
  modal: { collection: Collection; item: Item };
  data: State;
  close: () => void;
  save: (i: Item) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Item>(structuredClone(modal.item)),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState('');
  const c = modal.collection;
  const set = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));
  const field = (k: string, label: string, type = 'text') => (
    <Field label={label}>
      <Input
        aria-label={label}
        type={type}
        value={draft[k] || ''}
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="record-dialog">
        <DialogTitle>
          {data[c].some((x) => x.id === draft.id) ? '编辑' : '新建'}
          {c === 'tasks'
            ? '任务'
            : c === 'projects'
              ? '项目'
              : c === 'students'
                ? '学生'
                : '组会'}
        </DialogTitle>
        <DialogDescription>填写后保存到本地工作台。</DialogDescription>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            if (!draft.title.trim()) {
              setErr('请填写名称');
              return;
            }
            setBusy(true);
            try {
              await save({ ...draft, title: draft.title.trim() });
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={c === 'students' ? '姓名' : '名称'}>
            <Input
              aria-label="名称"
              autoFocus
              required
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          {c === 'tasks' && (
            <>
              <Field label="任务类别">
                <Pick
                  value={draft.affairsType || ''}
                  onChange={(v) => set('affairsType', v)}
                  options={[{ value: '', label: '普通任务' }, ...affairTypes]}
                />
              </Field>
              {!!draft.affairsType &&
                field(
                  'requester',
                  draft.affairsType === '协助评阅'
                    ? '求助人 / 单位（独立记录）'
                    : draft.affairsType === '行政任务'
                      ? '交办人 / 部门'
                      : draft.affairsType === '期刊审稿'
                        ? '联系编辑（选填）'
                        : '相关人员 / 课程',
                )}
              {draft.affairsType === '期刊审稿' && (
                <>
                  <Field label="期刊名称">
                    <Input
                      required
                      value={draft.reviewJournal || ''}
                      onChange={(e) => set('reviewJournal', e.target.value)}
                    />
                  </Field>
                  <Field label="稿件名称">
                    <Input
                      required
                      value={draft.manuscriptTitle || ''}
                      onChange={(e) => set('manuscriptTitle', e.target.value)}
                    />
                  </Field>
                  {field('reviewNumber', '稿件编号（选填）')}
                </>
              )}
              {draft.affairsType === '协助评阅' && (
                <>
                  <Field label="评阅内容">
                    <Pick
                      value={draft.assistanceType || '论文'}
                      onChange={(v) => set('assistanceType', v)}
                      options={['论文', '项目', '其他']}
                    />
                  </Field>
                  {field('manuscriptTitle', '论文 / 项目名称（选填）')}
                </>
              )}
              <div className="form-grid">
                <Field label="安排">
                  <Pick
                    value={draft.bucket}
                    onChange={(v) => set('bucket', v)}
                    options={['今天', '近期', '以后']}
                  />
                </Field>
                {field('deadline', '截止日期', 'date')}
              </div>
              <div className="form-grid">
                <Field label="关联项目">
                  <Pick
                    value={draft.projectId}
                    onChange={(v) => set('projectId', v)}
                    options={[
                      { value: '', label: '不关联' },
                      ...data.projects.map((x) => ({
                        value: x.id,
                        label: x.title,
                      })),
                    ]}
                  />
                </Field>
                <Field label="关联学生">
                  <Pick
                    value={draft.studentId}
                    onChange={(v) => set('studentId', v)}
                    options={[
                      { value: '', label: '不关联' },
                      ...data.students.map((x) => ({
                        value: x.id,
                        label: x.title,
                      })),
                    ]}
                  />
                </Field>
              </div>
              <Field label="关联组会">
                <Pick
                  value={draft.meetingId}
                  onChange={(v) => set('meetingId', v)}
                  options={[
                    { value: '', label: '不关联' },
                    ...data.meetings.map((x) => ({
                      value: x.id,
                      label: x.title,
                    })),
                  ]}
                />
              </Field>
              <label className="check-label">
                <Checkbox
                  checked={!!draft.isTemporary}
                  onCheckedChange={(v) => set('isTemporary', !!v)}
                />
                临时插入（原计划之外）
              </label>
              <label className="check-label">
                <Checkbox
                  checked={!!draft.done}
                  onCheckedChange={(v) => {
                    set('done', !!v);
                    if (!v) set('completedOn', '');
                  }}
                />
                已完成
              </label>
              {!!draft.done && (
                <>
                  <Field label="完成日期（历史任务可补填）">
                    <Input
                      type="date"
                      value={draft.completedOn || ''}
                      onChange={(e) => set('completedOn', e.target.value)}
                    />
                  </Field>
                  <small>
                    新完成的任务自动记录当天；历史记录留空则不计入每日完成数。
                  </small>
                </>
              )}
            </>
          )}
          {c === 'projects' && (
            <>
              <div className="form-grid">
                <Field label="项目类型">
                  <Pick
                    value={draft.kind}
                    onChange={(v) => {
                      set('kind', v);
                      if (!data.projects.some((x) => x.id === draft.id))
                        set('stages', stagesFor(v));
                    }}
                    options={kinds}
                  />
                </Field>
                {field('deadline', 'Deadline', 'date')}
              </div>
              {field('next', '下一步行动')}
              {draft.kind === '学术论文' &&
                field('targetJournal', '目标期刊（可填写备选及优先顺序）')}
              <div className="field">
                <span>合作者档案</span>
                <div className="student-checks">
                  {data.collaborators.map((person) => (
                    <label className="check-label" key={person.id}>
                      <Checkbox
                        checked={
                          draft.collaboratorIds?.includes(person.id) || false
                        }
                        onCheckedChange={(v) =>
                          set(
                            'collaboratorIds',
                            v
                              ? [...(draft.collaboratorIds || []), person.id]
                              : (draft.collaboratorIds || []).filter(
                                  (id: string) => id !== person.id,
                                ),
                          )
                        }
                      />
                      {person.title}
                      {person.archived ? '（已归档）' : ''}
                    </label>
                  ))}
                  {!data.collaborators.length && (
                    <small>先在侧栏“合作者”中建立档案，再在这里选择。</small>
                  )}
                </div>
              </div>
              {draft.collaborators &&
                field('collaborators', '原合作人员文字（保留）')}
              <label className="check-label">
                <Checkbox
                  checked={!!draft.pinned}
                  onCheckedChange={(v) => set('pinned', !!v)}
                />
                置顶到首页
              </label>
              <div className="field">
                <span>参与学生</span>
                <div className="student-checks">
                  {data.students.length ? (
                    data.students.map((s) => (
                      <label className="check-label" key={s.id}>
                        <Checkbox
                          checked={draft.studentIds?.includes(s.id) || false}
                          onCheckedChange={(v) =>
                            set(
                              'studentIds',
                              v
                                ? [...(draft.studentIds || []), s.id]
                                : (draft.studentIds || []).filter(
                                    (id: string) => id !== s.id,
                                  ),
                            )
                          }
                        />
                        {s.title}
                      </label>
                    ))
                  ) : (
                    <small>添加学生后可在这里关联。</small>
                  )}
                </div>
              </div>
              <div className="field">
                <div className="section-head">
                  <span>项目阶段</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      set('stages', [
                        ...draft.stages,
                        { id: uid(), title: '新阶段', weight: 1, done: false },
                      ])
                    }
                  >
                    <Plus size={14} />
                    添加阶段
                  </Button>
                </div>
                <small>默认等权；权重越大，该阶段占总进度的比例越高。</small>
                {draft.stages.map((s: any, i: number) => (
                  <div className="stage-edit" key={s.id}>
                    <Checkbox
                      aria-label={'阶段完成 ' + (i + 1)}
                      checked={s.done}
                      onCheckedChange={(v) =>
                        set(
                          'stages',
                          draft.stages.map((x: any, j: number) =>
                            i === j ? finishStage(x, !!v, today()) : x,
                          ),
                        )
                      }
                    />
                    <Input
                      aria-label={'阶段名称 ' + (i + 1)}
                      required
                      value={s.title}
                      onChange={(e) =>
                        set(
                          'stages',
                          draft.stages.map((x: any, j: number) =>
                            i === j ? { ...x, title: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <label className="stage-date-field">
                      开始
                      <Input
                        type="date"
                        aria-label={'阶段开始日期 ' + (i + 1)}
                        value={s.start || ''}
                        onChange={(e) =>
                          set(
                            'stages',
                            draft.stages.map((x: any, j: number) =>
                              i === j ? { ...x, start: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="stage-date-field">
                      结束
                      <Input
                        type="date"
                        aria-label={'阶段结束日期 ' + (i + 1)}
                        min={s.start || undefined}
                        disabled={s.end === 'present'}
                        value={s.end === 'present' ? '' : s.end || ''}
                        onChange={(e) =>
                          set(
                            'stages',
                            draft.stages.map((x: any, j: number) =>
                              i === j ? { ...x, end: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="check-label stage-present">
                      <Checkbox
                        aria-label={'阶段至今 ' + (i + 1)}
                        checked={s.end === 'present'}
                        onCheckedChange={(v) =>
                          set(
                            'stages',
                            draft.stages.map((x: any, j: number) =>
                              i === j
                                ? {
                                    ...x,
                                    end: v ? 'present' : '',
                                    done: v ? false : x.done,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      至今
                    </label>
                    <Input
                      aria-label={'阶段权重 ' + (i + 1)}
                      type="number"
                      min="0.01"
                      max="10000"
                      step="0.01"
                      required
                      value={s.weight}
                      onChange={(e) =>
                        set(
                          'stages',
                          draft.stages.map((x: any, j: number) =>
                            i === j
                              ? { ...x, weight: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="移除阶段"
                      onClick={() =>
                        set(
                          'stages',
                          draft.stages.filter((_: any, j: number) => i !== j),
                        )
                      }
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
          {c === 'students' && (
            <>
              <Field label="培养类型">
                <Pick
                  value={draft.kind}
                  onChange={(v) => set('kind', v)}
                  options={groups}
                />
              </Field>
              {field('topic', '研究题目 / 研究方向')}
              <div className="form-grid">
                {field('graduation', '毕业节点', 'date')}
                {field('followup', '下次跟进', 'date')}
              </div>
              {field('feedback', '当前学生反馈')}
            </>
          )}
          {c === 'meetings' && (
            <>
              <div className="form-grid">
                <Field label="组会类型">
                  <Pick
                    value={draft.group}
                    onChange={(v) => set('group', v)}
                    options={['全日制', 'MPA']}
                  />
                </Field>
                {field('date', '日期（可稍后确定）', 'date')}
              </div>
              {field('attendees', '参会人员')}
              <Field label="组会议题">
                <textarea
                  value={draft.agenda || ''}
                  onChange={(e) => set('agenda', e.target.value)}
                />
              </Field>
              <label className="check-label">
                <Checkbox
                  checked={!!draft.completed}
                  onCheckedChange={(v) => set('completed', !!v)}
                />
                组会已完成
              </label>
            </>
          )}
          <div className="field">
            <span>笔记 / 说明</span>
            <Editor
              value={draft.notes || ''}
              onChange={(v) => set('notes', v)}
            />
          </div>
          {data[c].some((x) => x.id === draft.id) && c !== 'tasks' && (
            <label className="check-label">
              <Checkbox
                checked={!!draft.archived}
                onCheckedChange={(v) => set('archived', !!v)}
              />
              归档此记录（仍保留全部内容）
            </label>
          )}
          {err && (
            <p className="error-text" role="alert">
              {err}
            </p>
          )}
          <div className="form-footer">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              取消
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? '正在保存…' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Guidance({
  student,
  save,
  addTask,
}: {
  student: Item;
  save: (x: any) => Promise<void>;
  addTask: () => void;
}) {
  const [draft, setDraft] = useState<any>(null),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const records = student.guidance || [];
  return (
    <section className="panel">
      <div className="section-head">
        <h2>指导记录</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft({
              id: uid(),
              date: today(),
              content: '',
              feedback: '',
              followup: student.followup || '',
            })
          }
        >
          <Plus size={15} />
          记录一次指导
        </Button>
      </div>
      {student.feedback && (
        <p className="feedback-summary">当前反馈 · {student.feedback}</p>
      )}
      {records.length ? (
        <div className="guidance-list">
          {[...records]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((r) => (
              <article key={r.id}>
                <div className="section-head">
                  <strong>{r.date}</strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDraft({ ...r })}
                  >
                    <Pencil size={14} />
                    编辑
                  </Button>
                </div>
                <Markdown value={r.content} />
                {r.feedback && (
                  <p className="feedback-summary">学生反馈 · {r.feedback}</p>
                )}
                {r.followup && <small>约定跟进：{r.followup}</small>}
              </article>
            ))}
        </div>
      ) : (
        <Blank
          title="每一次讨论，都留下下一步"
          desc="记录指导内容、学生反馈和约定的跟进日期。"
        />
      )}
      <Button variant="ghost" size="sm" onClick={addTask}>
        <Plus size={15} />
        为学生布置任务
      </Button>
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v && !busy) setDraft(null);
        }}
      >
        <DialogContent className="record-dialog">
          <DialogTitle>指导记录 · {student.title}</DialogTitle>
          <DialogDescription>
            保存后同步更新学生的跟进日期与当前反馈。
          </DialogDescription>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setErr('');
                try {
                  await save({
                    guidance: records.some((r: any) => r.id === draft.id)
                      ? records.map((r: any) => (r.id === draft.id ? draft : r))
                      : [...records, draft],
                    followup: draft.followup,
                    feedback: draft.feedback,
                  });
                  setDraft(null);
                } catch (e: any) {
                  setErr(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                <Field label="指导日期">
                  <Input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                  />
                </Field>
                <Field label="下次跟进">
                  <Input
                    type="date"
                    value={draft.followup}
                    onChange={(e) =>
                      setDraft({ ...draft, followup: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Editor
                value={draft.content}
                onChange={(v) => setDraft({ ...draft, content: v })}
              />
              <Field label="学生反馈">
                <textarea
                  value={draft.feedback}
                  onChange={(e) =>
                    setDraft({ ...draft, feedback: e.target.value })
                  }
                />
              </Field>
              {err && <p className="error-text">{err}</p>}
              <div className="form-footer">
                <Button type="submit" disabled={busy}>
                  {busy ? '保存中…' : '保存指导记录'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function Files({
  collection,
  item,
  save,
  notify,
}: {
  collection: Collection | 'affairs';
  item: Item;
  save: (v: string) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [result, setResult] = useState<any>(null),
    [relative, setRelative] = useState(''),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState(false),
    [folder, setFolder] = useState(item.folder || '');
  const load = useCallback(
    async (path = '') => {
      setBusy(true);
      setErr('');
      try {
        const r = await api(
          `files?collection=${collection}&id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(path)}`,
        );
        setResult(r);
        setRelative(r.path);
      } catch (e: any) {
        setErr(e.message);
        setResult(null);
      } finally {
        setBusy(false);
      }
    },
    [collection, item.id, item.folder],
  );
  useEffect(() => {
    if (item.folder) void load('');
    else setResult(null);
  }, [load, item.folder]);
  async function open(path: string) {
    try {
      await api('open', { collection, id: item.id, path });
      notify('已交给本机默认软件打开');
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>
          <FolderOpen size={19} />
          {collection === 'affairs' ? item.title + ' · 本地文件' : '本地文件'}
        </h2>
        <div className="button-row">
          {item.folder && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => load(relative)}
                aria-label="刷新文件"
              >
                <RefreshCw size={15} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => open(relative)}
              >
                在 Finder 中打开 <ExternalLink size={14} />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFolder(item.folder || '');
              setDialog(true);
            }}
          >
            {item.folder ? '更换文件夹' : '关联文件夹'}
          </Button>
        </div>
      </div>
      {item.folder && (
        <div className="folder-path" title={item.folder}>
          {item.folder}
          {relative && ' / ' + relative}
        </div>
      )}
      {err && (
        <p className="error-text" role="alert">
          {err}
        </p>
      )}
      {busy ? (
        <p className="settings-copy">正在读取文件夹…</p>
      ) : result ? (
        <>
          <div className="file-crumb">
            <button onClick={() => load('')}>根目录</button>
            {relative
              .split('/')
              .filter(Boolean)
              .map((s, i) => (
                <span key={i}>
                  <ChevronRight size={13} />
                  <button
                    onClick={() =>
                      load(
                        relative
                          .split('/')
                          .slice(0, i + 1)
                          .join('/'),
                      )
                    }
                  >
                    {s}
                  </button>
                </span>
              ))}
          </div>
          {result.entries.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件名</TableHead>
                  <TableHead>修改时间</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.entries.map((f: any) => (
                  <TableRow key={f.path}>
                    <TableCell>
                      <button
                        className="file-name"
                        onClick={() =>
                          f.directory ? load(f.path) : open(f.path)
                        }
                      >
                        {f.directory ? (
                          <Folder size={19} />
                        ) : (
                          <FileText size={19} />
                        )}
                        <span>{f.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <small>{f.modified.slice(0, 16).replace('T', ' ')}</small>
                    </TableCell>
                    <TableCell>
                      <small>
                        {f.directory
                          ? '—'
                          : f.size > 1024 * 1024
                            ? (f.size / 1024 / 1024).toFixed(1) + ' MB'
                            : Math.ceil(f.size / 1024) + ' KB'}
                      </small>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          f.directory ? load(f.path) : open(f.path)
                        }
                        aria-label={'打开 ' + f.name}
                      >
                        {f.directory ? (
                          <ChevronRight size={15} />
                        ) : (
                          <ExternalLink size={15} />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Blank title="文件夹为空" />
          )}
        </>
      ) : !item.folder ? (
        <Blank
          title="连接资料所在的文件夹"
          desc="浏览子文件夹，点击文件即可使用本机 Word、Excel 等软件打开。"
        />
      ) : null}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="folder-dialog">
          <DialogTitle>关联本地文件夹</DialogTitle>
          <DialogDescription>
            原文件保留原处。可以选择文件夹，或粘贴完整路径。
          </DialogDescription>
          <Input
            aria-label="文件夹路径"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="/Users/…/我的项目"
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api('choose-folder', {});
                if (r.path) setFolder(r.path);
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <FolderOpen />
            选择文件夹
          </Button>
          <Button
            disabled={busy || !folder.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const checked = await api('check-folder', {
                  path: folder.trim(),
                });
                await save(checked.path);
                setDialog(false);
              } catch (e: any) {
                setErr(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            保存关联
          </Button>
          {err && (
            <p className="error-text" role="alert">
              {err}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
