import type { State, Item } from './desk.ts';
const fail = (s: string): never => { throw new Error(s); };
function text(v: any, label: string, required=false): string {
  if (v === undefined && !required) return '';
  if (typeof v !== 'string' || v.length > 10000 || (required && !v.trim())) return fail(label+'格式不正确');
  return v.trim();
}
function date(v: any, label: string): string {
  const s=text(v,label); if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10)!==s)) fail(label+'日期无效'); return s;
}
function keys(o:any, allowed:string[]) { if (!o || typeof o!=='object' || Array.isArray(o)) fail('记录必须是对象'); for(const k of Object.keys(o)) if(!allowed.includes(k)) fail('不支持的字段：'+k); }
function find(items:Item[], name:string, label:string) { const matches=items.filter(x=>x.title===name && !x.archived); if(matches.length!==1) fail(label+'“'+name+'”不存在或重名，请在工作台中确认名称'); return matches[0].id; }
export function importPlan(state:State, p:any):State {
  keys(p,['format','version','planId','title','projects','tasks']);
  if(p.format!=='research-desk-work-plan'||p.version!==1) fail('请选择工作方案JSON文件（不是工作台备份）');
  const planId=text(p.planId,'方案编号',true), title=text(p.title,'方案标题',true);
  if(state.planImports?.some(b=>b.planId===planId && !b.undone)) fail('此方案已经导入，请勿重复添加');
  if(!Array.isArray(p.projects)||p.projects.length>20||!Array.isArray(p.tasks)||p.tasks.length>200||!p.projects.length&&!p.tasks.length) fail('方案需包含项目或任务，最多20个项目、200项任务');
  const next=structuredClone(state), projects:Item[]=[], tasks:Item[]=[], refs=new Map<string,string>();
  for(const raw of p.projects) {
    keys(raw,['key','title','kind','deadline','next','notes','targetJournal','stages']);
    const key=text(raw.key,'项目编号',true); if(refs.has(key)) fail('方案内项目编号重复');
    const id=crypto.randomUUID();refs.set(key,id);
    const kind=text(raw.kind,'项目类型',true);if(!['学术论文','项目申报','其他事项'].includes(kind)) fail('项目类型无效');
    if(!Array.isArray(raw.stages)||!raw.stages.length||raw.stages.length>30) fail('每个项目需有1至30个阶段');
    const stages=raw.stages.map((s:any)=>{
      keys(s,['title','start','end','weight']);
      const start=date(s.start,'阶段开始'),end=s.end==='present'?'present':date(s.end,'阶段结束');
      if(!!start!==!!end || start && end!=='present' && end<start) fail('阶段需同时填写起止日期，且结束不早于开始');
      const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      if(end==='present'&&start>today) fail('至今阶段不能在未来开始');
      const weight=s.weight??1;if(typeof weight!=='number'||!Number.isFinite(weight)||weight<=0||weight>10000) fail('阶段权重无效');
      return {id:crypto.randomUUID(),title:text(s.title,'阶段名称',true),start,end,weight,done:false};
    });
    projects.push({id,title:text(raw.title,'项目名称',true),kind,deadline:date(raw.deadline,'项目截止'),next:text(raw.next,'下一步'),notes:text(raw.notes,'项目说明'),targetJournal:text(raw.targetJournal,'目标期刊'),stages,archived:false,pinned:false,studentIds:[],collaboratorIds:[],submissions:[]});
  }
  const taskKeys=new Set<string>();
  for(const raw of p.tasks) {
    keys(raw,['key','title','bucket','deadline','projectKey','existingProject','student','isTemporary','notes','doneWhen']);
    const key=text(raw.key,'任务编号',true);if(taskKeys.has(key)) fail('方案内任务编号重复');taskKeys.add(key);
    const projectKey=text(raw.projectKey,'项目编号'),existing=text(raw.existingProject,'已有项目名称'),student=text(raw.student,'学生姓名');
    if(projectKey&&existing) fail('任务不能同时关联新项目和已有项目');
    const projectId=projectKey?(refs.get(projectKey)||fail('任务关联的项目编号不存在')):existing?find(state.projects,existing,'项目'):'';
    const bucket=raw.bucket??'近期';if(!['今天','近期','以后'].includes(bucket)) fail('任务安排只能是今天、近期或以后');
    if(raw.isTemporary!==undefined&&typeof raw.isTemporary!=='boolean') fail('临时标记应为true或false');
    const doneWhen=text(raw.doneWhen,'完成标准'),notes=text(raw.notes,'任务说明');
    tasks.push({id:crypto.randomUUID(),title:text(raw.title,'任务名称',true),bucket,deadline:date(raw.deadline,'任务截止'),projectId,studentId:student?find(state.students,student,'学生'):'',isTemporary:raw.isTemporary??false,done:false,archived:false,notes:[notes,doneWhen?'完成标准：'+doneWhen:''].filter(Boolean).join('\n')});
  }
  next.projects.push(...projects);next.tasks.push(...tasks);
  next.planImports=[...(next.planImports||[]),{planId,title,importedAt:new Date().toISOString(),projects:structuredClone(projects),tasks:structuredClone(tasks)}];
  return next;
}
export function undoPlan(state:State, planId:string):State {
  const batch=state.planImports?.find(b=>b.planId===planId&&!b.undone);if(!batch) return fail('此方案未导入或已经撤销');
  for(const key of ['projects','tasks'] as const) for(const original of batch[key]) {
    const current=state[key].find(x=>x.id===original.id);
    if(!current||JSON.stringify(current)!==JSON.stringify(original)) fail('导入记录已编辑、完成或删除，为保护后续工作不能整批撤销；请手动处理');
  }
  const ids=new Set(batch.projects.map((x:Item)=>x.id)), tids=new Set(batch.tasks.map((x:Item)=>x.id));
  if(state.tasks.some(t=>!tids.has(t.id)&&ids.has(t.projectId))) fail('导入项目已有其他任务关联，请先处理这些任务');
  const next=structuredClone(state);next.projects=next.projects.filter(x=>!ids.has(x.id));next.tasks=next.tasks.filter(x=>!tids.has(x.id));
  next.planImports!.find(b=>b.planId===planId&&!b.undone)!.undone=true;
  return next;
}
