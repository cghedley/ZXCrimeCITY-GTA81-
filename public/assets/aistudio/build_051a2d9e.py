import re,subprocess,struct
MAP={' ':0,'"':11,'$':13,':':14,'?':15,'(':16,')':17,'>':18,'<':19,'=':20,'+':21,'-':22,'*':23,'/':24,';':25,',':26,'.':27}
for i,c in enumerate('0123456789'): MAP[c]=28+i
for i,c in enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZ'): MAP[c]=38+i
def z(s):
    bad=[c for c in s if c not in MAP]; assert not bad,(s,bad)
    return [MAP[c] for c in s]
out=[]
for l in open('crime.asm'):
    m=re.match(r'^(\w+:)?\s*ZS\s+(\d+),(\d+),"(.*)"\s*$',l)
    if m:
        r,c,s=int(m.group(2)),int(m.group(3)),m.group(4)
        assert c+len(s)<=32,(s,c)
        out.append((m.group(1) or '')+'  DEFB '+','.join(map(str,[r,c]+z(s)+[255]))); continue
    m=re.match(r'^(\w+:)?\s*ZB\s+"(.*)"\s*$',l)
    if m: out.append((m.group(1) or '')+'  DEFB '+','.join(map(str,z(m.group(2))))); continue
    m=re.match(r'^(\w+:)?\s*HSE\s+"(\w+)",(\d+)\s*$',l)
    if m:
        v=int(m.group(3)); out.append((m.group(1) or '')+'  DEFB '+','.join(map(str,z(m.group(2))+[v&255,v>>8]))); continue
    out.append(l.rstrip('\n'))
open('crime_pp.asm','w').write('\n'.join(out)+'\n')
r=subprocess.run(['pasmo','--bin','--listing' if False else '-1','crime_pp.asm','crime.bin'],capture_output=True,text=True)
print(r.stdout,r.stderr)
assert r.returncode==0
code=open('crime.bin','rb').read()
print('code bytes',len(code))
# symbols
r=subprocess.run(['pasmo','--bin','crime_pp.asm','crime.bin','crime.sym'],capture_output=True,text=True)
