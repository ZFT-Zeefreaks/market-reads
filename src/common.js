import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const require = createRequire(import.meta.url);
export const sharp = () => require(process.env.SHARP_PATH || 'sharp');
export const markets = {gold:[['gold','GC=F']],us:[['spx','^GSPC'],['nasdaq','^IXIC']],btc:[['btc','BTC-USD']],pse:[]};
export const weekdays = {gold:3,us:5,btc:0};
export const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
export const json = p => JSON.parse(fs.readFileSync(p,'utf8'));
export function save(p, value) { fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value,null,2)+'\n'); }
export function args(argv=process.argv.slice(2)) {const o={};for(let i=0;i<argv.length;i++){if(argv[i].startsWith('--')){const k=argv[i].slice(2);o[k]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;}else o.market ??= argv[i];}return o;}
export function direct(url) { return process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(url); }
export function slot(market, now=new Date(), id='auto') {
  if(!Object.hasOwn(markets,market))throw Error('Unknown market: '+market);
  const local=new Date(now.getTime()+8*3600000),day=local.toISOString().slice(0,10);
  // Most recent scheduled slot, never silently reschedule a late run into the future.
  const delta=(local.getUTCDay()-(weekdays[market]??local.getUTCDay())+7)%7;
  const date=new Date(Date.parse(day+'T00:00Z')-delta*86400000).toISOString().slice(0,10);
  const slotId=id==='auto'?`${date}-${market}`:id;
  if(!/^\d{4}-\d{2}-\d{2}-(gold|us|btc|pse)(-test-[a-z0-9-]+)?$/.test(slotId)||!slotId.includes('-'+market))throw Error('Invalid slot-id (expected YYYY-MM-DD-market)');
  const datePart=slotId.slice(0,10),deadline=new Date(datePart+'T12:00:00Z');
  if(!Number.isFinite(+deadline)||deadline.toISOString().slice(0,10)!==datePart)throw Error('Invalid slot date');
  if(market!=='pse'&&new Date(datePart+'T00:00Z').getUTCDay()!==weekdays[market])throw Error('Slot date is not the market weekday');
  return {id:slotId,deadline,dir:path.join(ROOT,'runs',slotId)};
}
export const manila = now => new Date(now.getTime()+8*3600000).toISOString().replace('Z','+08:00');
export function readCSV(p) { return fs.readFileSync(p,'utf8').trim().split(/\r?\n/).slice(1).map(l=>{const a=l.split(',');return {date:a[0],open:+a[1],high:+a[2],low:+a[3],close:+a[4],volume:+a[5]};}); }
