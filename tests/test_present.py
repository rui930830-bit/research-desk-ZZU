import unittest,copy,tempfile
from pathlib import Path
import server
class Present(unittest.TestCase):
 def test_ongoing_roundtrip_and_validation(self):
  with tempfile.TemporaryDirectory() as tmp:
   old=server.DATA;server.DATA=Path(tmp)
   try:
    s=server.empty();s['projects']=[{'id':'p','title':'投稿','stages':[{'id':'s','title':'投稿','weight':1,'done':False,'start':'2026-01-01','end':'present'}]}]
    saved=server.write_state(s);self.assertEqual(server.read_state(),saved)
    restored=server.write_state(saved,restore=True);self.assertEqual(restored['projects'][0]['stages'][0]['end'],'present')
    for fields in [{'start':''},{'start':'2999-01-01'},{'done':True}]:
     bad=copy.deepcopy(restored);bad['projects'][0]['stages'][0].update(fields)
     with self.assertRaises(ValueError):server.write_state(bad)
    self.assertEqual(server.read_state(),restored)
   finally:server.DATA=old
