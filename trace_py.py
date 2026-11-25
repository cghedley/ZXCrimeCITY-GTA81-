import z80, json, sys
P=open('/home/claude/crimecity.p','rb').read(); sym=json.load(open('/home/claude/web/sym.json'))
m=z80.Z80Machine(); m.memory[0x4009:0x4009+len(P)]=P; m.memory[0x0F2B]=0xC9
pressed=set()
ROWS=[(0xFE,['SHIFT','Z','X','C','V']),(0xFD,['A','S','D','F','G']),(0xFB,['Q','W','E','R','T']),(0xF7,['1','2','3','4','5']),(0xEF,['0','9','8','7','6']),(0xDF,['P','O','I','U','Y']),(0xBF,['ENTER','L','K','J','H']),(0x7F,['SPACE','.','M','N','B'])]
def inp(port):
    hi=(port>>8)&255; v=0xFF
    for bit,(row,keys) in enumerate(ROWS):
        if ((hi>>bit)&1)==0:
            for i,k in enumerate(keys):
                if k in pressed: v&=~(1<<i)
    return v
m.set_input_callback(inp)
M=m.memory
M[0x7FEE]=0; M[0x7FEF]=0x70; m.sp=0x7FEE; m.pc=0x4082; m.af=0; m.bc=0; m.de=0; m.hl=0
N=int(sys.argv[1]) if len(sys.argv)>1 else 1000000
seq=['8','8','6','6','5','7','8','0','6','E','5','7']
def keyAt(s):
    p=s//4000
    if p<3: return None
    if p==3: return 'SPACE'
    if p%5==0: return None
    return seq[(p*7)%len(seq)] if (s%4000)<1500 else None
g=lambda n:M[sym[n]]
out=[]
def h():
    x=0
    for i in range(0x4000,0x8000): x=(x*31+M[i])&0xFFFFFFFF
    return x
for s in range(N):
    if s%2500==0:
        f=M[0x4034]|(M[0x4035]<<8); f=(f-1)&0xFFFF; M[0x4034]=f&255; M[0x4035]=f>>8
    k=keyAt(s); pressed.clear()
    if k: pressed.add(k)
    if s>200000:
        if s%60000==0: M[sym['PY']]=M[sym['cars']]; M[sym['PX']]=M[sym['cars']+1]
        if s%90000==0:
            if g('WANT')>0: M[sym['PY']]=M[sym['cop']]; M[sym['PX']]=M[sym['cop']+1]
            if g('MSTATE')==1 and g('INCAR')==1: M[sym['PY']]=g('MKY'); M[sym['PX']]=g('MKX')
            if g('MSTATE')==2 and g('INCAR')==1: M[sym['PY']]=g('NY'); M[sym['PX']]=g('NX')
    if m.pc==0x7000: out.append('EXIT'); break
    pc0=m.pc; op=(M[pc0],M[(pc0+1)&0xFFFF])
    while True:
        m.ticks_to_stop=1; m.run()
        if op in ((0xED,0xB0),(0xED,0xB8)) and m.pc==pc0: continue
        break
    out.append(' '.join('%x'%v for v in (m.pc,(m.af&0xFFFF)&0xFFD7,m.bc,m.de,m.hl,m.sp)))
    if s%500==0: out.append('H %x'%h())
open('/home/claude/web/trace_py.txt','w').write('\n'.join(out))
print('py steps',len(out),'LIVES',g('LIVES'),'SCORE',M[sym['SCORE']]|(M[sym['SCORE']+1]<<8))
