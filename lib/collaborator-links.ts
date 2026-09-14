import type {State, Item} from './desk.ts';
export function linkCollaborators(input:State):State {
 const s=structuredClone(input);
 function resolve(name:string, potential:boolean, demo=false):string {
  name=name.trim();
  const matches=s.collaborators.filter(p=>p.title.trim()===name);
  if(matches.length>1) throw new Error('合作者“'+name+'”有重名档案，请先区分姓名后保存');
  if(matches.length){return matches[0].id;}
  const id=crypto.randomUUID();s.collaborators.push({id,title:name,...(demo?{demo:true}:{}),relationship:potential?'potential':'active',institution:'',position:'',research:'',contact:'',notes:'',archived:false});return id;
 }
 for(const t of s.tasks){
  if(t.affairsType!=='协助评阅'||!t.requester?.trim()){delete t.requesterId;delete t.requesterLinkedName;continue;}
  const linked=s.collaborators.find(p=>p.id===t.requesterId);
  if(linked && t.requesterLinkedName===t.requester){t.requester=linked.title;t.requesterLinkedName=linked.title;continue;}
  t.requester=t.requester.trim();t.requesterId=resolve(t.requester,true,t.demo===true);t.requesterLinkedName=t.requester;
 }
 // Ordinary task people link to existing profiles; department text stays as text.
 for(const t of s.tasks){
  for(const [nameKey,idKey,lastKey] of [['ownerName','ownerId','ownerLinkedName'],['requester','initiatorId','initiatorLinkedName']]){
   const name=(t[nameKey]||'').trim();
   const linked=s.collaborators.find(p=>p.id===t[idKey]);
   if(linked && t[lastKey]===name){t[nameKey]=linked.title;t[lastKey]=linked.title;continue;}
   const matches=s.collaborators.filter(p=>p.title.trim()===name);
   if(name && matches.length===1){t[idKey]=matches[0].id;t[lastKey]=name;t[nameKey]=name;}
   else {delete t[idKey];delete t[lastKey];}
  }
 }
 for(const p of s.projects){
  const names=(p.newCollaboratorNames||'').split(/[、,，;；\n]+/).map((x:string)=>x.trim()).filter(Boolean);
  const ids=new Set<string>(p.collaboratorIds||[]);
  for(const name of names)ids.add(resolve(name,false,p.demo===true));
  p.collaboratorIds=[...ids];delete p.newCollaboratorNames;
 }
 return s;
}
