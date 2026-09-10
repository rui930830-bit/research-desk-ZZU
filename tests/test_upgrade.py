import unittest, copy, json
from pathlib import Path
from test_server import Records
import server
class Upgrade(Records):
 def test_v1_preserves_all_original_fields(self):
  old=copy.deepcopy(self.s);old['version']=1;old.pop('collaborators',None);old['projects'][0]['collaborators']='示例合作者';original=copy.deepcopy(old)
  new=server.validate(server.migrate(old));self.assertEqual(old,original);self.assertEqual(new['collaborators'][0]['title'],'示例合作者');self.assertEqual(new['projects'][0]['collaboratorIds'],[new['collaborators'][0]['id']]);self.assertEqual(new['projects'][0]['stages'],old['projects'][0]['stages'])
  for k in ['tasks','students','meetings']:self.assertEqual(new[k],old[k])
  self.assertEqual(server.migrate(new),new)
  for k,v in old['projects'][0].items():self.assertEqual(new['projects'][0][k],v)
 def test_old_backup_restore_and_profiles_roundtrip(self):
  old=copy.deepcopy(self.s);old['version']=1;old.pop('collaborators',None);old['projects'][0]['collaborators']='示例合作者';saved=server.write_state(old,restore=True);saved['collaborators'][0]['institution']='示例大学';saved=server.write_state(saved);self.assertEqual(server.read_state()['collaborators'][0]['institution'],'示例大学')
 def test_dates_and_links_reject_without_overwrite(self):
  saved=server.write_state(self.s)
  for start,end in [('2026-09-08','2026-09-07'),('2026-09-01',''),('2026-02-30','2026-03-02')]:
   bad=copy.deepcopy(saved);bad['projects'][0]['stages'][0].update(start=start,end=end)
   with self.assertRaises(ValueError):server.write_state(bad)
  bad=copy.deepcopy(saved);bad['projects'][0]['collaboratorIds']=['missing']
  with self.assertRaises(ValueError):server.write_state(bad)
  self.assertEqual(server.read_state(),saved)
 def test_old_page_cannot_remove_profiles(self):
  old=copy.deepcopy(self.s);old['version']=1;old.pop('collaborators',None)
  with self.assertRaises(ValueError):server.write_state(old)
