from sim import *
import sys
def wall(r,c):
    if c<0 or c>31 or r<0 or r>20: return True
    return 2<=(c%8)<=5 and 2<=(r%6)<=4
def run(seed,frames=6000):
    s=Sim(seed)
    rng=random.Random(seed)
    code_end=sym['HS']
    code0=s.mem(0x4082,code_end-0x4082)
    state={'sp':None,'ev':dict(runover=0,steal=0,crash=0,mission=0,busted=0,maxwant=0,over=0,named=0),'prev':None}
    s.run_frames(5)
    s.pressed={'SPACE'}; s.run_frames(6); s.pressed=set()
    def hook(s):
        m=s.m
        pc=m.pc
        # invariants
        assert s.mem(0x4082,code_end-0x4082)==code0,'code modified'
        df=m.memory[0x400C]|(m.memory[0x400D]<<8)
        assert m.memory[df]==0x76
        for r in range(22): assert m.memory[df+33*(r+1)]==0x76,('dfile row end',r)
        if sym['newframe']<=pc<sym['pausef'] :
            if state['sp'] is None: state['sp']=m.sp
        # game vars (only valid when in game)
        L=s.b('LIVES')
        in_game = L>0
        if in_game and sym['gameloop']<=pc<sym['tick']+0 or True:
            pass
        py,px=s.b('PY'),s.b('PX')
        if L>0 and s.frames>20:
            assert not wall(py,px),('player in wall',py,px,s.frames)
            for i in range(4):
                r,c=s.mem(sym['peds']+2*i,2); assert not wall(r,c),('ped wall',r,c)
            for i in range(3):
                r,c,dy,dx=s.mem(sym['cars']+4*i,4); assert not wall(r,c),('car wall',r,c,s.frames)
                assert (dy,dx) in [(0,1),(0,255),(1,0),(255,0)],('cardir',dy,dx)
            for i in range(3):
                r,c=s.mem(sym['cop']+2*i,2); assert not wall(r,c),('cop wall',r,c,s.frames)
            assert s.b('WANT')<=3 and s.b('CARHP')<=3
            st=state['ev']; st['maxwant']=max(st['maxwant'],s.b('WANT'))
            pv=state['prev']
            cur=dict(score=s.w('SCORE'),lives=L,inc=s.b('INCAR'),hp=s.b('CARHP'),ms=s.b('MSTATE'))
            if pv:
                if cur['score']-pv['score']==100: st['runover']+=1
                if pv['ms']==2 and cur['ms']==0 and cur['score']>pv['score']: st['mission']+=1
                if pv['inc']==0 and cur['inc']==1: st['steal']+=1
                if pv['inc']==1 and cur['hp']<pv['hp']: st['crash']+=1
                if cur['lives']<pv['lives']: st['busted']+=1
            state['prev']=cur
            # random control
            if rng.random()<0.25:
                s.pressed={rng.choice('5678567856785678')} if rng.random()<0.9 else {rng.choice(['0','E'])}
            else: s.pressed=set()
            f=s.frames
            # forced events to cover paths
            if f%50==0 and s.b('INCAR')==0:
                # teleport onto first car
                r,c=s.mem(sym['cars'],2); m.memory[sym['PY']]=r; m.memory[sym['PX']]=c
            if s.b('MSTATE')==1 and s.b('INCAR')==1 and rng.random()<0.3:
                m.memory[sym['PY']]=s.b('MKY'); m.memory[sym['PX']]=s.b('MKX')
            if s.b('MSTATE')==2 and s.b('INCAR')==1 and rng.random()<0.3:
                m.memory[sym['PY']]=s.b('NY'); m.memory[sym['PX']]=s.b('NX')
            if f%120==0 and s.b('WANT')>0:
                r,c=s.mem(sym['cop'],2); m.memory[sym['PY']]=r; m.memory[sym['PX']]=c
    res=s.run_frames(frames,hook)
    return s,state,res
if __name__=='__main__':
    for seed in range(1,6):
        s,state,res=run(seed)
        print(seed,res,'frames',s.frames,'lives',s.b('LIVES'),'score',s.w('SCORE'),state['ev'],'sp',hex(state['sp'] or 0))
