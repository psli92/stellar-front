"""Real Nginx test: no SK deployment, private Docker network and synthetic upstream."""
from pathlib import Path
import json, subprocess, tempfile, time, urllib.request, urllib.error, uuid

root = Path(__file__).resolve().parents[1]
name = 'stellar-front-test-' + uuid.uuid4().hex[:10]
def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()
def get(port, path, data=None, headers=None):
    try:
        response = urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{port}' + path, data=data, headers=headers or {}), timeout=10)
    except urllib.error.HTTPError as error:
        response = error
    return response.status, response.read(), response.headers

provider = '''from http.server import BaseHTTPRequestHandler,HTTPServer
import json
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  status=418 if self.path=='/fail' else 200
  self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers()
  self.wfile.write(json.dumps({'path':self.path,'authorization':self.headers.get('Authorization'),'method':self.command,'body':self.rfile.read(int(self.headers.get('Content-Length',0))).decode()}).encode())
 do_POST=do_GET
HTTPServer(('0.0.0.0',80),Handler).serve_forever()
'''
with tempfile.TemporaryDirectory() as temp:
    file=Path(temp)/'provider.py'; file.write_text(provider)
    try:
        docker('network','create',name)
        docker('build','-t',name,str(root))
        docker('run','-d','--name',name+'-route','--network',name,'--network-alias','sk-route','-v',str(file)+':/provider.py:ro','python:3.12-alpine','python','/provider.py')
        docker('run','-d','--name',name+'-web','--network',name,'--read-only','--tmpfs','/var/cache/nginx','--tmpfs','/var/run','--tmpfs','/tmp','-p','127.0.0.1::80',name)
        port=docker('port',name+'-web','80/tcp').rsplit(':',1)[1]
        for attempt in range(60):
            try:
                if get(port,'/health/ready')[0]==200: break
            except (OSError,urllib.error.URLError): pass
            time.sleep(.5)
        else: raise AssertionError('Nginx did not become ready')
        assert get(port,'/')[0]==200
        assert get(port,'/future/page')[0]==200
        assert get(port,'/assets/missing.js')[0]==404
        assert get(port,'/assets/missing.mjs')[0]==404
        for module in ['main.mjs', 'bootstrap.mjs']:
            status,body,headers=get(port,'/assets/'+module)
            assert status==200 and headers['Content-Type'].split(';')[0]=='text/javascript'
            assert headers['X-Content-Type-Options']=='nosniff'
        assert get(port,'/assets/site.css')[2]['Content-Type'].split(';')[0]=='text/css'
        for path in ['/api/internal/sk/auth/login','/api/_router/routes']:
            assert get(port,path)[0]==404
        status,body,headers=get(port,'/api/FR/public/bootstrap?client=demo')
        assert status==200 and json.loads(body)['path']=='/FR/public/bootstrap?client=demo'
        assert json.loads(body)['authorization'] is None
        status,body,headers=get(port,'/api/login_check',b'{"username":"synthetic"}',{'Content-Type':'application/json','Authorization':'Bearer caller.token'})
        assert json.loads(body)=={'path':'/login_check','authorization':'Bearer caller.token','method':'POST','body':'{"username":"synthetic"}'}
        assert get(port,'/api/fail')[0]==418
        assert 'text/html' in get(port,'/')[2]['Content-Type']
        assert "script-src 'self'" in get(port,'/')[2]['Content-Security-Policy']
        # Recreate the upstream: proxy must recover without rebuilding/restarting the web container.
        docker('rm','-f',name+'-route')
        docker('run','-d','--name',name+'-route','--network',name,'--network-alias','sk-route','-v',str(file)+':/provider.py:ro','python:3.12-alpine','python','/provider.py')
        for attempt in range(45):
            if get(port,'/api/FR/public/bootstrap')[0]==200: break
            time.sleep(1)
        else: raise AssertionError('Proxy did not recover after upstream restart')
        print('Nginx: static files, fallback, prefix, query, body, caller token, upstream status, private paths and DNS refresh: OK')
    finally:
        for container in [name+'-web',name+'-route']:
            subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run(['docker','network','rm',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run(['docker','image','rm',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
