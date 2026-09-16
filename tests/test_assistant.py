import unittest,tempfile,copy,json,threading,urllib.request
from pathlib import Path
from unittest.mock import patch
import server,desk_assistant as ai,assistant_transport as transport
class Assistant(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);old=server.DATA;server.DATA=Path(self.tmp.name)/'data';self.addCleanup(setattr,server,'DATA',old)
  self.state=server.empty();self.state['students']=[dict(id='s',title='虚拟学生',guidance=[],followup='',feedback='')];self.state=server.write_state(self.state)
  transport.save_config(server.DATA,{'key':'test-key','model':'Qwen/Qwen3-14B'})
 def plan(self):return [dict(type='project',title='虚拟项目',kind='学术论文',collaborators=['虚拟老师'],stages=[dict(title='资料')]),dict(type='task',title='准备资料',project='虚拟项目',bucket='今天',isTemporary=True),dict(type='meeting',title='虚拟组会',group='全日制'),dict(type='guidance',student='虚拟学生',date=ai.date.today().isoformat(),content='讨论提纲'),dict(type='task',title='看稿',affairsType='协助评阅',requester='虚拟求助人')]
 def draft(self):
  with patch('assistant_transport.request',return_value={'choices':[{'message':{'content':json.dumps({'reply':'草案','questions':[],'actions':self.plan()})}}]}) as request:
   r=ai.chat(server.DATA,self.state,{'messages':[{'role':'user','content':'安排工作'}]},server.validate)
   sent=json.dumps(request.call_args.args[2],ensure_ascii=False);self.assertNotIn('虚拟学生',sent);self.assertNotIn('test-key',sent)
   self.assertEqual(server.read_state(),self.state);return r
 def test_multi_type_apply_idempotent_and_undo(self):
  r=self.draft();saved=server.write_state(ai.apply(self.state,{'draftId':r['draftId']}));self.assertEqual(len(saved['tasks']),2);self.assertEqual(len(saved['collaborators']),2);self.assertEqual(saved['tasks'][0]['projectId'],saved['projects'][0]['id']);self.assertIs(ai.apply(saved,{'draftId':r['draftId']}),saved)
  restored=server.write_state(ai.undo(saved,{'draftId':r['draftId'],'revision':saved['revision']}));self.assertEqual(restored['students'],self.state['students']);self.assertFalse(restored['projects']);self.assertFalse(restored['tasks'])
 def test_changed_revision_and_modified_record_blocked(self):
  r=self.draft();changed=copy.deepcopy(self.state);changed['revision']+=1
  with self.assertRaises(ValueError):ai.apply(changed,{'draftId':r['draftId']})
  saved=server.write_state(ai.apply(self.state,{'draftId':r['draftId']}));saved['tasks'][0]['done']=True
  with self.assertRaises(ValueError):ai.undo(saved,{'draftId':r['draftId'],'revision':saved['revision']})
 def test_invalid_names_dates_and_fields_atomic(self):
  for actions in [[dict(type='guidance',student='不存在',date='2026-01-01',content='讨论')],[dict(type='task',title='任务',deadline='2026-02-30')],[dict(type='task',title='任务',done=True)],[dict(type='project',title='项目',stages=[dict(title='阶段',start='2026-09-10')])]]:
   with self.assertRaises(ValueError):ai.compile_plan(self.state,actions)
  self.assertEqual(server.read_state(),self.state)
 def test_guidance_preserves_unmentioned_followup_and_feedback(self):
  self.state['students'][0].update(followup='2026-12-31',feedback='原反馈')
  planned,_,_=ai.compile_plan(self.state,[dict(type='guidance',student='虚拟学生',date=ai.date.today().isoformat(),content='讨论')]);self.assertEqual(planned['students'][0]['followup'],'2026-12-31');self.assertEqual(planned['students'][0]['feedback'],'原反馈')
 def test_questions_do_not_create_executable_draft(self):
  with patch('assistant_transport.request',return_value={'choices':[{'message':{'content':json.dumps({'reply':'请明确','questions':['哪位学生？'],'actions':[]})}}]}):
   r=ai.chat(server.DATA,self.state,{'messages':[{'role':'user','content':'找学生'}]},server.validate);self.assertNotIn('draftId',r)
 def test_http_roundtrip(self):
  http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=http.serve_forever,daemon=True).start();self.addCleanup(http.server_close);self.addCleanup(http.shutdown)
  def call(path,body):
   req=urllib.request.Request('http://127.0.0.1:'+str(http.server_port)+'/api/'+path,data=json.dumps(body).encode(),headers={'Host':'127.0.0.1:4318','X-Desk-Request':'1'})
   with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req) as r:return json.load(r)
  r=self.draft();saved=call('assistant/apply',{'draftId':r['draftId']});self.assertEqual(len(saved['tasks']),2);restored=call('assistant/undo',{'draftId':r['draftId'],'revision':saved['revision']});self.assertEqual(restored['students'],self.state['students'])
