from sim import *
def call(s,addr):
    m=s.m
    m.memory[0x7FEE]=0; m.memory[0x7FEF]=0x70
    m.sp=0x7FEE; m.pc=addr
    m.ticks_to_stop=5_000_000
    m.run()
    assert m.pc==0x7000,hex(m.pc)
def table(s):
    out=[]
    base=sym['HS']
    for i in range(5):
        e=s.mem(base+5*i,5)
        name=''.join(chr(65+c-38) for c in e[:3]); out.append((name,e[3]|(e[4]<<8)))
    return out
for sc in [4000,2000,600,400,5000,65535,501,500]:
    s=Sim(1)
    s.m.memory[sym['SCORE']]=sc&255; s.m.memory[sym['SCORE']+1]=sc>>8
    for i,c in enumerate([63,64-1,61]): s.m.memory[sym['NAMEBUF']+i]=c   # Z ? X
    s.m.memory[sym['NAMEBUF']+1]=38  # 'A'
    call(s,sym['qualify']); q=s.m.a
    t0=table(s)
    if q: call(s,sym['inserths'])
    print(sc,'qualify',q,table(s))
