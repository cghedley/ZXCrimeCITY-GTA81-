import json, os, subprocess, sys, tempfile, shutil, importlib.util
import os
repo=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec=importlib.util.spec_from_file_location('add_score',repo+'/.github/scripts/add_score.py'); A=importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
# --- check code must equal the JS one
import subprocess
js=subprocess.run(['node','-e',"""
const w={}; global.window=w;
const src=require('fs').readFileSync(process.argv[1],'utf8');
const m=src.match(/function checkCode[\\s\\S]*?\\n}\\n/)[0]; eval(m+';console.log(JSON.stringify([checkCode("ABC",1234),checkCode("ZZZ",65535),checkCode("QXQ",1)]))');""",repo+'/docs/index.html'],capture_output=True,text=True)
print('js',js.stdout.strip(), js.stderr[:200])
py=[A.check_code('ABC',1234),A.check_code('ZZZ',65535),A.check_code('QXQ',1)]
assert json.loads(js.stdout)==py,(js.stdout,py); print('check code JS==PY',py)
def body(n,s,code=None): return f"### Initials\n\n{n}\n\n### Score\n\n{s}\n\n### Check code\n\n{code or A.check_code(n,s)}\n"
def issue(num,n,s,user='alice',code=None,title=None,typ='User'): return {'number':num,'title':title or f'[score] {n} {s}','body':body(n,s,code),'user':{'login':user,'type':typ}}
tests=[
 (issue(1,'ABC',1234),'added'),
 (issue(2,'abc',99,code=A.check_code('ABC',99)),'added'),       # lower-case initials are normalised
 (issue(3,'AB',10),'rejected'),(issue(4,'ABC',70000),'rejected'),(issue(5,'ABC','12x'),'rejected'),
 (issue(6,'ABC',500,code='deadbeef'),'rejected'),(issue(7,'ABC',500,typ='Bot'),'rejected'),
 ({'number':8,'title':'[score] x','body':'just text','user':{'login':'bob','type':'User'}},'rejected'),
]
entries=[]
for iss,exp in tests:
    st,msg,kept=A.evaluate(iss,entries)
    assert st==exp,(iss['number'],st,msg)
    if st=='added': entries=kept
    print(iss['number'],st,'-',msg)
# duplicate and per-user cap and ordering
st,_,_=A.evaluate(issue(9,'ABC',1234),entries); assert st=='rejected'
for k,sc in enumerate([5000,4000,3000]):
    st,msg,kept=A.evaluate(issue(20+k,'AAA',sc,user='carol'),entries); assert st=='added',(st,msg); entries=kept
st,msg,kept=A.evaluate(issue(24,'AAA',2000,user='carol'),entries); assert st=='low' and 'higher scores from you' in msg,(st,msg); print(msg)
assert sum(1 for e in entries if e['by']=='carol')==3, entries
assert [e['s'] for e in entries]==sorted([e['s'] for e in entries],reverse=True)
print('per-user cap ok:',[(e['n'],e['s'],e['by']) for e in entries])
# --- end to end with a real git repo + bare remote and a fake API
tmp=tempfile.mkdtemp(); bare=tmp+'/origin.git'; work=tmp+'/work'
subprocess.run(['git','init','--bare','-b','main',bare],check=True,capture_output=True)
shutil.copytree(repo,work); os.chdir(work)
subprocess.run(['git','init','-b','main'],check=True,capture_output=True); subprocess.run(['git','add','-A'],check=True); 
subprocess.run(['git','-c','user.name=t','-c','user.email=t@t','commit','-m','init'],check=True,capture_output=True)
subprocess.run(['git','remote','add','origin',bare],check=True); subprocess.run(['git','push','-u','origin','main'],check=True,capture_output=True)
class FakeApi:
    def __init__(s,issues): s.issues=issues; s.done=[]
    def open_score_issues(s): return s.issues
    def finish(s,n,m,completed): s.done.append((n,completed,m))
spec=importlib.util.spec_from_file_location('add_score2',work+'/.github/scripts/add_score.py'); B=importlib.util.module_from_spec(spec); spec.loader.exec_module(B)
api=FakeApi([issue(1,'ABC',1234),issue(2,'XYZ',999,user='bob'),issue(3,'QQ',5)])
res=B.run(api)
print('results',[(n,s) for n,s,_ in res]); print('closed',[(n,c) for n,c,_ in api.done])
data=json.load(open('docs/data/scores.json')); print('file',[(e['n'],e['s'],e['by']) for e in data['entries']])
assert [e['n'] for e in data['entries']]==['ABC','XYZ']
log=subprocess.run(['git','--git-dir',bare,'log','--oneline'],capture_output=True,text=True).stdout; print(log)
assert 'Add high score' in log
# push failure leaves issues open
B.commit_and_push=None
def boom(): raise RuntimeError('push failed')
api2=FakeApi([issue(9,'DEF',4321,user='dave')])
try: B.run(api2,push=boom)
except RuntimeError: print('push failure -> issue not closed:',api2.done==[])
print('ALL OK')
