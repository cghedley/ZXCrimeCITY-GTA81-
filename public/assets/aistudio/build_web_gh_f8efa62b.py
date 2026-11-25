import json,base64,sys
t=open('template_gh.html',encoding='utf-8').read()
z=open('z80.js').read()
sym=json.load(open('sym.json'))
need={k:sym[k] for k in ['HS','title','go2','SCORE']}
p=base64.b64encode(open('../crimecity.p','rb').read()).decode()
t=t.replace('/*Z80JS*/',z).replace('/*SYM*/',json.dumps(need)).replace('/*P*/',p)
out=sys.argv[1] if len(sys.argv)>1 else 'index.html'
open(out,'w',encoding='utf-8').write(t); print(out,len(t))
