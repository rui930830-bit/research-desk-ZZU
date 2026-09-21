import unittest,tempfile,copy
from pathlib import Path
import server
class WorkSummary(unittest.TestCase):
 def test_minutes_persist_for_all_sources_and_validate(self):
  with tempfile.TemporaryDirectory() as tmp:
   original=server.DATA;server.DATA=Path(tmp)
   try:
    s=server.empty();s['tasks']=[{'id':'t','title':'工作','bucket':'今天','done':True,'actualMinutes':45,'workType':'论文写作'}]
    s['students']=[{'id':'s','title':'学生','guidance':[{'id':'g','date':'2026-09-17','content':'反馈','feedback':'','followup':'','actualMinutes':0}]}]
    s['meetings']=[{'id':'m','title':'组会','date':'2026-09-17','completed':True,'actualMinutes':60}]
    saved=server.write_state(s,restore=True)
    import json
    reload=json.loads((Path(tmp)/'workspace.json').read_text())
    self.assertEqual(reload['tasks'][0]['actualMinutes'],45);self.assertEqual(reload['students'][0]['guidance'][0]['actualMinutes'],0);self.assertEqual(reload['meetings'][0]['actualMinutes'],60)
    for val in [-1,True,1.5,'60',10000001]:
     for target in ['task','guidance','meeting']:
      bad=copy.deepcopy(saved);rec=bad['tasks'][0] if target=='task' else bad['meetings'][0] if target=='meeting' else bad['students'][0]['guidance'][0];rec['actualMinutes']=val
      with self.assertRaises(ValueError):server.validate(bad)
   finally:server.DATA=original
