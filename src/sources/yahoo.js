// Yahoo is allowed only until 31 Dec 2026 (legal docket 49).
// Replace this module when a new history source is approved. No publishing APIs.
import fs from 'node:fs';
import path from 'node:path';
export const ALLOWED_UNTIL = Date.parse('2027-01-01T00:00:00+08:00');
export const urlFor = symbol => `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`;
export async function load(id,symbol,{fromDir,now=new Date()}={}) {
  if(fromDir)return {raw:fs.readFileSync(path.join(fromDir,id+'.json')),url:urlFor(symbol),offline:true};
  if(+now>=ALLOWED_UNTIL)throw Error('Yahoo authorization expired after 31 Dec 2026 (legal docket 49)');
  const response=await fetch(urlFor(symbol),{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ZFT-Research-local-render/1.0'},redirect:'error'});
  if(!response.ok)throw Error(`Yahoo ${id}: HTTP ${response.status}`);
  const raw=Buffer.from(await response.arrayBuffer());
  if(raw.length>10*1024*1024)throw Error('Yahoo response exceeds 10 MB');
  return {raw,url:urlFor(symbol),offline:false};
}
export function parse(raw,symbol,now=new Date()) {
  const j=JSON.parse(raw),r=j.chart?.result?.[0];
  if(j.chart?.error||!r)throw Error('Yahoo chart error: '+JSON.stringify(j.chart?.error??'missing result'));
  if(r.meta?.symbol!==symbol)throw Error('Yahoo symbol mismatch: expected '+symbol);
  const ts=r.timestamp,q=r.indicators?.quote?.[0];
  if(!Array.isArray(ts)||!ts.length||!q)throw Error('Missing daily timestamps/quotes');
  for(const k of ['open','high','low','close','volume'])if(!Array.isArray(q[k])||q[k].length!==ts.length)throw Error('Invalid quote array '+k);
  const rows=[],dropped=[],invalid=[];
  let previous=-Infinity;
  for(let i=0;i<ts.length;i++) {
    const time=ts[i]*1000;
    if(!Number.isFinite(time)||time<=previous)throw Error('Duplicate or unordered timestamp');previous=time;
    const date=new Date(time).toISOString().slice(0,10);
    // UTC daily boundary for BTC; US daily candles are complete only after
    // the supplied regular session ends. Older sessions use a conservative
    // next-UTC-day boundary (safe at the 19:45 Manila production slots).
    const session=r.meta.currentTradingPeriod?.regular;
    const inCurrent=session&&ts[i]>=session.start&&ts[i]<session.end;
    const end=symbol==='BTC-USD'?Date.parse(date+'T00:00Z')+86400000:inCurrent?session.end*1000:Date.parse(date+'T00:00Z')+86400000;
    if(time>+now||+now<end){dropped.push({date,reason:'current incomplete candle'});continue;}
    const row={date,...Object.fromEntries(['open','high','low','close','volume'].map(k=>[k,q[k][i]]))};
    if(!['open','high','low','close','volume'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k]))) {invalid.push({date,reason:'null or non-finite OHLCV'});continue;}
    rows.push(row);
  }
  return {rows,dropped,invalid,sourceMeta:r.meta};
}
