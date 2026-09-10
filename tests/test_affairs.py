import unittest,tempfile,copy
from pathlib import Path
import server
class Affairs(unittest.TestCase):
 def test_shared_records_and_independent_requester(self):
  with tempfile.TemporaryDirectory() as tmp:
   original=server.DATA;server.DATA=Path(tmp)
   try:
    s=server.empty()
    for i,k in enumerate(['行政任务','期刊审稿','学生工作','协助评阅']):
     s['tasks'].append({'id':str(i),'title':k+'测试','done':False,'bucket':'今天','deadline':'2026-09-10','affairsType':k,'requester':'独立求助人','reviewJournal':'测试期刊','manuscriptTitle':'测试稿件','assistanceType':'论文'})
    saved=server.write_state(s);self.assertEqual(saved,server.read_state());self.assertEqual(saved['collaborators'],[])
    saved['tasks'][1]['isTemporary']=True;saved['tasks'][1]['done']=True;saved=server.write_state(saved);self.assertEqual(len(saved['tasks']),4);self.assertTrue(server.read_state()['tasks'][1]['done'])
    restored=server.write_state(saved,restore=True);self.assertEqual(restored['tasks'],saved['tasks']);self.assertTrue(restored['tasks'][1]['isTemporary']);self.assertNotIn('isTemporary',restored['tasks'][0]);self.assertEqual(restored['collaborators'],[])
    for fields in [{'isTemporary':'true'},{'reviewJournal':''},{'manuscriptTitle':''},{'affairsType':'错误分类'}]:
     bad=copy.deepcopy(restored);bad['tasks'][1].update(fields)
     with self.assertRaises(ValueError):server.write_state(bad)
    self.assertEqual(server.read_state(),restored)
   finally:server.DATA=original
