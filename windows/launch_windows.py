"""Local Windows launcher. Closing this console stops the service."""
import hashlib, json, os, sys, threading, traceback, urllib.request, webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer
import server

URL = 'http://127.0.0.1:4318'

def data_path():
    return Path(os.environ.get('LOCALAPPDATA', Path.home()/'AppData/Local'))/'ResearchDesk/data'

def main():
    server.DATA = data_path()
    server.DATA.mkdir(parents=True, exist_ok=True)
    server.INSTANCE = hashlib.sha256(str(server.DATA.resolve()).encode()).hexdigest()
    try:
        httpd = ThreadingHTTPServer(('127.0.0.1', 4318), server.Handler)
    except OSError as exc:
        try:
            req = urllib.request.Request(URL+'/api/health',headers={'X-Desk-Request':'1'})
            with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=2) as response:
                health=json.load(response)
            if health.get('app')=='research-desk' and health.get('instance')==server.INSTANCE:
                webbrowser.open(URL)
                print('研间已经运行，已重新打开网页。请保留原来的启动窗口。')
                return
        except Exception:
            pass
        raise RuntimeError('端口 4318 已被其他程序或另一份研间占用，请先关闭对应程序后再启动。') from exc
    try:
        if not (server.BASE/'dist/client/index.html').exists():
            raise RuntimeError('缺少网页文件，请先完整解压整个分享包。')
        server.read_state()  # Fail without replacing existing corrupt data.
        print('研间已启动：'+URL, flush=True)
        print('请保留此窗口，可以最小化；关闭窗口即退出研间。', flush=True)
        print('下次使用请再次双击“启动研间.cmd”，浏览器收藏本身不会启动程序。', flush=True)
        print('数据目录：'+str(server.DATA), flush=True)
        threading.Timer(.5, lambda: webbrowser.open(URL)).start()
        httpd.serve_forever(poll_interval=.3)
    except KeyboardInterrupt:
        print('研间已退出。')
    finally:
        httpd.server_close()

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print('启动失败：'+str(exc), flush=True)
        try:
            path=data_path();path.mkdir(parents=True,exist_ok=True)
            (path/'startup-error.log').write_text(traceback.format_exc(),encoding='utf-8')
        except Exception:
            pass
        sys.exit(1)
