const {JSDOM}=require('jsdom'); const fs=require('fs'); const sym=require('./sym.json');
const html=fs.readFileSync('index.html','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let central={entries:[{n:'ZZZ',s:9000}]}, fetchFail=false, fetched=[];
async function mk(url){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url,beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(a,b)=>({data:new Uint8ClampedArray(a*b*4)}),putImageData(){}});
    w.fetch=async(u)=>{ fetched.push(u); if(fetchFail) return {ok:false,status:500,json:async()=>({})}; if(/scores\.json/.test(u)) return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(central))}; return {ok:false,status:404}; };
  }});
  const w=dom.window; await sleep(300); const Z=w.__crimecity, m=Z.mem;
  const text=()=>{ const df=m[0x400C]|(m[0x400D]<<8); const rows=[]; for(let r=0;r<24;r++){ let s=''; for(let c=0;c<32;c++){ const k=m[df+1+33*r+c]; s+= k===0?' ': k>=38&&k<=63?String.fromCharCode(65+k-38): k>=28&&k<=37?String(k-28):'#'; } rows.push(s);} return rows; };
  const key=async(code,hold=120)=>{ const ev=(t)=>new w.KeyboardEvent(t,{code,bubbles:true,cancelable:true}); w.dispatchEvent(ev('keydown')); await sleep(hold); w.dispatchEvent(ev('keyup')); await sleep(80); };
  const table=()=>text().slice(9,14).map(s=>s.trim()).join(' | ');
  return {w,Z,m,text,key,table,doc:w.document};
}
(async()=>{
  const t=await mk('https://alice.github.io/crimecity/');
  await t.key('Space'); await sleep(1500);
  console.log('TITLE   ',t.table(),'|',t.doc.getElementById('srcText').textContent);
  console.log('fetched ',fetched[0]);
  await t.key('Space'); await sleep(900);
  t.m[sym.SCORE]=7000&255; t.m[sym.SCORE+1]=7000>>8; t.m[sym.LIVES]=0; await sleep(3500);
  await t.key('KeyA'); await t.key('KeyB'); await t.key('KeyC'); await sleep(1500);
  console.log('AFTER   ',t.table());
  const box=t.doc.getElementById('submitBox'), a=t.doc.getElementById('submitLink');
  console.log('box hidden?',box.hidden,'|',t.doc.getElementById('submitText').textContent);
  console.log('link    ',a.href);
  const code=t.Z.checkCode('ABC',7000); console.log('code ok ',a.href.endsWith('check='+code));
  console.log('pending ',t.w.localStorage.getItem('crimecity.pending.v2'));
  // the Action accepts it
  central={entries:[{n:'ZZZ',s:9000},{n:'ABC',s:7000,by:'alice'}]};
  await t.key('Space'); await sleep(900);     // leave table screen -> title -> refresh
  console.log('ACCEPTED',t.table(),'| box hidden?',box.hidden,'| pending',t.w.localStorage.getItem('crimecity.pending.v2'));
  // offline
  fetchFail=true; t.doc.getElementById('reset').click(); await sleep(300); await t.key('Space'); await sleep(1500);
  console.log('OFFLINE ',t.table(),'|',t.doc.getElementById('srcText').textContent);
  console.log('fallback tried',fetched.filter(u=>/raw.githubusercontent/.test(u)).length>0);
  // user site root + discard button
  const u=await mk('https://bob.github.io/'); console.log('user-site link base ->', u.Z.issueUrl({n:'AAA',s:5}).split('?')[0]);
  process.exit(0);
})();
