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
  if(t.requesterDetachedName && t.requesterDetachedName===t.requester?.trim()){delete t.requesterId;delete t.requesterLinkedName;continue;}
  delete t.requesterDetachedName;
  if(t.affairsType!=='协助评阅'||!t.requester?.trim()){delete t.requesterId;delete t.requesterLinkedName;continue;}
  const linked=s.collaborators.find(p=>p.id===t.requesterId);
  if(linked && t.requesterLinkedName===t.requester){t.requester=linked.title;t.requesterLinkedName=linked.title;continue;}
  t.requester=t.requester.trim();t.requesterId=resolve(t.requester,true,t.demo===true);t.requesterLinkedName=t.requester;
 }
 // Ordinary task people link to existing profiles; department text stays as text.
 for(const t of s.tasks){
  for(const [nameKey,idKey,lastKey,detachedKey] of [['ownerName','ownerId','ownerLinkedName','ownerDetachedName'],['requester','initiatorId','initiatorLinkedName','requesterDetachedName']]){
   const name=(t[nameKey]||'').trim();
   if(t[detachedKey] && t[detachedKey]===name){delete t[idKey];delete t[lastKey];continue;}
   delete t[detachedKey];
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

// Remove the profile and its links, while keeping projects, tasks and their name text.
export function removeCollaborator(input: State, id: string): State {
 const person=input.collaborators.find(p=>p.id===id);
 if(!person) throw new Error('合作者档案已不存在，请刷新后重试');
 const s=structuredClone(input);
 const uniqueName=input.collaborators.filter(p=>p.title.trim()===person.title.trim()).length===1;
 s.collaborators=s.collaborators.filter(p=>p.id!==id);
 for(const p of s.projects) {
  if(p.collaboratorIds?.includes(id)) p.collaboratorIds=p.collaboratorIds.filter((value:string)=>value!==id);
 }
 for(const t of s.tasks) {
  const ownerLinked=t.ownerId===id;
  const requesterLinked=t.requesterId===id || t.initiatorId===id;
  // Legacy unlinked names would otherwise recreate the deleted profile on reload.
  if(ownerLinked || (uniqueName && !t.ownerId && t.ownerName?.trim()===person.title.trim())) {
   if(t.ownerName?.trim()) t.ownerDetachedName=t.ownerName.trim();
  }
  if(requesterLinked || (uniqueName && !t.requesterId && !t.initiatorId && t.requester?.trim()===person.title.trim())) {
   if(t.requester?.trim()) t.requesterDetachedName=t.requester.trim();
  }
  for(const [idKey,lastKey] of [['ownerId','ownerLinkedName'],['requesterId','requesterLinkedName'],['initiatorId','initiatorLinkedName']]) {
   if(t[idKey]===id){delete t[idKey];delete t[lastKey];}
  }
 }
 return s;
}
