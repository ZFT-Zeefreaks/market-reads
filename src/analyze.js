import fs from 'node:fs';
import path from 'node:path';
import {readCSV,save,args,direct,markets} from './common.js';
let activeDir;
const read=id=>readCSV(path.join(activeDir,'data',id+'.csv'));
const sma=(r,i,n)=>i<n-1?null:r.slice(i-n+1,i+1).reduce((s,x)=>s+x.close,0)/n;
function rsi14(rows){let gain=0,loss=0;for(let i=1;i<=14;i++){let d=rows[i].close-rows[i-1].close;gain+=Math.max(d,0);loss+=Math.max(-d,0);}gain/=14;loss/=14;for(let i=15;i<rows.length;i++){let d=rows[i].close-rows[i-1].close;gain=(gain*13+Math.max(d,0))/14;loss=(loss*13+Math.max(-d,0))/14;}return loss===0?(gain===0?50:100):100-100/(1+gain/loss);}
export function analyze(id,symbol){
 let rows=read(id),last=rows.at(-1),end=new Date(last.date+'T00:00:00Z'),since=m=>{let d=new Date(end);d.setUTCMonth(d.getUTCMonth()-m);return d.toISOString().slice(0,10)};
 const window=m=>rows.filter(r=>r.date>=since(m));
 const hi=r=>r.reduce((a,b)=>b.high>a.high?b:a),lo=r=>r.reduce((a,b)=>b.low<a.low?b:a);
 let d=window(3),v=window(6),m=window(1),sup=lo(d).low,top=hi(d).high,closeLow=Math.min(...m.map(x=>x.close)),closeHigh=Math.max(...d.map(x=>x.close));
 let mas=[20,50,100].map(n=>({n,value:sma(rows,rows.length-1,n),previous:sma(rows,rows.length-2,n)}));
 let score=mas.reduce((s,x,i)=>s+(last.close>x.value?[1,2,3][i]:0),0),stack=mas[0].value>mas[1].value&&mas[1].value>mas[2].value?(last.close>mas[0].value?'AOTS+':'AOTS'):mas[2].value>mas[1].value&&mas[1].value>mas[0].value?'iAOTS':'Mixed stack';
 // Reproducible down-swing: highest wick of the six-month view, then lowest later wick.
 let high=hi(v),low=lo(v.filter(r=>r.date>=high.date)),fib=[.236,.382,.5].map(r=>({ratio:r,value:low.low+(high.high-low.low)*r}));
 let gaps=[];for(let i=1;i<rows.length;i++){let days=(Date.parse(rows[i].date)-Date.parse(rows[i-1].date))/86400000;if(id==='btc'&&days!==1)gaps.push({after:rows[i-1].date,before:rows[i].date,missingDays:days-1});}
 return {id,symbol,rows,last,view:v,mas,rsi14:rsi14(rows),score,stack,support:[sup,closeLow],resistance:[closeHigh,top],d50:(sup+top)/2,fib,anchors:{high,low},firstDate:rows[0].date,gaps,provisional:id!=='spx'&&id!=='nasdaq'};
}

export {sma};
export function analyzeMarket(market,dir){activeDir=dir;const A={};for(const [id,symbol] of markets[market]){const a=analyze(id,symbol);a.provisional=false; A[id==='spx'?'us':id]=a;}save(path.join(dir,'analysis.json'),publicAnalysis(A));return A;}
export function publicAnalysis(A){return Object.fromEntries(Object.entries(A).map(([k,{rows,view,...a}])=>[k,{...a,rowCount:rows.length,viewCount:view.length}]));}
if(direct(import.meta.url)){const o=args();try{analyzeMarket(o.market,o.dir);}catch(e){console.error('ANALYZE FAILED: '+e.message);process.exitCode=1;}}
