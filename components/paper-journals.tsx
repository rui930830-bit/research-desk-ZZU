'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Plus, Pencil, BookOpen } from 'lucide-react';
import { uid } from '@/lib/desk';
export type Submission = {
  id: string;
  journal: string;
  submitted: string;
  status: string;
  resultDate: string;
  manuscriptNo: string;
  notes: string;
};
const statuses = [
  '已投稿',
  '编辑处理中',
  '外审中',
  '大修',
  '小修',
  '退稿',
  '撤稿',
  '录用',
  '已发表',
];
export function PaperJournals({
  target,
  submissions,
  save,
}: {
  target: string;
  submissions: Submission[];
  save: (fields: {
    targetJournal?: string;
    submissions?: Submission[];
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Submission | null>(null),
    [targetDraft, setTargetDraft] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const accepted = submissions.filter((s) =>
    ['录用', '已发表'].includes(s.status),
  );
  const rows = submissions
    .map((s, i) => ({ ...s, index: i }))
    .sort(
      (a, b) =>
        (b.submitted || '').localeCompare(a.submitted || '') ||
        b.index - a.index,
    );
  function edit(s?: Submission) {
    setError('');
    setDraft(
      s
        ? { ...s }
        : {
            id: uid(),
            journal: '',
            submitted: '',
            status: '已投稿',
            resultDate: '',
            manuscriptNo: '',
            notes: '',
          },
    );
  }
  return (
    <section className="panel">
      <div className="section-head">
        <h2>
          <BookOpen size={18} />
          论文去处
        </h2>
        <Button size="sm" variant="outline" onClick={() => edit()}>
          <Plus size={15} />
          新增投稿
        </Button>
      </div>
      <div className="journal-target">
        <div>
          <small>目标期刊</small>
          <p>{target || '尚未确定'}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setError('');
            setTargetDraft(target);
          }}
        >
          <Pencil size={14} />
          编辑目标
        </Button>
      </div>
      {accepted.length > 0 && (
        <div className="journal-accepted">
          {accepted.map((s) => (
            <span key={s.id}>
              {s.status} · {s.journal}
              {s.resultDate ? ' · ' + s.resultDate : ''}
            </span>
          ))}
        </div>
      )}
      <div className="section-head">
        <h3>
          投稿记录 <small>{submissions.length} 次</small>
        </h3>
        <small>每次转投新增一条，保留之前的结果</small>
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              {[
                '投稿期刊',
                '投稿日期',
                '状态 / 结果',
                '反馈或结果日期',
                '稿件编号',
                '',
              ].map((x, i) => (
                <TableHead key={i}>{x}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <strong>{s.journal}</strong>
                  {s.notes && <p className="journal-note">{s.notes}</p>}
                </TableCell>
                <TableCell>{s.submitted || '待补充'}</TableCell>
                <TableCell>
                  <span
                    className={
                      'journal-status ' +
                      (['录用', '已发表'].includes(s.status)
                        ? 'accepted'
                        : s.status === '退稿'
                          ? 'rejected'
                          : '')
                    }
                  >
                    {s.status}
                  </span>
                </TableCell>
                <TableCell>{s.resultDate || '—'}</TableCell>
                <TableCell>{s.manuscriptNo || '—'}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => edit(s)}
                    aria-label={'编辑 ' + s.journal + ' 的投稿记录'}
                  >
                    <Pencil size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="settings-copy">
          尚无投稿记录。目标期刊用于计划，实际投向的每家期刊分别留档。
        </p>
      )}
      <Dialog
        open={targetDraft !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setTargetDraft(null);
        }}
      >
        <DialogContent className="folder-dialog">
          <DialogTitle>目标期刊</DialogTitle>
          <DialogDescription>
            可填写一个或多个备选期刊、优先顺序。调整目标不会改变投稿记录。
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await save({ targetJournal: (targetDraft || '').trim() });
                setTargetDraft(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : '保存失败');
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              期刊与计划
              <textarea
                value={targetDraft || ''}
                onChange={(e) => setTargetDraft(e.target.value)}
                placeholder="首选期刊、备选期刊……"
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <div className="form-footer">
              <Button disabled={busy} type="submit">
                保存目标
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v && !busy) setDraft(null);
        }}
      >
        <DialogContent className="record-dialog">
          <DialogTitle>
            {draft && submissions.some((s) => s.id === draft.id)
              ? '编辑投稿记录'
              : '新增投稿记录'}
          </DialogTitle>
          <DialogDescription>
            同一期刊的审稿进展更新在本条记录中；转投其他期刊时新增一条。
          </DialogDescription>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                if (!draft.journal.trim()) {
                  setError('请填写投稿期刊');
                  return;
                }
                if (
                  draft.submitted &&
                  draft.resultDate &&
                  draft.resultDate < draft.submitted
                ) {
                  setError('反馈或结果日期不能早于投稿日期');
                  return;
                }
                setBusy(true);
                try {
                  const row = { ...draft, journal: draft.journal.trim() };
                  await save({
                    submissions: submissions.some((s) => s.id === draft.id)
                      ? submissions.map((s) => (s.id === draft.id ? row : s))
                      : [...submissions, row],
                  });
                  setDraft(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : '保存失败');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="field">
                投稿期刊
                <Input
                  required
                  value={draft.journal}
                  onChange={(e) =>
                    setDraft({ ...draft, journal: e.target.value })
                  }
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  投稿日期（可稍后补充）
                  <Input
                    type="date"
                    value={draft.submitted}
                    onChange={(e) =>
                      setDraft({ ...draft, submitted: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  当前状态 / 结果
                  <Select
                    value={draft.status}
                    onValueChange={(v) =>
                      setDraft({ ...draft, status: String(v) })
                    }
                  >
                    <SelectTrigger className="pick">
                      <SelectValue>{draft.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="field">
                  反馈或结果日期
                  <Input
                    type="date"
                    min={draft.submitted || undefined}
                    value={draft.resultDate}
                    onChange={(e) =>
                      setDraft({ ...draft, resultDate: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  稿件编号
                  <Input
                    value={draft.manuscriptNo}
                    onChange={(e) =>
                      setDraft({ ...draft, manuscriptNo: e.target.value })
                    }
                  />
                </label>
              </div>
              <label className="field">
                备注 / 审稿意见
                <textarea
                  value={draft.notes}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                  placeholder="记录退稿原因、修改要求、后续打算等。"
                />
              </label>
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              <div className="form-footer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDraft(null)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? '保存中…' : '保存投稿记录'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
