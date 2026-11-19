import fs from 'node:fs';
import path from 'node:path';
import {args,direct,slot,save,markets,json,sha256,manila} from './common.js';
import {fetchMarket,validate} from './fetch.js';
import {parse,urlFor} from './sources/yahoo.js';
import {analyzeMarket} from './analyze.js';
import {renderMarket} from './render.js';
import {writeCopy} from './copy.js';
import {verifyMarket} from './verify.js';
export function staleReason(market,report,now){const limit=market==='btc'?2:4;return Object.entries(report).find(([,r])=>!r.lastCandleDate||(+now-Date.parse(r.lastCandleDate+'T00:00Z'))/86400000>limit)?`Last completed candle older than ${limit} days`:null;}
function files(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.name==='.lock'?[]:d.isDirectory()?files(path.join(dir,d.name),prefix+d.name+'/'):[prefix+d.name]);}
// Samples are intentionally quarantined: raw Yahoo -> finite rows retains the
// original sample's provisional candle and missing day for visual/math parity.
// Production fetch never calls this helper, and replay can never return READY.
function replayData(market,dir,fromDir,now){
  const report={};
  for(const [id,symbol] of markets[market]){
    const raw=fs.readFileSync(path.join(fromDir,id+'.json')),j=JSON.parse(raw),ts=j.chart?.result?.[0]?.timestamp;
    if(!ts?.length)throw Error('Invalid replay fixture '+id);
    const snapshot=new Date(Math.max(...ts)*1000+2*86400000),p=parse(raw,symbol,snapshot);
    const csv='date,open,high,low,close,volume\n'+p.rows.map(r=>[r.date,r.open,r.high,r.low,r.close,r.volume].join(',')).join('\n')+'\n';
    fs.mkdirSync(path.join(dir,'data'),{recursive:true});fs.writeFileSync(path.join(dir,'data',id+'.json'),raw);fs.writeFileSync(path.join(dir,'data',id+'.csv'),csv);
    report[id]={url:urlFor(symbol),fetchedUTC:now.toISOString(),fetchedManila:manila(now),lastCandleDate:p.rows.at(-1)?.date,completed:false,sha256:sha256(raw),csvSha256:sha256(csv),offline:true,replay:true,invalid:p.invalid,errors:validate(p.rows,id),note:'Source fixture replay, not completed-candle production data'};
    save(path.join(dir,'data',id+'.meta.json'),report[id]);
  }
  save(path.join(dir,'fetch-report.json'),report);return report;
}
export async function run(o){
  const now=new Date(),market=o.market,s=slot(market,now,o['slot-id']||'auto');
  if(o['ignore-deadline']&&!o['from-dir'])throw Error('--ignore-deadline is offline-test-only and requires --from-dir');
  const replay=!!(o['from-dir']&&o['ignore-deadline']);
  fs.mkdirSync(s.dir,{recursive:true});
  const lock=path.join(s.dir,'.lock');let fd;
  try{fd=fs.openSync(lock,'wx');}catch{throw Error('Slot is already locked: '+s.id);}
  const finish=(status,reason)=>{if(status==='SKIPPED')save(path.join(s.dir,'SKIPPED.json'),{status,reason});const r={status,files:[...new Set([...files(s.dir),'RESULT.json'])],reason,slotId:s.id,market,deadline:s.deadline.toISOString(),offline:!!o['from-dir'],replay,completedUTC:new Date().toISOString()};save(path.join(s.dir,'RESULT.json'),r);return r;};
  const deadline=()=>{if(!replay&&Date.now()>+s.deadline)throw Object.assign(Error('Past 20:00 Asia/Manila slot deadline'),{skip:true});};
  try{
    if(fs.existsSync(path.join(s.dir,'RESULT.json')))return json(path.join(s.dir,'RESULT.json'));
    if(market==='pse')return finish('SKIPPED','PSE history source not approved');
    deadline();
    if(!replay&&new Date(Date.now()+8*3600000).toISOString().slice(0,10)!==s.id.slice(0,10))return finish('SKIPPED','Not the scheduled Manila slot date; no backfill');
    const report=replay?replayData(market,s.dir,o['from-dir'],now):await fetchMarket(market,s.dir,{fromDir:o['from-dir'],now});
    deadline();
    const stale=staleReason(market,report,new Date());if(stale&&!replay)return finish('SKIPPED',stale);
    const A=analyzeMarket(market,s.dir);
    if(replay){for(const a of Object.values(A))a.provisional=a.id!=='spx'&&a.id!=='nasdaq';const {publicAnalysis}=await import('./analyze.js');save(path.join(s.dir,'analysis.json'),publicAnalysis(A));}
    deadline();await renderMarket(market,s.dir,s.id,A);deadline();
    writeCopy(market,s.dir,s.id);deadline();
    const checks=await verifyMarket(market,s.dir,s.id,{replay});deadline();
    if(!checks.assetPassed||(!replay&&!checks.passed))return finish('FAILED',checks.errors.join('; ')||'Verification failed');
    return replay?finish('SKIPPED','Offline sample replay only: short history, provisional candles and/or source gaps; assets verified, never eligible for READY'):finish('READY','Local artifacts verified. No posting. Independent editorial review still required before any future publication.');
  }catch(e){
    if(!replay&&Date.now()>+s.deadline)return finish('SKIPPED','Past 20:00 Asia/Manila slot deadline');
    const sourceReport=path.join(s.dir,'fetch-report.json');
    if(!replay&&fs.existsSync(sourceReport)){const stale=staleReason(market,json(sourceReport),new Date());if(stale)return finish('SKIPPED',stale);}
    return finish(e.skip?'SKIPPED':'FAILED',e.message);
  }
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
if(direct(import.meta.url)){try{const r=await run(args());console.log(JSON.stringify(r,null,2));if(r.status==='FAILED')process.exitCode=1;}catch(e){console.error('RUN FAILED: '+e.message);process.exitCode=1;}}
