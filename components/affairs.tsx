'use client';
import { isOverdue } from '@/lib/task-display';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, CalendarDays } from 'lucide-react';
import { type Item, today } from '@/lib/desk';
export const affairTypes = ['行政任务', '期刊审稿', '学生工作', '协助评阅'];
export function Affairs({
  tasks,
  folders,
  renderFiles,
  create,
  edit,
  patch,
}: {
  tasks: Item[];
  folders: Record<string, string>;
  renderFiles: (kind: string) => ReactNode;
  create: (kind: string) => void;
  edit: (task: Item) => void;
  patch: (id: string, fields: Partial<Item>) => Promise<void>;
}) {
  const [kind, setKind] = useState('全部'),
    [state, setState] = useState('待办'),
    [error, setError] = useState('');
  const all = tasks.filter((t) => t.affairsType && !t.archived);
  const rows = all
    .filter(
      (t) =>
        (kind === '全部' || t.affairsType === kind) &&
        (state === '已完成' ? t.done : !t.done),
    )
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION · REVIEW · TEACHING</p>
          <h1>事务管理</h1>
        </div>
        <Button onClick={() => create(kind === '全部' ? '行政任务' : kind)}>
          <Plus />
          新增事务
        </Button>
      </div>
      <div className="affair-overview">
        {affairTypes.map((k) => (
          <button
            key={k}
            className={kind === k ? 'selected' : ''}
            onClick={() => setKind(kind === k ? '全部' : k)}
          >
            <small>{k}</small>
            <strong>
              {all.filter((t) => t.affairsType === k && !t.done).length}
            </strong>
            <span>待办</span>
            <small className="affair-folder-hint">
              {folders[k] ? '查看关联文件夹 →' : '关联文件夹 →'}
            </small>
          </button>
        ))}
      </div>
      <div className="section-head">
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            {['全部', ...affairTypes].map((k) => (
              <TabsTrigger value={k} key={k}>
                {k}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={state} onValueChange={setState}>
          <TabsList>
            <TabsTrigger value="待办">待办</TabsTrigger>
            <TabsTrigger value="已完成">已完成</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <p className="settings-copy">
        事务与日常任务共用同一条记录，安排到“今天”即可在首页看到。协助评阅的求助人会自动加入潜在合作者档案。
      </p>
      {kind !== '全部' && (
        <div className="affair-files">{renderFiles(kind)}</div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        {rows.length ? (
          rows.map((t) => (
            <article className="affair-row" key={t.id}>
              <Checkbox
                aria-label={'完成 ' + t.title}
                checked={t.done}
                onCheckedChange={(v) =>
                  void patch(t.id, { done: !!v }).catch((e) =>
                    setError(e.message),
                  )
                }
              />
              <button className="affair-description" onClick={() => edit(t)}>
                <strong>
                  {t.title}{' '}
                  {t.isTemporary && <em className="temporary-badge">临时</em>}
                </strong>
                <small>
                  {t.affairsType} · {t.bucket}
                  {t.ownerName ? ' · 负责人：' + t.ownerName : ''}
                  {t.requester ? ' · 发起方：' + t.requester : ''}
                </small>
                {t.affairsType === '期刊审稿' && (
                  <p>
                    {t.reviewJournal} · {t.manuscriptTitle}
                    {t.reviewNumber ? ' · ' + t.reviewNumber : ''}
                  </p>
                )}
                {t.affairsType === '协助评阅' && (
                  <p>
                    {t.assistanceType || '论文'}
                    {t.manuscriptTitle ? ' · ' + t.manuscriptTitle : ''}
                  </p>
                )}
              </button>
              <span
                className={
                  'due ' +
                  (isOverdue(t.deadline, !!t.done, today()) ? 'late' : '')
                }
              >
                <CalendarDays size={14} />
                {t.deadline || '未设截止日期'}
              </span>
              {!t.done && t.bucket !== '今天' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void patch(t.id, { bucket: '今天' }).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  今天做
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label={'编辑 ' + t.title}
                onClick={() => edit(t)}
              >
                <Pencil size={15} />
              </Button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            {state === '已完成' ? '暂无已完成事务' : '暂无待办事务'}
            <small>可以记录学院交办、期刊审稿、谈话备课和受托评阅。</small>
            <Button
              variant="outline"
              onClick={() => create(kind === '全部' ? '行政任务' : kind)}
            >
              <Plus />
              新增事务
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
