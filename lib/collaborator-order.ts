import type {Item} from './desk.ts';
export function titleRank(p:Item):number {
 const explicit=Number(p.titleLevel);if(['1','2','3','4','5'].includes(String(p.titleLevel)))return explicit;
 const s=p.position||'';
 if(/副教授|副研究员|副高级/.test(s))return 2;
 if(/助理研究员|讲师|中级/.test(s))return 3;
 if(/助教|初级/.test(s))return 4;
 if(/教授|研究员|正高级/.test(s))return 1;
 return 5;
}
export function activeProjects(person:Item, projects:Item[]):Item[]{
 return projects.filter(p=>!p.archived&&p.collaboratorIds?.includes(person.id)&&!(p.stages?.length&&p.stages.every((s:any)=>s.done)));
}
export function projectPriority(p:Item,projects:Item[]):[number,string]{
 const list=activeProjects(p,projects);
 if(!list.length)return [2,'9999-12-31'];
 const pinned=list.filter(x=>x.pinned),chosen=pinned.length?pinned:list;
 return [pinned.length?0:1,chosen.map(x=>x.deadline||'9999-12-31').sort()[0]];
}
export function orderCollaborators(people:Item[],projects:Item[],mode:string):Item[]{
 return [...people].sort((a,b)=>{
  if(mode==='title')return titleRank(a)-titleRank(b)||a.title.localeCompare(b.title,'zh-CN');
  const x=projectPriority(a,projects),y=projectPriority(b,projects);
  return x[0]-y[0]||x[1].localeCompare(y[1])||titleRank(a)-titleRank(b)||a.title.localeCompare(b.title,'zh-CN');
 });
}
