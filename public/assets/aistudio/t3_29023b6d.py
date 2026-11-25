from t2 import *
s,state,res=run(2)
print('score',s.w('SCORE'),'pc',hex(s.m.pc))
print(s.text())
def tap(k,n=6):
    s.pressed={k}; r=s.run_frames(n); s.pressed=set(); s.run_frames(6); return r
s.pressed=set(); s.run_frames(10)
print('--- after gameover pause'); print(s.text())
for k in ['Z','5','X','Q']:   # '5' is not a letter -> ignored
    tap(k)
    print('after',k); print('\n'.join(s.text().split('\n')[5:14]))
s.run_frames(5)
print(s.text())
tap('SPACE')
print('--- title again'); print('\n'.join(s.text().split('\n')[:15]))
tap('Q')
print('result pc',hex(s.m.pc), s.run_frames(2))
