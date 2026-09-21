import unittest, tempfile, copy
from pathlib import Path
import server
class Followup(unittest.TestCase):
 def test_optional_plan_and_explicit_pending_flag_persist(self):
  original=server.DATA
  with tempfile.TemporaryDirectory() as tmp:
   server.DATA=Path(tmp)
   try:
    s=server.empty();s['students']=[dict(id='s',title='测试学生',followup='',followupPending=False,guidance=[dict(id='g',date='2026-09-20',content='已完成',feedback='',followup='',workType='论文指导')])]
    s=server.write_state(s);self.assertEqual(server.read_state()['students'][0]['followup'],'')
    s['students'][0].update(followup='2026-09-25',followupPending=True);s=server.write_state(s)
    self.assertEqual(server.read_state()['students'][0]['followup'],'2026-09-25');self.assertTrue(server.read_state()['students'][0]['followupPending'])
    invalid=copy.deepcopy(s);invalid['students'][0]['followupPending']='true'
    with self.assertRaises(ValueError):server.write_state(invalid)
    self.assertEqual(server.read_state(),s)
   finally:server.DATA=original
