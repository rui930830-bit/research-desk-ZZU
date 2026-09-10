#!/usr/bin/env python3
"""Start the installed, pre-built workspace without npm or network access."""
import os, sys, time, subprocess, urllib.request, json, webbrowser
from pathlib import Path
BASE=Path(__file__).resolve().parent
URL='http://127.0.0.1:4318'
def healthy():
    try:
        req=urllib.request.Request(URL+'/api/health',headers={'X-Desk-Request':'1'})
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req,timeout=1) as r: return json.load(r).get('app')=='research-desk'
    except Exception: return False
if not healthy():
    if not (BASE/'dist/client/index.html').exists():
        sys.exit('未找到已构建的页面，请在本目录执行 npm run build。')
    (BASE/'data').mkdir(exist_ok=True)
    with (BASE/'data/server.log').open('a') as log:
        proc=subprocess.Popen([sys.executable,str(BASE/'server.py')],cwd=BASE,stdout=log,stderr=log,start_new_session=True)
    for _ in range(50):
        if healthy(): break
        if proc.poll() is not None: sys.exit('工作台未能启动，端口可能被占用。详见 data/server.log。')
        time.sleep(.15)
    else: sys.exit('启动超时，请查看 data/server.log。')
if '--no-open' not in sys.argv: webbrowser.open(URL)
print('研间已启动：'+URL+'\n可以关闭此终端窗口，工作台会继续运行。')
