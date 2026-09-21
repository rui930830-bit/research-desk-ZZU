import unittest, tempfile, copy, json
from pathlib import Path
import server
class WorkClassification(unittest.TestCase):
 def test_all_approved_pairs_roundtrip_and_invalid_pairs_fail(self):
  original=server.DATA
  with tempfile.TemporaryDirectory() as tmp:
   server.DATA=Path(tmp)
   try:
    state=server.empty()
    for category,types in server.WORK_TYPES.items():
     for type_ in types:
      state['tasks'].append(dict(id=type_,title=type_,bucket='今天',done=True,actualMinutes=90,taskCategory=category,workType=type_,affairsType=type_ if category=='事务管理' else '',reviewJournal='测试期刊',manuscriptTitle='测试稿件'))
    saved=server.write_state(state)
    self.assertEqual(server.read_state()['tasks'],saved['tasks'])
    for fields in ({'taskCategory':'科研项目','workType':'组会'},{'taskCategory':'学生指导','workType':'个别指导'},{'taskCategory':'非法类别'},{'taskCategory':'事务管理','workType':'期刊审稿','affairsType':''}):
     invalid=copy.deepcopy(saved);invalid['tasks'][0].update(fields)
     with self.assertRaises(ValueError):server.write_state(invalid)
    self.assertEqual(server.read_state(),saved)
   finally:server.DATA=original
 def test_legacy_and_guidance_compatibility(self):
  state=server.empty()
  state['tasks']=[dict(id=str(i),title='旧记录',bucket='今天',done=True,workType=t) for i,t in enumerate(server.LEGACY_WORK_TYPES)]
  state['students']=[dict(id='s',title='学生',guidance=[dict(id='g',date='2026-09-20',content='反馈',feedback='',followup='')])]
  original=copy.deepcopy(state);server.validate(state);self.assertEqual(state,original)
  for type_ in server.WORK_TYPES['学生指导']:
   state['students'][0]['guidance'][0]['workType']=type_;server.validate(state)
  state['students'][0]['guidance'][0]['workType']='论文写作'
  with self.assertRaises(ValueError):server.validate(state)
