import unittest,tempfile,copy
from pathlib import Path
import server
class Submissions(unittest.TestCase):
 def test_history_target_and_restore(self):
  with tempfile.TemporaryDirectory() as tmp:
   original=server.DATA;server.DATA=Path(tmp)
   try:
    s=server.empty();p={'id':'p','title':'论文','kind':'学术论文','targetJournal':'首选甲，备选乙','stages':[],'submissions':[]};s['projects']=[p]
    first={'id':'a','journal':'期刊甲','submitted':'2026-01-01','status':'退稿','resultDate':'2026-02-01','manuscriptNo':'A1','notes':'修改建议'}
    p['submissions']=[first,{'id':'b','journal':'期刊乙','submitted':'2026-03-01','status':'录用','resultDate':'2026-07-01','manuscriptNo':'B1','notes':''}]
    saved=server.write_state(s);changed=copy.deepcopy(saved);changed['projects'][0]['targetJournal']='期刊丙';changed=server.write_state(changed)
    self.assertEqual(changed['projects'][0]['submissions'],p['submissions'])
    restored=server.write_state(saved,restore=True);self.assertEqual(restored['projects'][0]['submissions'][0],first)
    for fields in [{'resultDate':'2025-01-01'},{'submitted':'2026-02-30'},{'status':'bad'},{'journal':''}]:
     bad=copy.deepcopy(restored);bad['projects'][0]['submissions'][0].update(fields)
     with self.assertRaises(ValueError):server.write_state(bad)
    self.assertEqual(server.read_state(),restored)
   finally:server.DATA=original
