#!/usr/bin/env python3
"""研间: loopback-only local records and file access, Python standard library."""
import argparse, json, os, shutil, subprocess, threading, mimetypes, copy, uuid, re
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs, unquote
from datetime import datetime
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from demo import make_demo, without_demo


INSTANCE = ''

def choose_folder():
    import base64
    script = """[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择要关联的本地文件夹'
try {
  if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Write($dialog.SelectedPath)
  }
} finally { $dialog.Dispose() }
"""
    executable = Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
    return subprocess.run([str(executable), '-NoProfile', '-STA', '-NonInteractive', '-EncodedCommand', base64.b64encode(script.encode('utf-16-le')).decode('ascii')], capture_output=True, text=True, encoding='utf-8', timeout=120, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))

BASE = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get('RESEARCH_DESK_DATA', BASE / 'data'))
LOCK = threading.RLock()
AFFAIR_TYPES = ('行政任务','期刊审稿','学生工作','协助评阅')
COLLECTIONS = ('tasks', 'projects', 'students', 'meetings', 'collaborators')

def empty():
    return {'version': 2, 'revision': 0, **{k: [] for k in COLLECTIONS}}

def migrate(data):
    if not isinstance(data,dict) or data.get('version') not in (1,2): raise ValueError('备份格式或版本不支持')
    if data['version']==2: return copy.deepcopy(data)
    result=copy.deepcopy(data)
    result['version']=2
    result['collaborators']=[]
    names={}
    for project in result.get('projects',[]):
        project.setdefault('collaboratorIds',[])
        # Only unambiguous single Chinese names become profiles automatically.
        name=project.get('collaborators','').strip()
        if re.fullmatch(r'[\u4e00-\u9fff]{2,8}',name):
            if name not in names:
                cid=str(uuid.uuid5(uuid.NAMESPACE_URL,'research-desk:collaborator:'+name))
                names[name]=cid
                result['collaborators'].append({'id':cid,'title':name,'institution':'','position':'','research':'','contact':'','notes':'','archived':False})
            project['collaboratorIds'].append(names[name])
        # Dates are deliberately left unset: historical progress is not a schedule.
    return result

def validate(data):
    if not isinstance(data, dict) or data.get('version') != 2: raise ValueError('工作台版本已更新，请刷新页面后重试')
    if not isinstance(data.get('revision'), int) or data['revision'] < 0: raise ValueError('记录版本无效')
    folders = data.get('affairsFolders', {})
    if not isinstance(folders, dict) or any(k not in AFFAIR_TYPES or not isinstance(v, str) for k,v in folders.items()): raise ValueError('事务文件夹格式不正确')
    ids = set()
    for key in COLLECTIONS:
        if not isinstance(data.get(key), list) or len(data[key]) > 50000: raise ValueError('记录格式不正确')
        for record in data[key]:
            if not isinstance(record, dict) or not isinstance(record.get('id'), str) or record['id'] in ids: raise ValueError('记录标识重复或缺失')
            ids.add(record['id'])
            if not isinstance(record.get('title'), str) or not record['title'].strip(): raise ValueError('名称不能为空')
            for k, value in record.items():
                if k in ('id','title','kind','date','deadline','next','folder','notes','topic','graduation','followup','feedback','agenda','attendees','group','projectId','studentId','meetingId','bucket','collaborators','institution','position','research','contact','targetJournal','affairsType','reviewJournal','manuscriptTitle','reviewNumber','requester','assistanceType','completedOn') and not isinstance(value,str): raise ValueError('字段类型错误：'+k)
            for boolean in ('archived','done','completed','pinned','isTemporary'):
                if boolean in record and not isinstance(record[boolean],bool): raise ValueError('完成状态格式错误')
            for date_field in ('date','deadline','graduation','followup','completedOn'):
                if record.get(date_field):
                    try: datetime.strptime(record[date_field],'%Y-%m-%d')
                    except ValueError: raise ValueError('日期格式错误')
            if key == 'projects':
                if not isinstance(record.get('stages'), list): raise ValueError('阶段格式错误')
                for stage in record.get('stages',[]):
                    if not isinstance(stage, dict) or not isinstance(stage.get('id'),str) or not isinstance(stage.get('title'),str) or not stage['title'].strip() or not isinstance(stage.get('weight'),(int,float)) or not 0 < stage['weight'] <= 10000 or not isinstance(stage.get('done'), bool): raise ValueError('阶段名称、完成状态或权重无效')
                for stage in record['stages']:
                    start,end=stage.get('start',''),stage.get('end','')
                    if not isinstance(start,str) or not isinstance(end,str) or bool(start)!=bool(end): raise ValueError('阶段需填写开始日期及结束日期，或选择至今')
                    if start:
                        ongoing=end=='present'
                        actual_end=datetime.now().date().isoformat() if ongoing else end
                        try:
                            if len(start)!=10 or len(actual_end)!=10: raise ValueError()
                            datetime.strptime(start,'%Y-%m-%d'); datetime.strptime(actual_end,'%Y-%m-%d')
                        except ValueError: raise ValueError('阶段日期格式错误')
                        if actual_end<start: raise ValueError('阶段结束日期不能早于开始日期；至今阶段的开始日期不能晚于今天')
                        if ongoing and stage['done']: raise ValueError('已完成阶段请填写实际结束日期')
            if key == 'projects':
                submissions=record.get('submissions',[])
                if not isinstance(submissions,list): raise ValueError('投稿记录格式错误')
                submission_ids=set()
                for sub in submissions:
                    if not isinstance(sub,dict) or not all(isinstance(sub.get(k),str) for k in ('id','journal','submitted','status','resultDate','manuscriptNo','notes')): raise ValueError('投稿记录字段缺失')
                    if not sub['id'] or sub['id'] in submission_ids or not sub['journal'].strip(): raise ValueError('投稿记录标识或期刊名称无效')
                    submission_ids.add(sub['id'])
                    if sub['status'] not in ('已投稿','编辑处理中','外审中','大修','小修','退稿','撤稿','录用','已发表'): raise ValueError('投稿状态无效')
                    for date_field in ('submitted','resultDate'):
                        if sub[date_field]:
                            try:
                                if len(sub[date_field])!=10: raise ValueError()
                                datetime.strptime(sub[date_field],'%Y-%m-%d')
                            except ValueError: raise ValueError('投稿日期格式错误')
                    if sub['submitted'] and sub['resultDate'] and sub['resultDate']<sub['submitted']: raise ValueError('反馈或结果日期不能早于投稿日期')
            if key == 'projects' and (not isinstance(record.get('studentIds',[]),list) or not all(isinstance(x,str) for x in record.get('studentIds',[]))): raise ValueError('参与学生格式错误')
            if key == 'students':
                if not isinstance(record.get('guidance',[]),list): raise ValueError('指导记录格式错误')
                for note in record.get('guidance',[]):
                    if not isinstance(note,dict) or not all(isinstance(note.get(k),str) for k in ('id','date','content','feedback','followup')): raise ValueError('指导记录字段缺失')
    collaborator_ids={x['id'] for x in data['collaborators']}
    for project in data['projects']:
        links=project.get('collaboratorIds',[])
        if not isinstance(links,list) or not all(isinstance(x,str) and x in collaborator_ids for x in links) or len(links)!=len(set(links)): raise ValueError('合作者关联无效')
    for record in data['tasks']:
        kind=record.get('affairsType','')
        if kind not in ('','行政任务','期刊审稿','学生工作','协助评阅'): raise ValueError('事务类别无效')
        if kind=='期刊审稿' and (not record.get('reviewJournal','').strip() or not record.get('manuscriptTitle','').strip()): raise ValueError('期刊审稿需填写期刊名称和稿件名称')
        if kind=='协助评阅' and record.get('assistanceType','论文') not in ('论文','项目','其他'): raise ValueError('评阅内容类别无效')
        if record.get('bucket') not in ('今天','近期','以后'): raise ValueError('任务分组不正确')
        if not isinstance(record.get('done'),bool): raise ValueError('任务完成状态不正确')
        for field, collection in [('projectId','projects'),('studentId','students'),('meetingId','meetings')]:
            if record.get(field) and record[field] not in {x['id'] for x in data[collection]}: raise ValueError('任务关联的记录不存在')
    json.dumps(data, allow_nan=False)
    return data

def read_state():
    path = DATA / 'workspace.json'
    return validate(migrate(json.loads(path.read_text()))) if path.exists() else empty()

def write_state(data, restore=False):
    if restore: data=migrate(data)
    validate(data)
    with LOCK:
        current = read_state()
        if not restore and data.get('revision') != current['revision']: raise RuntimeError('另一页面已更新记录，请刷新后重试。当前输入仍保留。')
        if not restore:
            data = copy.deepcopy(data)
            previous = {t['id']: t for t in current['tasks']}
            for task in data['tasks']:
                old = previous.get(task['id'], {})
                if not task.get('done'):
                    task.pop('completedOn', None)
                elif not old.get('done') and not task.get('completedOn'):
                    task['completedOn'] = datetime.now().strftime('%Y-%m-%d')
        DATA.mkdir(parents=True, exist_ok=True)
        path = DATA / 'workspace.json'
        if path.exists():
            backups = DATA / 'backups'; backups.mkdir(exist_ok=True)
            shutil.copy2(path, backups / (datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json'))
            for old in sorted(backups.glob('*.json'))[:-100]: old.unlink()
        result = {**data, 'revision': current['revision']+1}
        tmp = DATA / 'workspace.tmp'
        with tmp.open('w') as f:
            json.dump(result, f, ensure_ascii=False, indent=2, allow_nan=False); f.flush(); os.fsync(f.fileno())
        tmp.replace(path)
        return result

def initialize_demo():
    with LOCK:
        if not (DATA/'workspace.json').exists():
            write_state(make_demo(DATA/'demo-files'))

def demo_action(body):
    with LOCK:
        current=read_state()
        if body.get('revision') != current['revision']: raise RuntimeError('记录已更新，请刷新后再试')
        if body.get('action') == 'clear':
            return write_state(without_demo(current))
        if body.get('action') == 'load':
            if any(current[k] for k in COLLECTIONS) or current.get('affairsFolders'): raise ValueError('仅空白工作台可以载入示例，现有记录不会覆盖')
            example=make_demo(DATA/'demo-files');example['revision']=current['revision']
            return write_state(example)
        raise ValueError('无效的示例操作')

def linked_path(collection, record_id, relative=''):
    if collection not in ('projects','students','affairs'): raise ValueError('无效的文件关联')
    state = read_state()
    if collection == 'affairs':
        if record_id not in AFFAIR_TYPES: raise ValueError('无效的事务类别')
        record = {'folder': state.get('affairsFolders', {}).get(record_id, '')}
    else:
        record = next((x for x in state[collection] if x['id']==record_id), None)
    if not record or not record.get('folder'): raise ValueError('请先关联本地文件夹')
    root = Path(record['folder']).expanduser().resolve(strict=True)
    if not root.is_dir(): raise ValueError('关联位置不是文件夹')
    path = (root / relative).resolve(strict=True)
    if not path.is_relative_to(root): raise ValueError('不能访问关联文件夹之外的位置')
    return root, path

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    def output(self, obj, status=200):
        raw = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(raw)
    def guard(self):
        host = self.headers.get('Host','')
        if host not in ('127.0.0.1:4318','localhost:4318','127.0.0.1:4319','localhost:4319'): raise PermissionError('仅允许本机工作台访问')
        origin = self.headers.get('Origin')
        if origin and origin not in ('http://127.0.0.1:4318','http://localhost:4318','http://127.0.0.1:4319','http://localhost:4319'): raise PermissionError('拒绝外部网页访问')
        if self.headers.get('X-Desk-Request') != '1': raise PermissionError('请通过工作台操作')
    def do_GET(self):
        try:
            url = urlsplit(self.path)
            if url.path.startswith('/api/'):
                self.guard()
                if url.path == '/api/state': return self.output(read_state())
                if url.path == '/api/health': return self.output({'app':'research-desk','version':2,'instance':INSTANCE})
                if url.path == '/api/files':
                    q = parse_qs(url.query); root,path = linked_path(q.get('collection',[''])[0],q.get('id',[''])[0],q.get('path',[''])[0])
                    if not path.is_dir(): raise ValueError('不是文件夹')
                    entries=[]
                    for p in path.iterdir():
                        if p.name.startswith('.'): continue
                        try:
                            actual=p.resolve(strict=True)
                            if not actual.is_relative_to(root): continue
                            st=p.stat(); entries.append({'name':p.name,'path':p.relative_to(root).as_posix(),'directory':p.is_dir(),'size':st.st_size,'modified':datetime.fromtimestamp(st.st_mtime).isoformat()})
                        except (OSError,RuntimeError): continue
                    return self.output({'path':path.relative_to(root).as_posix() if path!=root else '', 'root':str(root), 'entries':sorted(entries,key=lambda x:(not x['directory'],x['name'].lower()))})
                return self.output({'error':'接口不存在'},404)
            static = next((p for p in (BASE/'out',BASE/'dist/client') if (p/'index.html').exists()), BASE/'out')
            target=(static/unquote(url.path).lstrip('/')).resolve()
            if not target.is_relative_to(static.resolve()): raise PermissionError('无效路径')
            if target.is_dir(): target=target/'index.html'
            if not target.exists(): return self.output({'error':'页面不存在，请先完成构建'},404)
            self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(str(target))[0] or 'application/octet-stream'); self.send_header('X-Content-Type-Options','nosniff'); self.end_headers(); self.wfile.write(target.read_bytes())
        except PermissionError as e: self.output({'error':str(e)},403)
        except (ValueError,FileNotFoundError,NotADirectoryError) as e: self.output({'error':str(e)},400)
        except Exception: self.output({'error':'读取失败，请检查文件权限或本地数据。'},500)
    def do_POST(self):
        try:
            self.guard()
            n=int(self.headers.get('Content-Length','0'))
            if not 0 < n <= 10_000_000: raise ValueError('请求大小超出限制')
            body=json.loads(self.rfile.read(n))
            if self.path == '/api/demo': return self.output(demo_action(body))
            if self.path == '/api/state': return self.output(write_state(body))
            if self.path == '/api/restore': return self.output(write_state(body,restore=True))
            if self.path == '/api/check-folder':
                path=Path(body['path']).expanduser().resolve(strict=True)
                if not path.is_dir(): raise ValueError('请选择文件夹')
                # Check readability before persisting a new association.
                next(path.iterdir(), None)
                return self.output({'path':str(path)})
            if self.path == '/api/choose-folder':
                result=choose_folder()
                if result.returncode: raise ValueError('文件夹选择窗口无法打开，请直接粘贴文件夹路径')
                if not result.stdout.strip(): return self.output({'cancelled':True})
                return self.output({'path':result.stdout.strip()})
            if self.path == '/api/open':
                _,path=linked_path(body['collection'],body['id'],body.get('path',''))
                if not path.is_dir() and path.suffix.lower() not in {'.doc','.docx','.xls','.xlsx','.csv','.tsv','.pdf','.ppt','.pptx','.txt','.md','.rtf','.png','.jpg','.jpeg','.webp','.gif','.dta','.do','.log','.bib','.tex'}: raise ValueError('此类型请在资源管理器中打开')
                os.startfile(str(path))
                return self.output({'ok':True})
            return self.output({'error':'接口不存在'},404)
        except PermissionError as e: self.output({'error':str(e)},403)
        except RuntimeError as e: self.output({'error':str(e)},409)
        except (ValueError,KeyError,FileNotFoundError,NotADirectoryError) as e: self.output({'error':str(e)},400)
        except subprocess.TimeoutExpired: self.output({'error':'操作超时，请重试'},408)
        except Exception: self.output({'error':'操作未完成，请检查文件权限或磁盘空间'},500)

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=4318); args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    initialize_demo()
    print(f'研间已启动：http://127.0.0.1:{args.port}',flush=True)
    server.serve_forever()
