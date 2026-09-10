'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Pencil } from 'lucide-react';
import { today } from '@/lib/desk';
import {
  dateDay,
  dayDate,
  ganttRange,
  stageEnd,
  finishStage,
  type Stage,
} from '@/lib/gantt';
export function ProjectGantt({
  stages,
  deadline,
  save,
  editAll,
}: {
  stages: Stage[];
  deadline: string;
  save: (stages: Stage[]) => Promise<void>;
  editAll: () => void;
}) {
  const [scale, setScale] = useState('week'),
    [draft, setDraft] = useState<Stage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [now, setNow] = useState(today);
  useEffect(() => {
    const refresh = () => setNow(today());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const { start, end } = ganttRange(stages, deadline, now);
  const days = end - start + 1;
  const cell = Math.min(
    scale === 'day' ? 32 : scale === 'week' ? 12 : 4,
    50000 / days,
  );
  const width = Math.max(720, days * cell);
  const px = width / days;
  const tick = scale === 'day' ? 1 : scale === 'week' ? 7 : 30;
  const ticks = Array.from(
    { length: Math.ceil(days / tick) },
    (_, i) => start + i * tick,
  );
  const current = dateDay(now),
    due = deadline ? dateDay(deadline) : NaN;
  const months = [];
  let cursor = start;
  while (cursor <= end) {
    const d = new Date(cursor * 86400000),
      next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 86400000;
    months.push({
      day: cursor,
      end: Math.min(end + 1, next),
      label: `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月`,
    });
    cursor = next;
  }
  return (
    <>
      <div className="section-head">
        <h2>项目甘特图</h2>
        <div className="button-row">
          <Tabs value={scale} onValueChange={setScale}>
            <TabsList>
              <TabsTrigger value="day">日</TabsTrigger>
              <TabsTrigger value="week">周</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={editAll}>
            <Pencil size={14} />
            编辑阶段
          </Button>
        </div>
      </div>
      <p className="gantt-hint">
        点击阶段或时间条调整起止日期。完成状态仍按阶段权重计算总进度。
      </p>
      <div className="gantt-scroll">
        <div className="gantt-board" style={{ width: width + 260 }}>
          <div className="gantt-label-head">阶段 / 完成状态</div>
          <div className="gantt-axis" style={{ width }}>
            <div className="gantt-months">
              {months.map((m) => (
                <span
                  key={m.day}
                  style={{
                    left: (m.day - start) * px,
                    width: (m.end - m.day) * px,
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div className="gantt-ticks">
              {ticks.map((d) => (
                <span key={d} style={{ left: (d - start) * px }}>
                  {dayDate(d).slice(5).replace('-', '/')}
                </span>
              ))}
            </div>
          </div>
          {stages.map((s) => {
            const dated = !!s.start && !!s.end;
            const a = dated ? dateDay(s.start!) : 0,
              b = dated ? dateDay(stageEnd(s, now)) : 0;
            const state = s.done
              ? 'done'
              : dated && s.end !== 'present' && b < current
                ? 'overdue'
                : dated && a <= current
                  ? 'active'
                  : 'planned';
            return (
              <div className="gantt-row" key={s.id}>
                <div className="gantt-label">
                  <Checkbox
                    aria-label={'完成阶段 ' + s.title}
                    checked={s.done}
                    disabled={busy}
                    onCheckedChange={async (v) => {
                      setBusy(true);
                      setError('');
                      try {
                        await save(
                          stages.map((x) =>
                            x.id === s.id ? finishStage(x, !!v, now) : x,
                          ),
                        );
                      } catch (e) {
                        setError(e instanceof Error ? e.message : '保存失败');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      setError('');
                      setDraft({ ...s });
                    }}
                  >
                    <strong>{s.title}</strong>
                    <small>
                      {dated
                        ? `${s.start} — ${s.end === 'present' ? '至今' : s.end}`
                        : '待安排日期'}{' '}
                      ·{' '}
                      {s.done
                        ? '已完成'
                        : state === 'overdue'
                          ? '已逾期'
                          : state === 'active'
                            ? '进行中'
                            : '未完成'}
                    </small>
                  </button>
                </div>
                <div
                  className="gantt-track"
                  style={{ width, backgroundSize: `${tick * px}px 100%` }}
                >
                  {current >= start && current <= end && (
                    <span
                      className="gantt-today"
                      style={{ left: (current - start + 0.5) * px }}
                    />
                  )}
                  {Number.isFinite(due) && due >= start && due <= end && (
                    <span
                      className="gantt-deadline"
                      style={{ left: (due - start + 1) * px }}
                    />
                  )}
                  {dated ? (
                    <button
                      className={'gantt-bar ' + state}
                      style={{
                        left: (a - start) * px,
                        width: Math.max((b - a + 1) * px, 4),
                      }}
                      title={`${s.title}：${s.start} 至 ${s.end === 'present' ? '今' : s.end}`}
                      aria-label={`调整 ${s.title} 日期，${s.start} 至 ${s.end === 'present' ? '今' : s.end}`}
                      onClick={() => {
                        setError('');
                        setDraft({ ...s });
                      }}
                    >
                      <span>{s.title}</span>
                    </button>
                  ) : (
                    <button
                      className="gantt-unscheduled"
                      onClick={() => {
                        setError('');
                        setDraft({ ...s });
                      }}
                    >
                      <CalendarDays size={14} />
                      设置起止日期
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!stages.length && (
            <p className="gantt-empty">暂无阶段，点击“编辑阶段”添加。</p>
          )}
        </div>
      </div>
      <div className="gantt-legend">
        <span>
          <i className="done" />
          已完成
        </span>
        <span>
          <i className="active" />
          进行中
        </span>
        <span>
          <i className="planned" />
          计划中
        </span>
        <span>
          <i className="overdue" />
          逾期
        </span>
        <span>实线：今天</span>
        {deadline && <span>虚线：项目截止 {deadline}</span>}
      </div>
      {error && !draft && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v && !busy) setDraft(null);
        }}
      >
        <DialogContent className="folder-dialog">
          <DialogTitle>安排阶段 · {draft?.title}</DialogTitle>
          <DialogDescription>
            日期决定甘特图位置，完成状态决定项目进度。
          </DialogDescription>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                if (
                  !!draft.start !== !!draft.end ||
                  (draft.start &&
                    draft.end &&
                    draft.start > stageEnd(draft, now))
                ) {
                  setError(
                    '请填写开始日期及结束日期（或选择至今）；结束不能早于开始。',
                  );
                  return;
                }
                setBusy(true);
                try {
                  await save(
                    stages.map((s) => (s.id === draft.id ? draft : s)),
                  );
                  setDraft(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : '保存失败');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                <label className="field">
                  开始日期
                  <Input
                    type="date"
                    value={draft.start || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, start: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  结束日期
                  <Input
                    type="date"
                    min={draft.start || undefined}
                    disabled={draft.end === 'present'}
                    value={draft.end === 'present' ? '' : draft.end || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, end: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="check-label">
                <Checkbox
                  checked={draft.end === 'present'}
                  onCheckedChange={(v) =>
                    setDraft({
                      ...draft,
                      end: v ? 'present' : '',
                      done: v ? false : draft.done,
                    })
                  }
                />
                至今（仍在进行，不设结束日期）
              </label>
              <label className="check-label">
                <Checkbox
                  checked={draft.done}
                  onCheckedChange={(v) =>
                    setDraft(finishStage(draft, !!v, now))
                  }
                />
                阶段已完成
              </label>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
              <div className="form-footer">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDraft({ ...draft, start: '', end: '' })}
                >
                  清除日期
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? '保存中…' : '保存安排'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
