import fs from 'node:fs';
import path from 'node:path';
import {sharp,json,save,args,direct,sha256,markets,readCSV} from './common.js';
import {CTA,NFA,makeCopy} from './copy.js';
import {validate} from './fetch.js';
export const forbidden=[/guaranteed/i,/sure win/i,/will moon/i,/built by zeefreaks/i,/watch george.s session/i,/sec.approved/i,/\blicensed\b/i,/\binsured\b/i,/\bsafe\b/i,/\bTolkien\b/i,/Middle.earth/i,/\bhobbit\b/i,/\bMithril\b/i,/only \d+ slots left/i,/tag\/share if/i,/\bbroader?\b/i,/—/];
function numbers(value,out=[]){if(typeof value==='number'&&Number.isFinite(value))out.push(value);else if(value&&typeof value==='object')for(const v of Object.values(value))numbers(v,out);return out;}
export function checkCopy(c,A,slotId){
  const errors=[],expected=makeCopy(c.market,A,slotId);
  for(const k of ['facebook','x','threads','headline'])if(c[k]!==expected[k])errors.push('Copy differs from analysis/state template: '+k);
  const values=new Set(numbers(A).flatMap(n=>[String(n),n.toFixed(0),n.toFixed(1)]).map(n=>n.replace(/,/g,'')));
  const tokens=[];
  for(const channel of ['facebook','x','threads']){
    const text=c[channel]||'';
    if(!text.includes(CTA))errors.push('Missing CTA: '+channel);
    if(!text.endsWith(NFA))errors.push('Missing disclaimer: '+channel);
    if(/18+|losses are possible|involves risk/i.test(text))errors.push('Old disclaimer wording: '+channel);
    if(channel!=='facebook'&&(text.length>280||!/^[\x00-\x7f]*$/.test(text)))errors.push('Short copy must be ASCII and <=280 characters');
    // 500 is the instrument's proper name, not a quoted market level.
    const numericText=text.replaceAll('S&P 500','S&P');
    for(const m of numericText.matchAll(/\d[\d,]*(?:\.\d+)?/g)){tokens.push(m[0]);if(!values.has(m[0].replace(/,/g,'')))errors.push('Untraced caption number '+m[0]);}
    for(const re of forbidden)if(re.test(text))errors.push('Forbidden copy: '+re);
  }
  for(const re of forbidden)if(re.test(c.headline))errors.push('Forbidden headline: '+re);
  return {errors,tokens,lengths:{facebook:c.facebook.length,x:c.x.length,threads:c.threads.length}};
}
export async function verifyMarket(market,dir,slotId,{replay=false}={}){
  const report={passed:false,assetPassed:false,productionEligible:!replay,errors:[],sourceErrors:[],textBounds:[]};
  const check=(ok,message)=>{if(!ok)report.errors.push(message);};
  try{
    const image=sharp(),A=json(path.join(dir,'analysis.json')),c=json(path.join(dir,'copy.json')),a=A[market];
    const copy=checkCopy(c,A,slotId);report.copy=copy;report.errors.push(...copy.errors);
    const md=fs.readFileSync(path.join(dir,'captions.md'),'utf8');
    check(md===`# ${{gold:'Gold (futures)',us:'S&P 500',btc:'Bitcoin'}[market]}\n\n### Facebook\n\n${c.facebook}\n\n### X / Threads\n\n${c.x}\n`,'Captions.md differs from verified copy');
    for(const [id] of markets[market]){
      const m=json(path.join(dir,'data',id+'.meta.json'));
      check(sha256(fs.readFileSync(path.join(dir,'data',id+'.json')))===m.sha256,'Raw JSON hash mismatch '+id);
      check(sha256(fs.readFileSync(path.join(dir,'data',id+'.csv')))===m.csvSha256,'CSV hash mismatch '+id);
      report.sourceErrors.push(...validate(readCSV(path.join(dir,'data',id+'.csv')),id).map(e=>id+': '+e),...(m.invalid||[]).map(e=>id+': '+e.reason+' '+e.date));
      if(!m.completed)report.sourceErrors.push('Incomplete final candle '+id);
    }
    if(report.sourceErrors.length)report.productionEligible=false;
    if(!replay)report.errors.push(...report.sourceErrors);
    const base=path.join(dir,market),png=await image(base+'.png').metadata();
    check(png.width===1600&&png.height===1100,'PNG must be 1600x1100');
    report.png={width:png.width,height:png.height,bytes:fs.statSync(base+'.png').size};
    const svg=fs.readFileSync(base+'.svg','utf8'),lastDate=new Date(a.last.date+'T00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
    check(svg.includes('Not financial advice.')&&svg.includes('Yahoo Finance')&&svg.includes(a.symbol)&&svg.includes(`data to ${lastDate}, ${a.last.date.slice(0,4)}`),'Missing legal/source/date footer');
    check(svg.includes('ZFT RESEARCH')&&svg.includes('MAKING CENTS OUT OF MARKET NOISE.')&&svg.includes('data:image/png;base64,'),'Missing brand/footer identity');
    for(const re of forbidden)check(!re.test(svg),'Forbidden artwork text '+re);
    for(const m of svg.matchAll(/<text x="([^"]+)" y="([^"]+)" fill="[^"]+" font-family="Arial" font-size="([^"]+)" font-weight="([^"]+)" ([^>]*)>([^<]*)<\/text>/g)){
      const [,x,y,size,weight,extra,raw]=m,txt=raw.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      const meta=await image({text:{text:txt.replace(/&/g,'&amp;').replace(/</g,'&lt;'),font:`Arial ${+weight>=700?'Bold ':''}${size}`,dpi:72}}).metadata();
      let left=+x,right=left+meta.width;if(extra.includes('end')){right=left;left-=meta.width;}if(extra.includes('middle')){left-=meta.width/2;right-=meta.width/2;}
      const box=+y>=924&&+y<=1020?[32,552,1070].find(b=>+x===b+17):undefined;
      const pass=left>=0&&right<=1600&&+y<=1100&&+y-meta.height>=0&&(box===undefined||right<=box+481);
      report.textBounds.push({text:txt,left,right,pass});check(pass,'Text outside bounds: '+txt);
    }
    if(!fs.existsSync(base+'.gif'))check(false,'GIF missing (see GIF-PENDING.txt)');
    else{
      const gif=await image(base+'.gif',{animated:true,limitInputPixels:false}).metadata();
      check(gif.width===1600&&gif.pageHeight===1100,'GIF must be 1600x1100');
      check(gif.pages>1&&gif.delay?.at(-1)>=5000,'GIF final hold must be >=5 seconds');
      const final=await image(base+'.gif',{page:gif.pages-1}).removeAlpha().raw().toBuffer(),still=await image(base+'.png').removeAlpha().raw().toBuffer();
      let sum=0;for(let i=0;i<still.length;i++)sum+=Math.abs(still[i]-final[i]);
      const error=sum/still.length;check(error<=4,'Decoded GIF final differs from PNG');
      report.gif={width:gif.width,height:gif.pageHeight,frames:gif.pages,finalHoldMs:gif.delay.at(-1),durationMs:gif.delay.reduce((s,v)=>s+v,0),meanAbsoluteFinalPixelError:error,bytes:fs.statSync(base+'.gif').size};
      for(const [name,page] of [['first',0],['middle',Math.floor(gif.pages/2)],['final',gif.pages-1]])await image(base+'.gif',{page}).png().toFile(path.join(dir,'gif-'+name+'.png'));
    }
    report.assetPassed=report.errors.length===0;report.passed=report.assetPassed&&report.productionEligible;
  }catch(e){report.errors.push(e.message);}
  save(path.join(dir,'checks.json'),report);return report;
}
if(direct(import.meta.url)){const o=args();const r=await verifyMarket(o.market,o.dir,o['slot-id']||path.basename(o.dir),{replay:!!o.replay});console.log(JSON.stringify({passed:r.passed,assetPassed:r.assetPassed,errors:r.errors}));if(!r.passed)process.exitCode=1;}
