import unittest, tempfile, copy
from pathlib import Path
import server

class AffairFolders(unittest.TestCase):
    def test_persistence_restore_and_path_boundaries(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = server.DATA
            server.DATA = Path(tmp)/'data'
            try:
                state = server.empty()
                server.write_state(state)
                with self.assertRaises(ValueError): server.linked_path('affairs', '期刊审稿')
                state = server.read_state()
                folders = {}
                for i, kind in enumerate(server.AFFAIR_TYPES):
                    folder = Path(tmp)/str(i); folder.mkdir()
                    (folder/'稿件.txt').write_text(kind)
                    (folder/'子目录').mkdir()
                    folders[kind] = str(folder)
                state['affairsFolders'] = folders
                saved = server.write_state(state)
                self.assertEqual(server.read_state()['affairsFolders'], folders)
                for kind in folders:
                    root, path = server.linked_path('affairs', kind, '稿件.txt')
                    self.assertEqual(path.read_text(), kind)
                    self.assertEqual(root, Path(folders[kind]).resolve())
                    self.assertTrue(server.linked_path('affairs', kind, '子目录')[1].is_dir())
                outside = Path(tmp)/'outside.txt'; outside.write_text('outside')
                (Path(folders['期刊审稿'])/'escape').symlink_to(outside)
                for relative in ['../outside.txt', 'escape', str(outside)]:
                    with self.assertRaises(ValueError): server.linked_path('affairs', '期刊审稿', relative)
                with self.assertRaises(ValueError): server.linked_path('affairs', '不存在')
                restored = server.write_state(saved, restore=True)
                self.assertEqual(restored['affairsFolders'], folders)
                for invalid in [[], {'错误分类':'/tmp'}, {'期刊审稿':123}]:
                    bad=copy.deepcopy(restored);bad['affairsFolders']=invalid
                    with self.assertRaises(ValueError):server.write_state(bad)
                self.assertEqual(server.read_state(), restored)
            finally: server.DATA=original
