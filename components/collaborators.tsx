'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Editor, Markdown } from '@/components/desk-editor';
import { ArrowLeft, ArrowUpRight, Plus, Pencil, Building2 } from 'lucide-react';
import { uid, progress, type State, type Item } from '@/lib/desk';
export function Collaborators({
  data,
  selected,
  select,
  openProject,
  save,
}: {
  data: State;
  selected: string;
  select: (id: string) => void;
  openProject: (id: string) => void;
  save: (item: Item) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Item | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(''),
    [archived, setArchived] = useState(false);
  const person = data.collaborators.find((x) => x.id === selected);
  const projects = (id: string) =>
    data.projects.filter((p) => p.collaboratorIds?.includes(id));
  const start = (p?: Item) => {
    setErr('');
    setDraft(
      p
        ? structuredClone(p)
        : {
            id: uid(),
            title: '',
            institution: '',
            position: '',
            research: '',
            contact: '',
            notes: '',
            archived: false,
          },
    );
  };
  return (
    <>
      {person ? (
        <>
          <Button
            className="back-button"
            variant="ghost"
            onClick={() => select('')}
          >
            <ArrowLeft size={16} />
            返回合作者
          </Button>
          <div className="detail-cover monet" />
          <div className="document-title">
            <div>
              <p className="eyebrow">
                合作者档案{person.archived ? ' · 已归档' : ''}
              </p>
              <h1>{person.title}</h1>
            </div>
            <Button variant="outline" onClick={() => start(person)}>
              <Pencil size={15} />
              编辑档案
            </Button>
          </div>
          <div className="metadata-grid">
            <div>
              <small>单位 / 机构</small>
              <strong>{person.institution || '待补充'}</strong>
            </div>
            <div>
              <small>职务 / 职称</small>
              <strong>{person.position || '待补充'}</strong>
            </div>
            <div>
              <small>研究方向</small>
              <strong>{person.research || '待补充'}</strong>
            </div>
            <div>
              <small>联系方式</small>
              <strong>{person.contact || '待补充'}</strong>
            </div>
          </div>
          <section className="panel">
            <h2>
              合作项目 <small>{projects(person.id).length} 个</small>
            </h2>
            {projects(person.id).length ? (
              projects(person.id).map((p) => (
                <button
                  className="reminder"
                  key={p.id}
                  onClick={() => openProject(p.id)}
                >
                  <span>
                    {p.title}
                    <small>
                      {' '}
                      · {p.kind}
                      {p.archived ? ' · 已归档' : ''}
                    </small>
                  </span>
                  <span>
                    {progress(p)}% <ArrowUpRight size={15} />
                  </span>
                </button>
              ))
            ) : (
              <p className="settings-copy">
                在项目的“编辑信息”中选择这位合作者，项目会自动显示在这里。
              </p>
            )}
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>合作记录与备注</h2>
              <Button variant="ghost" size="sm" onClick={() => start(person)}>
                编辑记录
              </Button>
            </div>
            <Markdown
              value={
                person.notes || '暂无记录。可记录沟通内容、分工与合作约定。'
              }
            />
          </section>
        </>
      ) : (
        <>
          <section className="cover monet">
            <div>
              <p>PEOPLE & COLLABORATION</p>
              <h1>合作者</h1>
            </div>
          </section>
          <div className="page-title">
            <label className="check-label">
              <Checkbox
                checked={archived}
                onCheckedChange={(v) => setArchived(!!v)}
              />
              已归档
            </label>
            <Button onClick={() => start()}>
              <Plus />
              添加合作者
            </Button>
          </div>
          <div className="collaborator-grid">
            {data.collaborators
              .filter((p) => !!p.archived === archived)
              .map((p) => (
                <button
                  className="collaborator-card"
                  key={p.id}
                  onClick={() => select(p.id)}
                >
                  <div className="flex-between">
                    <span className="person-avatar">{p.title.slice(0, 1)}</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <h2>{p.title}</h2>
                  <p>
                    <Building2 size={14} />
                    {p.institution || '单位待补充'}
                  </p>
                  <p>{p.research || '研究方向待补充'}</p>
                  <small>{projects(p.id).length} 个合作项目</small>
                </button>
              ))}
          </div>
          {!data.collaborators.some((p) => !!p.archived === archived) && (
            <section className="panel empty-state">
              {archived
                ? '暂无归档档案'
                : '添加合作者，集中记录研究方向、联系方式和合作项目。'}
            </section>
          )}
        </>
      )}
      <Dialog
        open={!!draft}
        onOpenChange={(v) => {
          if (!v && !busy) setDraft(null);
        }}
      >
        <DialogContent className="record-dialog">
          <DialogTitle>{draft?.title || '新建合作者'} · 档案</DialogTitle>
          <DialogDescription>
            保存基本信息、研究方向与合作记录。项目关联在项目编辑页设置。
          </DialogDescription>
          {draft && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draft.title.trim()) {
                  setErr('请填写姓名');
                  return;
                }
                setBusy(true);
                setErr('');
                try {
                  await save({ ...draft, title: draft.title.trim() });
                  setDraft(null);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : '保存失败');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="form-grid">
                {[
                  ['title', '姓名'],
                  ['institution', '单位 / 机构'],
                  ['position', '职务 / 职称'],
                  ['contact', '联系方式'],
                  ['research', '研究方向'],
                ].map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <Input
                      value={draft[key] || ''}
                      required={key === 'title'}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="field">
                <span>合作记录与备注</span>
                <Editor
                  value={draft.notes || ''}
                  onChange={(v) => setDraft({ ...draft, notes: v })}
                />
              </div>
              <label className="check-label">
                <Checkbox
                  checked={!!draft.archived}
                  onCheckedChange={(v) => setDraft({ ...draft, archived: !!v })}
                />
                归档档案（保留项目关联）
              </label>
              {err && (
                <p role="alert" className="error-text">
                  {err}
                </p>
              )}
              <div className="form-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                  disabled={busy}
                >
                  取消
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? '保存中…' : '保存档案'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
