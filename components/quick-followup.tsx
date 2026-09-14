 'use client';
import {useState,useRef} from 'react';
import {today,uid,type State} from '@/lib/desk';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function QuickFollowup({data,studentId,close,mutate}:{data:State;studentId:string;close:()=>void;mutate:(fn:(s:State)=>State)=>Promise<void>}){
 const initial=data.students.find(s=>s.id===studentId);
 const [id,setId]=useState(studentId),[date,setDate]=useState(today),[content,setContent]=useState(''),[feedback,setFeedback]=useState(''),[next,setNext]=useState(initial && initial.followup>today()?initial.followup:''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const noteId=useRef(uid()),inFlight=useRef(false);
 const snapshot=useRef({followup:initial?.followup||'',feedback:initial?.feedback||''});
 function choose(value:string){setId(value);const s=data.students.find(s=>s.id===value);setNext(s && s.followup>today()?s.followup:'');snapshot.current={followup:s?.followup||'',feedback:s?.feedback||''};}
 return <Dialog open onOpenChange={v=>{if(!v&&!busy)close();}}><DialogContent className="record-dialog"><DialogTitle>一键跟进</DialogTitle><DialogDescription>记录本次实际跟进，保存后生成一条学生指导记录。</DialogDescription>
 <form onSubmit={async e=>{e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{
 if(!id||!date||!content.trim())throw new Error('请选择学生并填写日期和本次跟进内容');
 await mutate(s=>{const person=s.students.find(p=>p.id===id);if(!person)throw new Error('学生档案已不存在');if(person.guidance?.some((r:any)=>r.id===noteId.current))return s;
 if((person.followup||'')!==snapshot.current.followup||(person.feedback||'')!==snapshot.current.feedback)throw new Error('该学生的跟进信息已更新，请关闭后重新打开');
 person.guidance=[...(person.guidance||[]),{id:noteId.current,date,content:content.trim(),feedback:feedback.trim(),followup:next}];person.followup=next;if(feedback.trim())person.feedback=feedback.trim();return s;});close();
 }catch(e:any){setError(e.message);}finally{inFlight.current=false;setBusy(false);}}}>
 <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
 <label className="field">学生<select required value={id} onChange={e=>choose(e.target.value)}><option value="">请选择学生</option>{data.students.filter(s=>!s.archived).map(s=><option key={s.id} value={s.id}>{s.title} · {s.kind}</option>)}</select></label>
 <label className="field">实际跟进日期<Input required type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label className="field">本次跟进内容<textarea required rows={5} value={content} onChange={e=>setContent(e.target.value)} placeholder="讨论了什么、给出的建议和后续安排"/></label>
 <label className="field">学生反馈（选填）<textarea rows={2} value={feedback} onChange={e=>setFeedback(e.target.value)}/></label>
 <label className="field">下次跟进日期（选填）<Input type="date" min={date} value={next} onChange={e=>setNext(e.target.value)}/><small>留空表示暂不安排下次跟进。</small></label>
 </fieldset>
 {error&&<p className="error-text" role="alert">{error}</p>}
 <div className="form-footer"><Button type="button" variant="outline" disabled={busy} onClick={close}>取消</Button><Button type="submit" disabled={busy}>{busy?'正在保存…':'完成跟进并生成指导记录'}</Button></div>
 </form></DialogContent></Dialog>;
}
