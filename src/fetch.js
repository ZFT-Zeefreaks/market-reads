// Yahoo is allowed only until 31 Dec 2026 (legal docket 49).
// Provider is isolated in sources/yahoo.js; do not add posting here.
import fs from 'node:fs';
import path from 'node:path';
import {load,parse} from './sources/yahoo.js';
import {isSession} from './sources/calendar.js';
import {markets,sha256,save,manila,args,direct,slot} from './common.js';
export function validate(rows,id) {
  const errors=[];if(!rows.length)return ['No completed candles'];
  for(let i=0;i<rows.length;i++) {
    const r=rows[i];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)errors.push('Invalid date');
    if(!['open','high','low','close'].every(k=>Number.isFinite(r[k])&&r[k]>0)||!Number.isFinite(r.volume)||r.volume<0||r.high<Math.max(r.open,r.low,r.close)||r.low>Math.min(r.open,r.high,r.close))errors.push('Invalid OHLCV '+r.date);
    if(i){const days=(Date.parse(r.date)-Date.parse(rows[i-1].date))/86400000;
      if(days<=0)errors.push('Duplicate/unordered date '+r.date);
      if(id==='btc'&&days!==1)errors.push('Unapproved history gap '+rows[i-1].date+' to '+r.date);
      if(id!=='btc')for(let d=Date.parse(rows[i-1].date)+86400000;d<Date.parse(r.date);d+=86400000){const missing=new Date(d).toISOString().slice(0,10);if(isSession(missing,id))errors.push('Missing expected session '+missing);}
    }
  }
  const minimum=new Date(rows.at(-1).date+'T00:00Z');minimum.setUTCMonth(minimum.getUTCMonth()-13);
  if(Date.parse(rows[0].date)>+minimum)errors.push('At least 13 months of completed history required');
  if(rows.length<101)errors.push('At least 101 observations required for SMA100 direction');
  return [...new Set(errors)];
}
export async function fetchMarket(market,dir,{fromDir,now=new Date()}={}) {
  if(!markets[market]?.length)throw Error('No approved source for '+market);
  const report={};
  for(const [id,symbol] of markets[market]) {
    const {raw,url,offline}=await load(id,symbol,{fromDir,now});
    const data=path.join(dir,'data');fs.mkdirSync(data,{recursive:true});
    fs.writeFileSync(path.join(data,id+'.json'),raw);
    const parsed=parse(raw,symbol,now),{rows,dropped,invalid,sourceMeta}=parsed;
    const errors=[...validate(rows,id),...invalid.map(r=>`${r.reason}: ${r.date}`)];
    const csv='date,open,high,low,close,volume\n'+rows.map(r=>[r.date,r.open,r.high,r.low,r.close,r.volume].join(',')).join('\n')+'\n';
    fs.writeFileSync(path.join(data,id+'.csv'),csv);
    report[id]={url,fetchedUTC:now.toISOString(),fetchedManila:manila(now),lastCandleDate:rows.at(-1)?.date??null,completed:!!rows.length,sha256:sha256(raw),csvSha256:sha256(csv),offline,sourceRange:sourceMeta.range,sessionTimezone:sourceMeta.exchangeTimezoneName,adjustmentPolicy:'Yahoo daily unadjusted quote OHLC; GC=F continuous front month, no local roll adjustment',dropped,invalid,errors};
    save(path.join(data,id+'.meta.json'),report[id]);
  }
  save(path.join(dir,'fetch-report.json'),report);
  const errors=Object.entries(report).flatMap(([id,m])=>m.errors.map(e=>id+': '+e));
  if(market==='us'&&report.spx.lastCandleDate!==report.nasdaq.lastCandleDate)errors.push('US index completed-candle dates do not match');
  if(errors.length)throw Error(errors.join('; '));return report;
}
if(direct(import.meta.url)){const o=args();try{await fetchMarket(o.market,slot(o.market,new Date(),o['slot-id']||'auto').dir,{fromDir:o['from-dir']});}catch(e){console.error('FETCH FAILED: '+e.message);process.exitCode=1;}}
