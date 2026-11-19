import fs from 'node:fs';
import path from 'node:path';
import {json,save,args,direct,sha256} from './common.js';
export const CTA='Want to learn more? Join our Discord, link in bio.';
export const label = m => ({gold:'Gold (futures)',us:'S&P 500',btc:'Bitcoin'})[m];
export const format = (n,m) => n.toLocaleString('en-US',{minimumFractionDigits:m==='btc'?0:1,maximumFractionDigits:m==='btc'?0:1});
export function trend(a){return a.score===0?'down':a.score===6?'up':'mixed';}
export function location(a){const p=a.last.close,s=a.support[0],r=a.resistance[0];return Math.abs(p-s)/p<=.03?'near support':Math.abs(p-r)/p<=.03?'near resistance':'mid-range';}
// Each of the nine trend/location states has three independently seeded hooks.
export const hooks=Object.fromEntries(['down','mixed','up'].flatMap(t=>['near support','near resistance','mid-range'].map(l=>[`${t}/${l}`,
  t==='down'?(l==='near support'?['sellers still control the trend','support comes first','a bounce needs proof']:l==='near resistance'?['sellers meet a test','the next hurdle matters','a recovery still needs proof']:['the trend still points down','patience comes before a trade','buyers need more ground']):
  t==='up'?(l==='near support'?['buyers face a support test','the pullback needs to hold','support has work to do']:l==='near resistance'?['buyers meet the next hurdle','a breakout needs follow-through','resistance is the next test']:['buyers still lead','the trend has room to work','a higher base matters']):
  (l==='near support'?['support is the next test','buyers need a firm base','wait for support to hold']:l==='near resistance'?['resistance needs proof','a break needs a retest','the next hurdle comes first']:['the picture is still mixed','let the next close speak','wait for a clearer direction'])
])));
export function makeCopy(market,A,slotId){
  const a=A[market],t=trend(a),loc=location(a),state=t+'/'+loc;
  const week=Math.floor(Date.parse(slotId.slice(0,10))/(7*86400000));
  // Calendar-week rotation guarantees adjacent weekly slots use different
  // variants; market offsets keep the three desks from moving in lockstep.
  const seed=Number.isFinite(week)?week+({gold:1,us:1,btc:0})[market]:parseInt(sha256(slotId).slice(0,8),16),f=n=>format(n,market);
  const headline=label(market)+': '+hooks[state][seed%3];
  const up=f(a.fib[0].value),next=f(a.fib[1].value),down=f(a.support[0]),res=f(a.resistance[0]);
  const above=a.mas.filter(x=>a.last.close>x.value).length;
  const observation=above===0?'Price is below all three moving averages. The trend is still down.':above===3?'Price is above all three moving averages. Buyers still lead.':'Price is between the moving averages. The picture is mixed.';
  let scenario,short,verdict,watch;
  if(t==='down'&&a.last.close<a.fib[0].value){
    scenario=`A daily close above ${up}, followed by a retest that holds, would improve the setup. That opens a working scenario toward ${next}. Slip back below ${up} and the recovery loses its footing.`;
    short=`${label(market)}: trend down. Close above ${up}, then hold: next hurdle ${next}. Back below ${up}, recovery fails. Lose ${down}, support breaks.`;
    verdict=['Trend: down, below all three MAs',`Setup: below ${up} resistance`,'Plan: reclaim first, then retest'];
    watch=[`Close above ${up}: bounce on`,'Back below: recovery fails',`Lose ${down}: step aside`];
  }else{
    scenario=`A daily close above ${res}, then a retest that holds, would strengthen the working scenario. A return below ${res} would weaken that break. Support at ${down} needs to hold.`;
    short=`${label(market)}: trend ${t}. Above ${res}, then hold: a stronger setup. Back below it, the break weakens. Lose ${down}, support breaks.`;
    verdict=[`Trend: ${t}, ${above===3?'above all three MAs':'wait for a clearer close'}`,`Setup: ${loc}`,'Plan: hold support, confirm a break'];
    watch=[`Close above ${res}: then retest`,'Back below: the break weakens',`Lose ${down}: step aside`];
  }
  let nasdaqLine='',nasdaqNote='';
  if(market==='us'){const n=trend(A.nasdaq);nasdaqLine=n==='down'?'below its 20D, 50D and 100D MAs':n==='up'?'above its 20D, 50D and 100D MAs':'between its moving averages';nasdaqNote=`\n\nNasdaq is ${n==='down'?'also below all three moving averages':n==='up'?'above all three moving averages':'between its moving averages'}. Read its trend alongside the S&P.`;}
  const facebook=`${headline}.\n\n${observation}\n\n${scenario}\n\nWatch ${down} below. A close under it would break support. Waiting for confirmation beats forcing a trade.${nasdaqNote}\n\n${CTA}`;
  const x=short+'\n\n'+CTA;
  // Keep the short template ASCII, so code-point and X weighted lengths agree.
  if(!/^[\x00-\x7f]*$/.test(x)||x.length>280)throw Error('X / Threads copy exceeds 280 characters');
  return {market,state,seed,headline,facebook,x,threads:x,verdict,watch,nasdaqLine};
}
export function writeCopy(market,dir,slotId){const c=makeCopy(market,json(path.join(dir,'analysis.json')),slotId);save(path.join(dir,'copy.json'),c);fs.writeFileSync(path.join(dir,'captions.md'),`# ${label(market)}\n\n### Facebook\n\n${c.facebook}\n\n### X / Threads\n\n${c.x}\n`);return c;}
if(direct(import.meta.url)){const o=args();try{writeCopy(o.market,o.dir,o['slot-id']||path.basename(o.dir));}catch(e){console.error('COPY FAILED: '+e.message);process.exitCode=1;}}
