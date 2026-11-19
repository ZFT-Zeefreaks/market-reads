import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,readCSV,json,slot,markets} from '../src/common.js';
import {parse,load,ALLOWED_UNTIL} from '../src/sources/yahoo.js';
import {isSession} from '../src/sources/calendar.js';
import {validate,fetchMarket} from '../src/fetch.js';
import {analyzeMarket} from '../src/analyze.js';
import {makeCopy,hooks} from '../src/copy.js';
import {checkCopy} from '../src/verify.js';
import {staleReason,run} from '../src/run.js';
const sample='D:/Media/Claude/market-reads-sample',work=path.join(ROOT,'test','.work');fs.mkdirSync(work,{recursive:true});
test('raw fixtures reproduce every CSV row and analysis number',()=>{
  const dir=fs.mkdtempSync(path.join(work,'math-'));fs.mkdirSync(path.join(dir,'data'));
  const expected=json(path.join(sample,'analysis.json'));
  for(const [id,symbol] of [...markets.gold,...markets.us,...markets.btc]){
    const raw=fs.readFileSync(path.join(sample,'data',id+'.json'));
    const {rows}=parse(raw,symbol,new Date('2026-11-21T12:00Z'));
    assert.deepEqual(rows,readCSV(path.join(sample,'data',id+'.csv')));
    fs.copyFileSync(path.join(sample,'data',id+'.csv'),path.join(dir,'data',id+'.csv'));
    // Independent calculations, not the implementation's SMA helper.
    const a=expected[id==='spx'?'us':id];
    for(const n of [20,50,100])assert.equal(rows.slice(-n).reduce((s,r)=>s+r.close,0)/n,a.mas.find(x=>x.n===n).value);
    assert.equal(a.score,a.mas.reduce((s,m,i)=>s+(rows.at(-1).close>m.value?[1,2,3][i]:0),0));
    assert.equal(a.d50,(a.support[0]+a.resistance[1])/2);
    for(const f of a.fib)assert.equal(f.value,a.anchors.low.low+(a.anchors.high.high-a.anchors.low.low)*f.ratio);
  }
  for(const market of ['gold','us','btc']){const A=analyzeMarket(market,dir);for(const [k,{rows,view,...a}] of Object.entries(A)){a.provisional=expected[k].provisional;assert.deepEqual({...a,rowCount:rows.length,viewCount:view.length},expected[k]);}}
});
test('completed candle filtering, malformed arrays, symbol and null handling',()=>{
  for(const [id,symbol] of [...markets.gold,...markets.us,...markets.btc]){
    const raw=fs.readFileSync(path.join(sample,'data',id+'.json'));
    const p=parse(raw,symbol,new Date('2026-11-19T04:00Z'));
    assert.equal(p.rows.at(-1).date,id==='gold'||id==='btc'?'2026-11-17':'2026-11-18');
    assert.throws(()=>parse(raw,'WRONG'),/symbol mismatch/);
    const j=JSON.parse(raw);j.chart.result[0].indicators.quote[0].open.pop();assert.throws(()=>parse(Buffer.from(JSON.stringify(j)),symbol),/array/);
  }
});
test('strict offline fetch rejects the actual short sample and saves evidence',async()=>{
  const dir=fs.mkdtempSync(path.join(work,'fetch-'));
  await assert.rejects(fetchMarket('gold',dir,{fromDir:path.join(sample,'data'),now:new Date('2026-11-19T04:00Z')}),/13 months/);
  const m=json(path.join(dir,'data/gold.meta.json'));assert.equal(m.completed,true);assert.equal(m.lastCandleDate,'2026-11-17');assert.equal(m.dropped.at(-1).date,'2026-11-19');
});
test('history sanity and expected-session gap validation',()=>{
  const rows=[];for(let d=Date.parse('2025-01-01');d<=Date.parse('2026-11-18');d+=86400000){const date=new Date(d).toISOString().slice(0,10);if(isSession(date,'spx'))rows.push({date,open:10,high:12,low:9,close:11,volume:1});}
  assert.deepEqual(validate(rows,'spx'),[]);
  assert(validate(rows.filter((r,i)=>i!==100),'spx').some(e=>e.includes('Missing expected session')));
  assert(validate([{...rows[0],low:30},...rows.slice(1)],'spx').some(e=>e.includes('OHLCV')));
  assert(validate([rows[0],rows[0],...rows.slice(1)],'spx').some(e=>e.includes('Duplicate')));
  assert(!isSession('2026-04-03','spx'));assert(!isSession('2026-11-26','spx'));assert(isSession('2026-11-26','gold'));
});
test('nine copy states, three hooks each, all numbers trace and X fits',()=>{
  const original=json(path.join(sample,'analysis.json'));
  for(const m of ['gold','us','btc'])for(const t of ['down','mixed','up'])for(const loc of ['near support','near resistance','mid-range']){
    const A=structuredClone(original),a=A[m];a.score={down:0,mixed:3,up:6}[t];a.last.close=100;a.support=[loc==='near support'?99:50,50];a.resistance=[loc==='near resistance'?101:150,160];a.fib=[{ratio:.236,value:110},{ratio:.382,value:120},{ratio:.5,value:130}];a.mas.forEach(x=>x.value=t==='up'?90:t==='down'?110:x.n===20?90:110);
    const c=makeCopy(m,A,'seed');assert.equal(c.state,t+'/'+loc);assert.equal(hooks[c.state].length,3);assert.deepEqual(checkCopy(c,A,'seed').errors,[]);assert(c.x.length<=280);
    const bad={...c,facebook:c.facebook.replace('Watch','Watch 987654321')};assert(checkCopy(bad,A,'seed').errors.some(e=>e.includes('Untraced')));
  }
});
test('Manila slot identity, weekday, expiry, staleness, no network needed',async()=>{
  assert.equal(slot('gold',new Date('2026-11-19T00:00Z')).id,'2026-11-18-gold');
  assert.throws(()=>slot('us',new Date(),'../../escape'),/Invalid/);
  assert.throws(()=>slot('gold',new Date(),'2026-11-19-gold'),/weekday/);
  await assert.rejects(load('gold','GC=F',{now:new Date(ALLOWED_UNTIL)}),/expired/);
  assert(staleReason('btc',{btc:{lastCandleDate:'2026-11-16'}},new Date('2026-11-19T11:45Z')));
  assert.equal(staleReason('us',{spx:{lastCandleDate:'2026-11-18'}},new Date('2026-11-20T11:45Z')),null);
});
test('headline seed rotates on adjacent weekly slot dates',()=>{
  const A=json(path.join(sample,'analysis.json'));
  for(const [m,date] of [['gold','2026-11-18'],['us','2026-11-20'],['btc','2026-11-22']]){
    const next=new Date(Date.parse(date)+7*86400000).toISOString().slice(0,10);
    assert.notEqual(makeCopy(m,A,date+'-'+m).headline,makeCopy(m,A,next+'-'+m).headline);
  }
});
test('PSE and missed-deadline run never fetch or render',async()=>{
  const suffix='test-'+Date.now();
  const p=await run({market:'pse','slot-id':'2026-11-19-pse-'+suffix});assert.equal(p.status,'SKIPPED');assert.equal(p.reason,'PSE history source not approved');
  const late=await run({market:'gold','slot-id':'2026-11-18-gold-'+suffix});assert.equal(late.status,'SKIPPED');assert.match(late.reason,/deadline/);
  const again=await run({market:'gold','slot-id':'2026-11-18-gold-'+suffix});assert.deepEqual(again,late);
  await assert.rejects(run({market:'gold','ignore-deadline':true}),/requires --from-dir/);
});
