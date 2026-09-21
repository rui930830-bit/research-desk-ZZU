'use client';
import { useState, useEffect, useRef } from 'react';
import { orderCollaborators, activeProjects } from '@/lib/collaborator-order';
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
  remove,
}: {
  data: State;
  selected: string;
  select: (id: string) => void;
  openProject: (id: string) => void;
  save: (item: Item) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Item | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(''),
    [archived, setArchived] = useState(false),
    [sortModes, setSortModes] = useState<Record<string,string>>({active:'project',potential:'project'});
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem('desk-collaborator-sorts')||'{}');setSortModes({active:value.active==='title'?'title':'project',potential:value.potential==='title'?'title':'project'});}catch{}},[]);
  function changeSort(group:string,value:string){const next={...sortModes,[group]:value};setSortModes(next);try{localStorage.setItem('desk-collaborator-sorts',JSON.stringify(next));}catch{}}

  const operation = useRef(false);
  async function deletePerson(id: string) {
    if (operation.current) return;
    const target = data.collaborators.find(p => p.id === id);
    if (!target) return;
    if (!window.confirm(`删除合作者“${target.title}”？\n档案及其中的联系方式、备注将被删除，并解除项目和任务关联。相关项目、任务及其中记录的姓名仍保留。`)) return;
    operation.current = true; setBusy(true); setErr('');
    try { await remove(id); setDraft(null); select(''); }
    catch (e) { setErr(e instanceof Error ? e.message : '删除失败，请重试'); }
    finally { operation.current = false; setBusy(false); }
  }
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
      {!draft && err && <p className="error-text" role="alert">{err}</p>}
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
                {person.relationship==='potential'?'潜在合作者':'合作者'}档案{person.archived ? ' · 已归档' : ''}
              </p>
              <h1>{person.title}</h1>
            </div>
            <div className="button-row">
              <Button variant="outline" disabled={busy} onClick={() => start(person)}><Pencil size={15} />编辑档案</Button>
              <Button variant="destructive" disabled={busy} onClick={() => void deletePerson(person.id)}>{busy ? '处理中…' : '删除合作者'}</Button>
            </div>
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
          <section className="panel"><h2>协助评阅记录</h2>{data.tasks.filter(t=>t.requesterId===person.id&&t.affairsType==='协助评阅').map(t=><p key={t.id}>{t.title} · {t.done?'已完成':'待办'}{t.deadline?' · '+t.deadline:''}</p>)}{!data.tasks.some(t=>t.requesterId===person.id&&t.affairsType==='协助评阅')&&<p>暂无协助评阅记录</p>}</section>
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
          {(['active','potential'] as const).map(group=>{
            const label=group==='active'?'合作者':'潜在合作者';
            const people=orderCollaborators(data.collaborators.filter(p=>!!p.archived===archived&&(p.relationship==='potential'?'potential':'active')===group),data.projects,sortModes[group]);
            return <section key={group} className="collaborator-section">
              <div className="section-head"><h2>{label} <small>{people.length} 人</small></h2>
                <label className="collaborator-sort">排序<select aria-label={label+'排序'} value={sortModes[group]} onChange={e=>changeSort(group,e.target.value)}><option value="project">按项目优先情况</option><option value="title">按职称</option></select></label>
              </div>
              <div className="collaborator-grid">{people.map(p=><button className="collaborator-card" key={p.id} onClick={()=>select(p.id)}>
                <div className="flex-between"><span className="person-avatar">{p.title.slice(0,1)}</span><ArrowUpRight size={18}/></div>
                <h2>{p.title}</h2><p>{p.position||'职称待补充'}</p>
                <p><Building2 size={14}/>{p.institution||'单位待补充'}</p><p>{p.research||'研究方向待补充'}</p>
                <small>{activeProjects(p,data.projects).length} 个进行中项目 · {projects(p.id).length} 个合作项目</small>
              </button>)}</div>
              {!people.length&&<div className="panel empty-state">暂无{archived?'已归档的':''}{label}</div>}
            </section>;
          })}
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
                if (operation.current) return;
                if (!draft.title.trim()) {
                  setErr('请填写姓名');
                  return;
                }
                operation.current = true;
                setBusy(true);
                setErr('');
                try {
                  await save({ ...draft, title: draft.title.trim() });
                  setDraft(null);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : '保存失败');
                } finally {
                  operation.current = false;
                  setBusy(false);
                }
              }}
            >
              <label className="field">合作关系<select value={draft.relationship||'active'} onChange={e=>setDraft({...draft,relationship:e.target.value})}><option value="active">合作者</option><option value="potential">潜在合作者</option></select></label>
              <label className="field">职称排序级别<select value={draft.titleLevel||'auto'} onChange={e=>setDraft({...draft,titleLevel:e.target.value})}><option value="auto">根据职称自动识别</option><option value="1">正高级</option><option value="2">副高级</option><option value="3">中级</option><option value="4">初级</option><option value="5">其他 / 暂未确定</option></select></label>
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
                {data.collaborators.some(p => p.id === draft.id) && <Button type="button" variant="destructive" disabled={busy} style={{marginRight:'auto'}} onClick={() => void deletePerson(draft.id)}>删除合作者</Button>}
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
