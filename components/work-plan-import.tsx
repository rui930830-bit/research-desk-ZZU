'use client';
import {useState,useRef} from 'react';
import type {State} from '@/lib/desk';
import {importPlan,undoPlan} from '@/lib/work-plan';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function WorkPlanImport({data,mutate}:{data:State;mutate:(fn:(s:State)=>State)=>Promise<void>}) {
 const [open,setOpen]=useState(false),[plan,setPlan]=useState<any>(null),[preview,setPreview]=useState<State|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const fileInput=useRef<HTMLInputElement>(null);
 const [fileName,setFileName]=useState('');
 function inspect(p:any){setError('');setMessage('');setPlan(null);setPreview(null);try{const next=importPlan(data,p);setPlan(p);setPreview(next);}catch(e:any){setError(e.message);}}
 async function save(){setBusy(true);setError('');try{await mutate(s=>{if(s.revision!==preview?.revision)throw new Error('记录已更新，请重新选择文件预览');return importPlan(s,plan);});setPlan(null);setPreview(null);setMessage('方案已导入。科研项目页查看项目及甘特图，日常任务页查看具体任务。');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 const receipt=preview?.planImports?.at(-1);
 return <>
 <Button variant="outline" onClick={()=>setOpen(true)}>导入工作方案</Button>
 <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent style={{maxWidth:900,maxHeight:'90vh',overflowY:'auto'}}>
 <DialogTitle>导入工作方案</DialogTitle><DialogDescription>选择讨论确认后的方案文件，预览后一次性新增项目、阶段和任务。</DialogDescription>
 <div className="plan-file-picker">
 <div><strong>方案文件</strong><p className="plan-file-hint">支持 JSON 格式，文件不超过 1MB</p></div>
 <input ref={fileInput} style={{display:'none'}} disabled={busy} type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setFileName(f.name);setPlan(null);setPreview(null);setError('');setMessage('');try{if(f.size>1000000)throw new Error('方案文件超过1MB');inspect(JSON.parse(await f.text()));}catch(err:any){setError(err instanceof SyntaxError?'JSON格式不正确，请检查方案文件':err.message);}}}/>
 <div className="plan-file-actions"><Button disabled={busy} onClick={()=>fileInput.current?.click()}>{fileName?'重新选择文件':'选择方案文件'}</Button><span className="plan-file-name" role="status">{fileName||'尚未选择文件'}</span></div>
 </div>
 <div className="plan-downloads"><a href="/examples/work-plan-example.json" download>下载虚拟示例</a><a href="/examples/工作方案示例与导入说明.md" download>下载格式与结果说明</a></div>
 {receipt&&<section><h3>{receipt.title}</h3><p>将新增 {receipt.projects.length} 个项目、{receipt.projects.reduce((n,p)=>n+p.stages.length,0)} 个阶段、{receipt.tasks.length} 项任务。全部以未完成状态创建，项目初始进度为0%。</p>
 {receipt.projects.map(p=><div className="panel" key={p.id}><h3>{p.title} · {p.kind}</h3><p>截止：{p.deadline||'未设'} · 下一步：{p.next||'未设'}</p>{p.notes&&<p>{p.notes}</p>}{p.targetJournal&&<p>目标期刊：{p.targetJournal}</p>}<ul>{p.stages.map((s:any)=><li key={s.id}>{s.title}：{s.start||'未安排'} — {s.end==='present'?'至今':s.end||'未安排'}（权重{s.weight}）</li>)}</ul></div>)}
 {receipt.tasks.map(t=><div className="panel" key={t.id}><strong>{t.title}</strong><p>{t.bucket}{t.isTemporary?' · 临时':''} · 截止：{t.deadline||'未设'}</p><p>项目：{preview?.projects.find(p=>p.id===t.projectId)?.title||'独立任务'} · 关联学生：{data.students.find(s=>s.id===t.studentId)?.title||'无'}</p><p style={{whiteSpace:'pre-wrap'}}>{t.notes}</p></div>)}
 <Button disabled={busy} onClick={()=>void save()}>{busy?'正在保存…':'确认导入以上内容'}</Button></section>}
 {message&&<p role="status">{message}</p>}{error&&<p className="error-text" role="alert">{error}</p>}
 <h3>已导入方案</h3><small>仅未被后续编辑的整批记录支持安全撤销；已有修改时请手动处理。</small>
 {(data.planImports||[]).filter(b=>!b.undone).map(b=><div key={b.planId}><span>{b.title}</span><Button disabled={busy} variant="ghost" onClick={async()=>{if(!window.confirm('撤销此方案新增的项目和任务？'))return;setBusy(true);setError('');try{await mutate(s=>undoPlan(s,b.planId));setPreview(null);setPlan(null);setMessage('已撤销本次导入');}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>撤销导入</Button></div>)}
 </DialogContent></Dialog></>;
}
