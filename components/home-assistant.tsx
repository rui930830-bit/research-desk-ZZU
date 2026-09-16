'use client';
import {useState,useRef,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AiSettings} from '@/components/assistant-settings';
const labels:Record<string,string>={tasks:'任务',projects:'科研项目',students:'指导记录',meetings:'组会',collaborators:'合作者'};
function Card({card}:{card:any}){
 const r=card.record;
 const fields=[['kind','类型'],['bucket','安排'],['affairsType','事务类别'],['deadline','截止日期'],['date','日期'],['ownerName','负责人'],['requester','发起方'],['reviewJournal','期刊'],['manuscriptTitle','稿件'],['next','下一步'],['group','组会类型'],['agenda','议题'],['attendees','参会人员'],['institution','单位'],['position','职称'],['contact','联系方式'],['research','研究方向'],['notes','说明']];
 return <article className="assistant-card"><strong>{card.existing?'追加':'新增'}{labels[card.collection]} · {card.title}</strong>
 {fields.map(([key,label])=>r[key]?<p key={key}>{label}：{r[key]}</p>:null)}
 {r.relationship&&<p>关系：{r.relationship==='potential'?'潜在合作者':'合作者'}</p>}
 {r.isTemporary&&<p>临时插入</p>}{r.reminderEnabled&&<p>首页提醒：{r.reminderDate}</p>}
 {r.stages&&<ul>{r.stages.filter((x:any)=>!card.before?.stages?.some((old:any)=>old.id===x.id)).map((x:any)=><li key={x.id}>{x.title} · {x.start||'未定日期'} — {x.end==='present'?'至今':x.end||'未定日期'} · 权重{x.weight}</li>)}</ul>}
 {card.collection==='students'&&r.guidance.filter((x:any)=>!card.before?.guidance?.some((old:any)=>old.id===x.id)).map((x:any)=><div key={x.id}><p>指导日期：{x.date}</p><p>{x.content}</p>{x.feedback&&<p>反馈：{x.feedback}</p>}<p>下次跟进：{x.followup||'未安排'}</p></div>)}
 {card.links&&<p>{card.links.join(' · ')}</p>}
 </article>;
}
export function HomeAssistant({close,commit,batches}:{close:()=>void;commit:(path:string,body:any)=>Promise<void>;batches:any[]}){
 const [input,setInput]=useState(''),[history,setHistory]=useState<any[]>([]),[chat,setChat]=useState<any[]>([]),[draft,setDraft]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(''),[seconds,setSeconds]=useState(0),[catalog,setCatalog]=useState(false),[saved,setSaved]=useState('');
 const request=useRef<AbortController|null>(null),saving=useRef(false);
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{if(busy!=='generate')return;const start=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
 async function send(){if(request.current||!input.trim())return;const text=input.trim();const messages=[...history,{role:'user',content:text}];setHistory(messages);setChat(c=>[...c,{role:'user',text}]);setInput('');setDraft(null);setSaved('');setError('');setBusy('generate');setSeconds(0);const control=new AbortController();request.current=control;let expired=false;const timer=setTimeout(()=>{expired=true;control.abort();},90000);
 try{const response=await fetch('/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Desk-Request':'1'},body:JSON.stringify({messages,shareCatalog:catalog}),signal:control.signal});const r:any=await response.json();if(!response.ok)throw new Error(r.error||'生成失败');setHistory([...messages,{role:'assistant',content:r.history}]);setChat(c=>[...c,{role:'assistant',text:r.reply+(r.questions?.length?'\n'+r.questions.join('\n'):'')}]);setDraft(r);
 }catch(e:any){setError(control.signal.aborted?(expired?'等待超过90秒，请重试或在设置中更换模型。':'已取消等待。'):e.message);}finally{clearTimeout(timer);request.current=null;setBusy('');}}
 async function apply(){if(saving.current||!draft?.draftId)return;saving.current=true;setBusy('save');setError('');try{await commit('assistant/apply',{draftId:draft.draftId});setSaved('已添加到研间。继续输入可以开始下一批事项。');setHistory([]);setDraft(null);setChat([]);}catch(e:any){setError(e.message);}finally{saving.current=false;setBusy('');}}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)close();}}><DialogContent className="home-assistant-dialog"><DialogTitle>AI 小助手</DialogTitle><DialogDescription>说清要安排的工作，核对草案后一次添加。需要拆解时，请直接告诉我。</DialogDescription>
 <details><summary>AI 设置</summary><AiSettings/></details>
 <label className="check-label"><input type="checkbox" checked={catalog} disabled={!!busy} onChange={e=>setCatalog(e.target.checked)}/>允许发送已有项目、学生、合作者和组会名称，帮助准确关联</label>
 <small>发送本次对话；默认不读取其他档案或本地文件。配置密钥仅保存在本机。</small>
 <div className="assistant-conversation">{chat.map((m,i)=><div key={i} className={'assistant-message '+m.role}><strong>{m.role==='user'?'我':'助手'}</strong><p>{m.text}</p></div>)}</div>
 {draft?.cards?.length>0&&<section><h3>待确认 · {draft.cards.length} 条记录变更</h3>{draft.cards.map((c:any,i:number)=><Card key={i} card={c}/>)}<small>{draft.model} · 本次用时{draft.elapsed}秒</small><p>需要修改，可在下方继续说明；确认后才写入。</p><Button disabled={!!busy||!!input.trim()} onClick={()=>void apply()}>确认添加以上内容</Button></section>}
 <form onSubmit={e=>{e.preventDefault();void send();}}><textarea aria-label="对话内容" disabled={!!busy} rows={3} value={input} onChange={e=>setInput(e.target.value)} placeholder="例如：今天帮张老师看申报书，周五前反馈，是临时加的。"/>
 <div className="button-row"><Button type="submit" disabled={!!busy||!input.trim()}>{busy==='generate'?`正在整理 · ${seconds}秒`:'发送'}</Button>{busy==='generate'&&<Button type="button" variant="outline" onClick={()=>request.current?.abort()}>取消等待</Button>}<Button type="button" variant="ghost" disabled={!!busy} onClick={()=>{setChat([]);setHistory([]);setDraft(null);setError('');setSaved('');setInput('');}}>新对话</Button></div></form>
 {busy==='generate'&&<small>取消仅停止本页等待，服务商可能仍完成调用并计费。</small>}
 {error&&<p role="alert" className="error-text">{error}</p>}{saved&&<p role="status">{saved}</p>}
 {batches.filter(b=>!b.undone).slice(-5).reverse().map(b=><div className="flex-between" key={b.id}><small>{b.date} · 已添加/更新 {b.changes.length} 条记录</small><Button disabled={!!busy} variant="outline" onClick={async()=>{if(!window.confirm('撤销这批添加？如已有后续修改，将保留记录并提示。'))return;setBusy('undo');setError('');try{await commit('assistant/undo',{draftId:b.id});setSaved('已撤销该批记录');}catch(e:any){setError(e.message);}finally{setBusy('');}}}>撤销这批</Button></div>)}
 </DialogContent></Dialog>;
}
