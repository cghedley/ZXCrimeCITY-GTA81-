const Z80=require('./z80.js'), fs=require('fs');
const P=fs.readFileSync('../crimecity.p'), sym=JSON.parse(fs.readFileSync('sym.json'));
const mem=new Uint8Array(65536); mem.set(P,0x4009); mem[0x0F2B]=0xC9;
let pressed=new Set(); let illegal=0;
const ROWS=[[0xFE,['SHIFT','Z','X','C','V']],[0xFD,['A','S','D','F','G']],[0xFB,['Q','W','E','R','T']],[0xF7,['1','2','3','4','5']],[0xEF,['0','9','8','7','6']],[0xDF,['P','O','I','U','Y']],[0xBF,['ENTER','L','K','J','H']],[0x7F,['SPACE','.','M','N','B']]];
const inp=(port)=>{const hi=(port>>8)&255; let v=0xFF; ROWS.forEach(([row,keys],bit)=>{ if(((hi>>bit)&1)===0) keys.forEach((k,i)=>{ if(pressed.has(k)) v&=~(1<<i); }); }); return v;};
const cpu=new Z80(a=>mem[a], (a,v)=>{ if(a>=0x4000&&a<0x8000) mem[a]=v; else illegal++; }, inp, ()=>{});
mem[0x7FEE]=0; mem[0x7FEF]=0x70; cpu.sp=0x7FEE; cpu.pc=0x4082;
const N=+process.argv[2]||1000000;
const seq=['8','8','6','6','5','7','8','0','6','E','5','7'];
function keyAt(s){ const p=Math.floor(s/4000); if(p<3) return null; if(p===3) return 'SPACE'; if(p%5===0) return null; return (s%4000)<1500? seq[(p*7)%seq.length]:null; }
const g=(n)=>mem[sym[n]];
const out=[]; 
function hash(){ let h=0; for(let i=0x4000;i<0x8000;i++) h=(h*31+mem[i])>>>0; return h; }
for(let s=0;s<N;s++){
  if(s%2500===0){ let f=mem[0x4034]|(mem[0x4035]<<8); f=(f-1)&0xFFFF; mem[0x4034]=f&255; mem[0x4035]=f>>8; }
  const k=keyAt(s); pressed=new Set(k?[k]:[]);
  if(s>200000){
    if(s%60000===0){ mem[sym.PY]=mem[sym.cars]; mem[sym.PX]=mem[sym.cars+1]; }
    if(s%90000===0){ if(g('WANT')>0){ mem[sym.PY]=mem[sym.cop]; mem[sym.PX]=mem[sym.cop+1]; }
      if(g('MSTATE')===1&&g('INCAR')===1){ mem[sym.PY]=g('MKY'); mem[sym.PX]=g('MKX'); }
      if(g('MSTATE')===2&&g('INCAR')===1){ mem[sym.PY]=g('NY'); mem[sym.PX]=g('NX'); } }
  }
  if(cpu.pc===0x7000){ out.push('EXIT'); break; }
  cpu.step();
  const R=cpu.R;
  out.push([cpu.pc.toString(16),((R[7]<<8)|(cpu.f&0xD7)).toString(16),((R[0]<<8)|R[1]).toString(16),((R[2]<<8)|R[3]).toString(16),((R[4]<<8)|R[5]).toString(16),cpu.sp.toString(16)].join(' '));
  if(s%500===0) out.push('H '+hash().toString(16));
}
fs.writeFileSync('trace_js.txt',out.join('\n')); console.log('js steps',out.length,'illegal',illegal,'LIVES',g('LIVES'),'SCORE',mem[sym.SCORE]|(mem[sym.SCORE+1]<<8));
