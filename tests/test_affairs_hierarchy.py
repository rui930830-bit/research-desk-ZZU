import unittest,copy,tempfile
from pathlib import Path
import server
class AffairsHierarchy(unittest.TestCase):
 def test_roundtrip_and_integrity(self):
  s=server.empty();s['affairProjects']=[dict(id='ap',title='事务项目',requester='甲')];s['tasks']=[dict(id='t',title='任务',bucket='今天',done=False,affairsType='行政任务',taskCategory='事务管理',workType='行政任务',requester='甲',affairProjectId='ap')]
  old=server.DATA
  with tempfile.TemporaryDirectory() as tmp:
   server.DATA=Path(tmp)
   try:
    saved=server.write_state(s);self.assertEqual(server.read_state()['affairProjects'],s['affairProjects'])
    for fields in ({'requester':'乙'},{'affairProjectId':'missing'},{'affairsType':'学术交流','workType':'学术交流'}):
     bad=copy.deepcopy(saved);bad['tasks'][0].update(fields)
     with self.assertRaises(ValueError):server.write_state(bad)
    bad=copy.deepcopy(saved);bad['affairProjects']=[]
    with self.assertRaises(ValueError):server.write_state(bad)
    self.assertEqual(server.read_state(),saved)
   finally:server.DATA=old
