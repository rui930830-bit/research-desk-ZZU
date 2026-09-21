'use client';
import { classificationOf, workTypesFor } from '@/lib/work-classification';
import { affairKind, partyName, counts, affairParties, assignAffairProject, saveAffairProject, deleteAffairProject } from '@/lib/affairs-hierarchy';
import { isOverdue } from '@/lib/task-display';
import { useState, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Pencil, CalendarDays, ArrowRight, ArrowLeft } from 'lucide-react';
import { type Item, type State, today, uid } from '@/lib/desk';
export const affairTypes = workTypesFor('事务管理');
export function Affairs({ data, folders, renderFiles, create, edit, patch, mutate }: {
  data: State;
  folders: Record<string, string>;
  renderFiles: (kind: string) => ReactNode;
  create: (kind: string, context?: Partial<Item>) => void;
  edit: (task: Item) => void;
  patch: (id: string, fields: Partial<Item>) => Promise<void>;
  mutate: (fn: (state: State) => State) => Promise<void>;
}) {
  const [kind, setKind] = useState('全部'), [status, setStatus] = useState('全部');
  const [party, setParty] = useState<string | null>(null), [projectId, setProjectId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState<Item | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inFlight = useRef(false), projectOriginal = useRef<string | null>(null);
  const all = data.tasks.filter(t => classificationOf(t).taskCategory === '事务管理' && !t.archived);
  const projects = data.affairProjects || [];
  const source = all.filter(t => kind === '待细分' ? !affairKind(t) : affairKind(t) === kind);
  const isAdmin = kind === '行政任务';
  const grouped = ['行政任务', '期刊审稿', '协助评阅'].includes(kind);
  const partyLabel = kind === '期刊审稿' ? '期刊' : kind === '协助评阅' ? '求助人' : '发起人 / 部门';
  const missingParty = kind === '期刊审稿' ? '未填写期刊' : kind === '协助评阅' ? '未填写求助人' : '未填写发起方';
  const partyTitle = party || missingParty;
  const selectedProject = projects.find(p => p.id === projectId);
  const partyTasks = source.filter(t => partyName(t, kind) === party);
  const partyProjects = projects.filter(p => p.requester.trim() === party);
  const leaf = kind !== '全部' && (!grouped || (party !== null && (!isAdmin || projectId !== null)));
  const leafTasks = grouped ? (isAdmin ? partyTasks.filter(t => (t.affairProjectId || '') === projectId) : partyTasks) : source;
  const rows = leafTasks.filter(t => status === '全部' || (status === '已完成' ? t.done : !t.done))
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const hasUnclassified = all.some(t => !affairKind(t));
  const parties = affairParties(source, isAdmin ? projects : [], kind);
  function changeKind(value: string) { setKind(value); setParty(null); setProjectId(null); setStatus('全部'); setError(''); }
  function addTask() {
    const type = affairTypes.includes(kind) ? kind : '行政任务';
    create(type, {
      ...(party !== null ? kind === '期刊审稿' ? { reviewJournal: party } : { requester: party } : {}),
      ...(isAdmin && selectedProject ? { affairProjectId: selectedProject.id, requester: selectedProject.requester } : {}),
    });
  }
  function openProject(project?: Item) {
    projectOriginal.current = project ? JSON.stringify(project) : null;
    setProjectDraft(project ? structuredClone(project) : { id: uid(), title: '', requester: party || '', notes: '' });
    setError('');
  }
  async function removeProject() {
    if (!projectDraft || inFlight.current || !window.confirm(`删除事务项目“${projectDraft.title}”？\n其中的任务会保留，并移回该发起方的“待归类”。`)) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await mutate(s => deleteAffairProject(s, projectDraft.id)); setProjectDraft(null); setProjectId(null); }
    catch (e: any) { setError(e.message); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const stats = (items: Item[]) => { const n = counts(items); return `${n.pending} 项待办 · ${n.done} 项已完成`; };
  const title = kind === '全部' ? '事务分类' : party === null ? `${kind} · ${partyLabel}` : isAdmin && projectId !== null ? selectedProject?.title || '待归类' : partyTitle;
  return <>
    <section className="cover monet" aria-label="事务管理插图：莫奈《睡莲》"><div><p>ADMINISTRATION · REVIEW · EXCHANGE</p><h1>事务管理</h1></div></section>
    <div className="affair-overview">{affairTypes.map(k => <button key={k} className={kind === k ? 'selected' : ''} onClick={() => changeKind(k)}>
      <small>{k}</small><strong>{all.filter(t => affairKind(t) === k && !t.done).length}</strong><span>待办</span>
      <small>{k === '行政任务' ? '按发起方与项目查看 →' : k === '期刊审稿' ? '按期刊查看 →' : k === '协助评阅' ? '按求助人查看 →' : '查看任务 →'}</small>
    </button>)}</div>
    <Tabs value={kind} onValueChange={changeKind}><TabsList>{['全部', ...affairTypes, ...(hasUnclassified ? ['待细分'] : [])].map(k => <TabsTrigger value={k} key={k}>{k}</TabsTrigger>)}</TabsList></Tabs>
    <nav className="affair-breadcrumb" aria-label="事务层级">
      <button onClick={() => changeKind('全部')}>事务管理</button>
      {kind !== '全部' && <><span>/</span><button onClick={() => { setParty(null); setProjectId(null); }}>{kind}</button></>}
      {party !== null && <><span>/</span><button onClick={() => setProjectId(null)}>{partyTitle}</button></>}
      {isAdmin && projectId !== null && <><span>/</span><span aria-current="page">{selectedProject?.title || '待归类'}</span></>}
    </nav>
    <div className="page-title"><div><h2>{title}</h2>
      {isAdmin && <p className="settings-copy">事务项目独立管理，不进入科研项目。</p>}
      {party !== null && !isAdmin && <small>{stats(partyTasks)}</small>}
    </div><div className="button-row">
      {party !== null && <Button variant="ghost" onClick={() => projectId !== null ? setProjectId(null) : setParty(null)}><ArrowLeft size={15}/>返回上一级</Button>}
      {isAdmin && projectId === null && <Button variant="outline" onClick={() => openProject()}><Plus size={15}/>新增事务项目</Button>}
      {isAdmin && selectedProject && <Button variant="outline" onClick={() => openProject(selectedProject)}><Pencil size={15}/>编辑事务项目</Button>}
      <Button onClick={addTask}><Plus size={15}/>{leaf ? '添加子任务' : '新增事务'}</Button>
    </div></div>
    {error && !projectDraft && <p className="error-text" role="alert">{error}</p>}
    {kind === '全部' && <section className="panel empty-state">选择上方类别查看事务<small>行政任务按发起方和事务项目组织，期刊审稿按期刊组织，协助评阅按求助人组织。</small></section>}
    {grouped && party === null && <div className="affair-group-grid">{parties.map(group => {
      const people = data.collaborators.filter(p => p.title.trim() === group.name);
      const person = people.length === 1 && kind !== '期刊审稿' ? people[0] : null;
      return <button className="affair-group-card" key={group.name} onClick={() => { setParty(group.name); setProjectId(null); setStatus('全部'); }}>
        <div className="flex-between"><span className="eyebrow">{partyLabel}</span><ArrowRight size={18}/></div>
        <h3>{group.name || missingParty}</h3>{person?.institution && <p>{person.institution}</p>}{person?.position && <p>{person.position}</p>}
        <small>{isAdmin ? `${group.projectCount} 个事务项目 · ` : ''}{group.pending} 项待办 · {group.done} 项已完成</small>
      </button>;
    })}{!parties.length && <div className="panel empty-state">暂无{partyLabel}<small>{isAdmin ? '新增事务项目时填写发起人或部门，即可建立分组。' : '新增事务时填写名称，即可建立分组。'}</small></div>}</div>}
    {isAdmin && party !== null && projectId === null && <div className="affair-group-grid">
      {partyProjects.map(project => <button className="affair-group-card" key={project.id} onClick={() => { setProjectId(project.id); setStatus('全部'); }}>
        <div className="flex-between"><span className="eyebrow">事务项目</span><ArrowRight size={18}/></div><h3>{project.title}</h3>
        {project.notes && <p>{project.notes}</p>}<small>{stats(partyTasks.filter(t => t.affairProjectId === project.id))}</small>
      </button>)}
      {partyTasks.some(t => !t.affairProjectId) && <button className="affair-group-card" onClick={() => { setProjectId(''); setStatus('全部'); }}><span className="eyebrow">尚未指定事务项目</span><h3>待归类</h3><small>{stats(partyTasks.filter(t => !t.affairProjectId))}</small></button>}
      {!partyProjects.length && !partyTasks.length && <div className="panel empty-state">暂无事务项目<small>点击“新增事务项目”建立项目，再添加子任务。</small></div>}
    </div>}
    {leaf && <>
      <div className="section-head"><h3>子任务 <small>{stats(leafTasks)}</small></h3><Tabs value={status} onValueChange={setStatus}><TabsList>{['全部','待办','已完成'].map(value => <TabsTrigger key={value} value={value}>{value}</TabsTrigger>)}</TabsList></Tabs></div>
      {selectedProject?.notes && <p className="settings-copy">{selectedProject.notes}</p>}
      <section className="panel">{rows.length ? rows.map(t => <article className="affair-row" key={t.id}>
        <Checkbox aria-label={'完成 ' + t.title} checked={t.done} onCheckedChange={v => void patch(t.id, { done: !!v }).catch(e => setError(e.message))}/>
        <div className="affair-task-body"><button className="affair-description" onClick={() => edit(t)}><strong>{t.title} {t.isTemporary && <em className="temporary-badge">临时</em>}</strong>
          <small>{affairKind(t) || '待细分'} · {t.bucket}{t.ownerName ? ' · 负责人：' + t.ownerName : ''}{t.requester ? ' · 发起方：' + t.requester : ''}</small>
          {kind === '期刊审稿' && <p>{t.manuscriptTitle}{t.reviewNumber ? ' · ' + t.reviewNumber : ''}</p>}
          {kind === '协助评阅' && <p>{t.assistanceType || '论文'}{t.manuscriptTitle ? ' · ' + t.manuscriptTitle : ''}</p>}
        </button>
        {isAdmin && <label className="affair-task-project">事务项目<select aria-label={'事务项目：' + t.title} value={t.affairProjectId || ''} onChange={e => { const id = e.target.value; void mutate(s => assignAffairProject(s, t.id, id)).catch(err => setError(err.message)); }}>
          <option value="">待归类</option>{partyProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select></label>}</div>
        <span className={'due ' + (isOverdue(t.deadline, !!t.done, today()) ? 'late' : '')}><CalendarDays size={14}/>{t.deadline || '未设截止日期'}</span>
        {!t.done && t.bucket !== '今天' && <Button variant="ghost" size="sm" onClick={() => void patch(t.id, { bucket:'今天' }).catch(e => setError(e.message))}>今天做</Button>}
        <Button variant="ghost" size="sm" aria-label={'编辑 ' + t.title} onClick={() => edit(t)}><Pencil size={15}/></Button>
      </article>) : <div className="empty-state">{status === '全部' ? '暂无子任务' : `暂无${status}子任务`}<Button variant="outline" onClick={addTask}>添加子任务</Button></div>}</section>
    </>}
    {affairTypes.includes(kind) && party === null && <details className="affair-files"><summary>{folders[kind] ? '查看类别关联文件夹' : '关联类别文件夹（可选）'}</summary>{renderFiles(kind)}</details>}
    <Dialog open={!!projectDraft} onOpenChange={open => { if (!open && !busy) setProjectDraft(null); }}><DialogContent className="record-dialog"><DialogTitle>{projectOriginal.current ? '编辑事务项目' : '新增事务项目'}</DialogTitle><DialogDescription>用于组织行政任务，与科研项目独立。</DialogDescription>
      {projectDraft && <form onSubmit={async e => {
        e.preventDefault(); if (inFlight.current) return; inFlight.current = true; setBusy(true); setError('');
        try { await mutate(s => {
          if (projectOriginal.current && JSON.stringify(s.affairProjects?.find(p => p.id === projectDraft.id)) !== projectOriginal.current) throw new Error('事务项目已更新，请重新打开后编辑');
          return saveAffairProject(s, projectDraft);
        }); setParty(projectDraft.requester.trim()); setProjectId(projectDraft.id); setProjectDraft(null); }
        catch (e: any) { setError(e.message); }
        finally { inFlight.current = false; setBusy(false); }
      }}>
        <label className="field">发起人 / 部门<Input required value={projectDraft.requester || ''} list="affair-requesters" onChange={e => setProjectDraft({ ...projectDraft, requester: e.target.value })}/></label>
        <datalist id="affair-requesters">{[...new Set([...projects.map(p => p.requester), ...all.filter(t => affairKind(t) === '行政任务').map(t => t.requester)].filter(Boolean))].map(name => <option key={name} value={name}/>)}</datalist>
        <label className="field">事务项目名称<Input required value={projectDraft.title} onChange={e => setProjectDraft({ ...projectDraft, title:e.target.value })}/></label>
        <label className="field">项目说明（选填）<textarea value={projectDraft.notes || ''} onChange={e => setProjectDraft({ ...projectDraft, notes:e.target.value })}/></label>
        {error && <p role="alert" className="error-text">{error}</p>}
        <div className="form-footer">{projectOriginal.current && <Button type="button" variant="destructive" disabled={busy} style={{marginRight:'auto'}} onClick={() => void removeProject()}>删除事务项目</Button>}<Button type="button" variant="outline" disabled={busy} onClick={() => setProjectDraft(null)}>取消</Button><Button type="submit" disabled={busy}>{busy ? '保存中…' : '保存事务项目'}</Button></div>
      </form>}
    </DialogContent></Dialog>
  </>;
}
