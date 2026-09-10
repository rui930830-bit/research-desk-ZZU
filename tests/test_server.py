import unittest, tempfile, copy, threading, json, urllib.request, urllib.error
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class Records(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.old=server.DATA;server.DATA=Path(self.tmp.name)/'data';self.addCleanup(setattr,server,'DATA',self.old)
  self.root=Path(self.tmp.name).resolve()/'files';self.root.mkdir();(self.root/'a.docx').write_text('test');(self.root/'sub').mkdir();(self.root/'sub'/'a.xlsx').write_text('test')
  self.s=server.empty();self.s['projects']=[{'id':'p1','title':'论文','folder':str(self.root),'stages':[{'id':'s1','title':'分析','weight':1,'done':False}]}];self.s['students']=[{'id':'s1','title':'学生','guidance':[]}];self.s['meetings']=[{'id':'m1','title':'组会'}];self.s['tasks']=[{'id':'t1','title':'修改论文','bucket':'今天','done':False,'projectId':'p1','studentId':'s1','meetingId':'m1'}]
 def test_roundtrip_backup_restore(self):
  saved=server.write_state(self.s);self.assertEqual(saved,server.read_state());changed=copy.deepcopy(saved);changed['tasks'][0]['done']=True;server.write_state(changed);self.assertEqual(len(list((server.DATA/'backups').glob('*.json'))),1);restored=server.write_state(saved,restore=True);self.assertFalse(restored['tasks'][0]['done']);self.assertEqual(restored['revision'],3)
 def test_stale_write_preserves_new_data(self):
  saved=server.write_state(self.s)
  with self.assertRaises(RuntimeError):server.write_state(self.s)
  self.assertEqual(saved,server.read_state())
 def test_invalid_restore_preserves_data(self):
  saved=server.write_state(self.s);bad=copy.deepcopy(saved);bad['projects'][0]['stages'][0]['weight']=-1
  with self.assertRaises(ValueError):server.write_state(bad,restore=True)
  self.assertEqual(saved,server.read_state())
 def test_broken_reference(self):
  self.s['tasks'][0]['studentId']='missing'
  with self.assertRaises(ValueError):server.write_state(self.s)
 def test_path_escape_and_symlink(self):
  server.write_state(self.s);outside=Path(self.tmp.name)/'outside.txt';outside.write_text('outside');(self.root/'escape').symlink_to(outside)
  for p in ['../outside.txt','escape',str(outside)]:
   with self.assertRaises(ValueError):server.linked_path('projects','p1',p)
  self.assertEqual(server.linked_path('projects','p1','sub/a.xlsx')[1],self.root/'sub'/'a.xlsx')
 def test_backups_bounded(self):
  saved=server.write_state(self.s)
  for _ in range(105):saved=server.write_state(saved)
  self.assertEqual(len(list((server.DATA/'backups').glob('*.json'))),100)

class HTTP(Records):
 def setUp(self):
  super().setUp();server.write_state(self.s);self.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);threading.Thread(target=self.http.serve_forever,daemon=True).start();self.addCleanup(self.http.server_close);self.addCleanup(self.http.shutdown);self.url='http://127.0.0.1:'+str(self.http.server_port)
 def request(self,path,body=None,headers=None):
  req=urllib.request.Request(self.url+path,data=None if body is None else json.dumps(body).encode(),headers={'Host':'127.0.0.1:4318','X-Desk-Request':'1',**(headers or {})})
  with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req) as r:return json.load(r)
 def test_external_origin_denied(self):
  with self.assertRaises(urllib.error.HTTPError) as cm:self.request('/api/state',headers={'Origin':'https://example.com'})
  self.assertEqual(cm.exception.code,403)
 def test_missing_header_denied(self):
  with self.assertRaises(urllib.error.HTTPError) as cm:self.request('/api/state',headers={'X-Desk-Request':''})
  self.assertEqual(cm.exception.code,403)
 def test_list_and_open_document(self):
  files=self.request('/api/files?collection=projects&id=p1');self.assertEqual(files['entries'][0]['name'],'sub')
  with patch('server.subprocess.run') as run:
   self.assertTrue(self.request('/api/open',{'collection':'projects','id':'p1','path':'sub/a.xlsx'})['ok']);self.assertEqual(run.call_args.args[0],['/usr/bin/open',str(self.root/'sub'/'a.xlsx')])
 def test_restore_http(self):
  old=self.request('/api/state');changed=copy.deepcopy(old);changed['tasks'][0]['done']=True;self.request('/api/state',changed);restored=self.request('/api/restore',old);self.assertFalse(restored['tasks'][0]['done'])
 # Record tests run independently in Records; HTTP has a populated store.
 test_roundtrip_backup_restore=None
 test_stale_write_preserves_new_data=None
 test_invalid_restore_preserves_data=None
 test_broken_reference=None
 test_path_escape_and_symlink=None
 test_backups_bounded=None

if __name__=='__main__':unittest.main()
