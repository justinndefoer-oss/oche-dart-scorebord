const fs=require('fs'), vm=require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');            // fittrack/
const APPFILE = path.join(ROOT, 'index.html');
const APPJS = path.join(require('os').tmpdir(), 'fittrack-app.js');
require('fs').writeFileSync(APPJS,
  require('fs').readFileSync(APPFILE, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]);
const OUT = process.env.FITTRACK_OUT || require('os').tmpdir();
const js=fs.readFileSync(APPFILE,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const stub=new Proxy({},{get:(t,k)=>k==='classList'?{add(){},remove(){},toggle(){}}:k==='querySelectorAll'?()=>[]:k==='querySelector'?()=>stub:()=>{} ,set:()=>true});
const ctx={console,localStorage:{getItem:()=>null,setItem(){}},navigator:{onLine:true},window:{},
  setTimeout,clearTimeout,setInterval,clearInterval,
  document:{querySelector:()=>stub,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){},createElement:()=>stub,body:stub}};
ctx.globalThis=ctx; vm.createContext(ctx); vm.runInContext(js,ctx);
const {decodeScanline,runsFromGray}=ctx;
const dec=g=>{const r=runsFromGray(g,g.length); return r?decodeScanline(r.runs,r.blackFirst):null;};

// 1. big random-noise sweep
let fp=0;
for(let i=0;i<10000;i++){
  const n=200+Math.floor(Math.random()*400), g=new Uint8Array(n);
  for(let x=0;x<n;x++) g[x]=Math.floor(Math.random()*256);
  if(dec(g)) fp++;
}
console.log('random noise lines: '+fp+'/10000 false reads');

// 2. structured non-barcode patterns (stripes, text-like, gradients) — the realistic false-positive risk
let fp2=0, tried=0;
for(let i=0;i<4000;i++){
  const n=400, g=new Uint8Array(n);
  const mode=i%4;
  for(let x=0;x<n;x++){
    if(mode===0) g[x]=(Math.floor(x/(2+i%5))%2)?230:25;                 // even stripes
    else if(mode===1) g[x]=(Math.random()<0.3)?20:235;                   // sparse text-like
    else if(mode===2) g[x]=Math.floor(x*255/n);                          // gradient
    else g[x]=(Math.floor(x/(1+Math.floor(Math.random()*4)))%2)?240:15;  // jittery stripes
  }
  tried++;
  if(dec(g)) fp2++;
}
console.log('structured non-barcode patterns: '+fp2+'/'+tried+' false reads');

// 3. full 2D frame: barcode occupying part of a 480xH frame, as scanTick sees it
const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const R=L.map(p=>p.split('').map(c=>c==='1'?'0':'1').join(''));
const G=R.map(p=>p.split('').reverse().join(''));
const PAR=['000000','001011','001101','001110','010011','011001','011100','010101','010110','011010'];
function enc(code){let b='101';const p=PAR[+code[0]];
  for(let i=1;i<=6;i++)b+=(p[i-1]==='0'?L:G)[+code[i]];b+='01010';
  for(let i=7;i<=12;i++)b+=R[+code[i]];return b+'101';}

function frame(code,widthFrac,tilt){
  const W=640,H=480,img=new Uint8Array(W*H).fill(215);
  const bits=enc(code);
  const bw=Math.round(W*widthFrac), x0=Math.round((W-bw)/2);
  const mod=bw/bits.length;
  for(let y=Math.round(H*0.25);y<Math.round(H*0.75);y++){
    const shift=Math.round((y-H/2)*tilt);
    for(let b=0;b<bits.length;b++){
      if(bits[b]!=='1') continue;
      const s=x0+Math.round(b*mod)+shift, e=x0+Math.round((b+1)*mod)+shift;
      for(let x=Math.max(0,s);x<Math.min(W,e);x++) img[y*W+x]=35;
    }
  }
  return {img,W,H};
}
// mimic scanTick's 14-line sampling over the middle band
function scanFrame(f){
  const {img,W,H}=f, y0=Math.round(H*0.30), y1=Math.round(H*0.70), LINES=14;
  const gray=new Uint8Array(W);
  for(let li=0;li<LINES;li++){
    const y=y0+Math.round((y1-y0)*li/(LINES-1));
    for(let x=0;x<W;x++) gray[x]=img[y*W+x];
    const r=runsFromGray(gray,W);
    if(!r) continue;
    const c=decodeScanline(r.runs,r.blackFirst);
    if(c) return c;
  }
  return null;
}
const CODE='8712566441174';
let frameFails=0;
[['fills 90% of frame',0.9,0],['fills 60%',0.6,0],['fills 40%',0.4,0],['fills 30%',0.3,0],
 ['tilted 4deg',0.7,0.07],['tilted 8deg',0.7,0.14]].forEach(([n,w,t])=>{
  const got=scanFrame(frame(CODE,w,t));
  if(got!==CODE) frameFails++;
  console.log((got===CODE?'PASS  ':'FAIL  ')+'frame '+n+' → '+got);
});
/* Not a requirement — just records where the physical limit sits, so a future
   change that moves it is visible rather than silent. */
const limit=[0.30,0.25,0.20].find(w=>scanFrame(frame(CODE,w,0))!==CODE);
console.log('note: smallest readable barcode is between '+
  (limit?Math.round(limit*100)+'%':'<20%')+' and the next size up of frame width');
// empty frames must stay silent
let ef=0;
for(let i=0;i<200;i++){
  const W=640,H=480,img=new Uint8Array(W*H);
  for(let k=0;k<W*H;k++) img[k]=150+Math.floor(Math.random()*80);
  if(scanFrame({img,W,H})) ef++;
}
console.log('empty/noisy frames: '+ef+'/200 false reads');
console.log((frameFails?frameFails:0)+' failing of 6 frame cases');
