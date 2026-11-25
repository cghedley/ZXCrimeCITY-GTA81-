import z80, re, random, sys, struct
code=open('crime.bin','rb').read()
sym={}
for l in open('crime_pp.asm'): pass
# symbol table from listing
import subprocess
lst=subprocess.run(['pasmo','--bin','-1','crime_pp.asm','/tmp/x.bin'],capture_output=True,text=True).stdout
for m_ in re.finditer(r'^([0-9A-F]{4}):\t\tlabel (\w+)',lst,re.M): sym[m_.group(2)]=int(m_.group(1),16)
from mkp import make_p
P=make_p(code)
KEYROWS={0xFE:['SHIFT','Z','X','C','V'],0xFD:['A','S','D','F','G'],0xFB:['Q','W','E','R','T'],
 0xF7:['1','2','3','4','5'],0xEF:['0','9','8','7','6'],0xDF:['P','O','I','U','Y'],
 0xBF:['ENTER','L','K','J','H'],0x7F:['SPACE','.','M','N','B']}
class Sim:
    def __init__(s,seed=1):
        s.m=z80.Z80Machine(); s.pressed=set(); s.rng=random.Random(seed)
        s.m.memory[0x4009:0x4009+len(P)]=P
        s.m.memory[0x0F2B]=0xC9
        s.m.memory[0x7FEE]=0x00; s.m.memory[0x7FEF]=0x70
        s.m.set_breakpoint(0x7000)
        s.m.sp=0x7FEE; s.m.pc=0x4082
        s.m.set_input_callback(s.inp)
        s.ports=0
        s.frames=0
    def inp(s,port):
        hi=(port>>8)&0xFF; lo=port&0xFF
        s.ports+=1
        assert lo==0xFE,('bad port',hex(port))
        v=0xFF
        for row,keys in KEYROWS.items():
            if not (hi & (~row & 0xFF)) and False: pass
        for row,keys in KEYROWS.items():
            # row selected when its address bit is 0 in hi
            bit=[0xFE,0xFD,0xFB,0xF7,0xEF,0xDF,0xBF,0x7F].index(row)
            if (hi>>bit)&1==0:
                for i,k in enumerate(keys):
                    if k in s.pressed: v&=~(1<<i)
        return v
    def mem(s,a,n=1): return bytes(s.m.memory[a:a+n])
    def b(s,name): return s.m.memory[sym[name]]
    def w(s,name): return s.m.memory[sym[name]]|(s.m.memory[sym[name]+1]<<8)
    def screen(s):
        df=s.m.memory[0x400C]|(s.m.memory[0x400D]<<8)
        rows=[]
        for r in range(22):
            base=df+1+33*r
            rows.append(bytes(s.m.memory[base:base+32]))
        return rows
    def text(s):
        inv={0:' ',11:'"',13:'$',14:':',15:'?',16:'(',17:')',18:'>',19:'<',20:'=',21:'+',22:'-',23:'*',24:'/',25:';',26:',',27:'.'}
        for i in range(10): inv[28+i]=str(i)
        for i in range(26): inv[38+i]=chr(65+i)
        def ch(c):
            if c in inv: return inv[c]
            if c==0x80: return '#'
            if c==0x88: return '%'
            if c==0xB5: return '&'   # player foot
            if c==0xB4: return '@'   # player car
            if c==0xBF: return 'Z'   # cop (inverse)
            return '?'
        return '\n'.join(''.join(ch(c) for c in r) for r in s.screen())
    def run_frames(s,n,hook=None):
        for _ in range(n):
            # each frame: bump FRAMES (decrement like ZX81) and run ~ 60000 ticks
            f=s.m.memory[0x4034]|(s.m.memory[0x4035]<<8)
            f=(f-1)&0xFFFF
            s.m.memory[0x4034]=f&255; s.m.memory[0x4035]=f>>8
            s.m.ticks_to_stop=60000
            ev=s.m.run()
            s.frames+=1
            if s.m.pc==0x7000: return 'exit'
            if hook: hook(s)
        return 'ok'
if __name__=='__main__':
    s=Sim()
    r=s.run_frames(5)
    print(r, hex(s.m.pc))
    print(s.text())
