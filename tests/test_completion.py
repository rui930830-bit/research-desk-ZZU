import unittest, tempfile, copy
from pathlib import Path
from datetime import datetime
import server

class Completion(unittest.TestCase):
    def test_completion_lifecycle_and_legacy(self):
        with tempfile.TemporaryDirectory() as tmp:
            original=server.DATA;server.DATA=Path(tmp)
            try:
                s=server.empty();s['tasks']=[{'bucket':'今天','id':'a','title':'旧任务','done':True}, {'bucket':'今天','id':'b','title':'待办','done':False}]
                s=server.write_state(s,restore=True)
                self.assertNotIn('completedOn',s['tasks'][0])
                s['tasks'][1]['done']=True;s=server.write_state(s)
                self.assertEqual(s['tasks'][1]['completedOn'],datetime.now().strftime('%Y-%m-%d'))
                self.assertNotIn('completedOn',s['tasks'][0])
                s['tasks'][1]['completedOn']='2026-09-07';s=server.write_state(s)
                s['tasks'][1]['title']='编辑标题';s=server.write_state(s)
                self.assertEqual(s['tasks'][1]['completedOn'],'2026-09-07')
                restored=server.write_state(s,restore=True)
                self.assertEqual(s['tasks'],restored['tasks'])
                s=restored;s['tasks'][1]['done']=False;s=server.write_state(s)
                self.assertNotIn('completedOn',s['tasks'][1])
                s['tasks'][1]['done']=True;s=server.write_state(s)
                self.assertEqual(s['tasks'][1]['completedOn'],datetime.now().strftime('%Y-%m-%d'))
                bad=copy.deepcopy(s);bad['tasks'][1]['completedOn']='bad'
                with self.assertRaises(ValueError):server.write_state(bad)
            finally:server.DATA=original
