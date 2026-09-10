import unittest, tempfile, copy
from pathlib import Path
import server
from demo import make_demo, without_demo

class Demo(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  old=server.DATA;server.DATA=Path(self.tmp.name)/'data';self.addCleanup(setattr,server,'DATA',old)
 def test_first_launch_once_and_clear_remains_empty(self):
  server.initialize_demo();saved=server.read_state();server.validate(saved)
  self.assertEqual([len(saved[k]) for k in server.COLLECTIONS],[9,3,4,3,2])
  self.assertTrue(Path(saved['projects'][0]['folder'],'任务清单.csv').exists())
  server.initialize_demo();self.assertEqual(server.read_state(),saved)
  cleared=server.demo_action({'revision':saved['revision'],'action':'clear'})
  self.assertFalse(any(cleared[k] for k in server.COLLECTIONS))
  server.initialize_demo();self.assertEqual(server.read_state(),cleared)
  self.assertTrue(list((server.DATA/'backups').glob('*.json')))
  self.assertTrue(Path(saved['projects'][0]['folder']).exists())
  reloaded=server.demo_action({'revision':cleared['revision'],'action':'load'});self.assertEqual(len(reloaded['tasks']),9)
 def test_existing_data_and_links_preserved(self):
  s=make_demo(server.DATA/'demo-files')
  s['tasks'].append(dict(id='real',title='自建任务',bucket='今天',done=False,projectId='demo-p1'))
  s['projects'].append(dict(id='real-p',title='自建项目',stages=[],studentIds=['demo-s0'],collaboratorIds=['demo-c1']))
  s['affairsFolders']['行政任务']='/my/own/folder'
  s=server.write_state(s);before=copy.deepcopy(s)
  server.initialize_demo();self.assertEqual(server.read_state(),before)
  with self.assertRaises(ValueError):server.demo_action({'revision':s['revision'],'action':'load'})
  with self.assertRaises(RuntimeError):server.demo_action({'revision':s['revision']-1,'action':'clear'})
  clean=server.demo_action({'revision':s['revision'],'action':'clear'})
  self.assertEqual(clean['tasks'][0]['id'],'real');self.assertEqual(clean['tasks'][0]['projectId'],'')
  self.assertEqual(clean['projects'][0]['collaboratorIds'],[])
  self.assertEqual(clean['affairsFolders'],{'行政任务':'/my/own/folder'})
 def test_existing_empty_workspace_is_not_populated(self):
  saved=server.write_state(server.empty());server.initialize_demo();self.assertEqual(saved,server.read_state())
