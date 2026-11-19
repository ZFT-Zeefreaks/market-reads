// Approved sample geometry, colours, footer and badge retained.
import fs from 'node:fs';
import {sma} from './analyze.js';
const badge=fs.readFileSync(new URL('../assets/zft-badge.png',import.meta.url)).toString('base64');
const C={bg:'#0D131D',header:'#0A0F18',grid:'#1D2735',white:'#F5F3E8',muted:'#9DA9BA',gold:'#F5C518',purple:'#C38BFF',blue:'#4AA8FF',green:'#4EE69A',red:'#FF5C8A'};
const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function text(x,y,s,size=28,color=C.white,weight=400,extra=''){return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial" font-size="${size}" font-weight="${weight}" ${extra}>${esc(s)}</text>`}
function line(x,y,x2,y2,color,w=2,dash=''){return `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" ${dash?`stroke-dasharray="${dash}"`:''}/>`}
function card(x,color,title,rows){return `<rect x="${x}" y="846" width="498" height="195" rx="5" fill="${C.header}" stroke="${color}" stroke-width="2"/>`+text(x+17,884,'● '+title,28,color,700)+rows.map((s,i)=>text(x+17,924+i*32,s,26)).join('')}
const ease=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
export function svg(a,t=3,A={},copy){
 let {id,last,view,mas,fib}=a; if(id==='spx')id='us'; const fmt=n=>n.toLocaleString('en-US',{minimumFractionDigits:id==='btc'?0:1,maximumFractionDigits:id==='btc'?0:1});
 let title=copy.headline;
 let pair=id==='gold'?'GOLD FUTURES / USD':id==='us'?'S&P 500':'BTC / USD';
 let p=Math.max(0,Math.min(1,t/2.2)),reveal=ease(p),labels=Math.max(0,Math.min(1,(t-2.15)/.6));
 let values=[...view.flatMap(r=>[r.high,r.low]),...mas.map(x=>x.value),...fib.map(x=>x.value)],min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.09;min-=pad;max+=pad;
 let y=v=>755-(v-min)/(max-min)*420;
 let start=Date.parse(view[0].date),end=Date.parse(last.date);let x=d=>45+(Date.parse(d)-start)/(end-start)*1040;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><defs><clipPath id="draw"><rect x="40" y="300" width="${1050*reveal}" height="480"/></clipPath></defs><rect width="1600" height="1100" fill="${C.bg}"/><rect width="1600" height="110" fill="${C.header}"/>`;
 s+=`<image href="data:image/png;base64,${badge}" x="32" y="33" width="97" height="46"/>`;
 s+=text(147,47,'ZFT RESEARCH',32,C.white,700)+text(147,85,'MAKING CENTS OUT OF MARKET NOISE.',30,C.gold,700)+text(1568,71,pair+'  DAILY',40,C.white,800,'text-anchor="end"')+line(0,110,1600,110,C.gold,3);
 s+=text(32,177,title,42,C.white,700);
 let date=new Date(last.date+'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
 s+=text(32,221,`Last ${fmt(last.close)} · ${date} · RSI 14: ${a.rsi14.toFixed(1)} · 20D MA ${fmt(mas[0].value)}, ${mas[0].value<mas[0].previous?'falling':'rising'}`,29,C.muted);
 s+=line(32,256,66,256,C.gold,4)+text(76,263,'20 MA',26,C.muted)+line(190,256,224,256,C.purple,4)+text(234,263,'50 MA',26,C.muted)+line(348,256,382,256,C.blue,4)+text(392,263,'100 MA',26,C.muted)+line(525,256,559,256,C.muted,3,'4 5')+text(569,263,'Fib: six-month high → later low',26,C.muted);
 for(let i=0;i<4;i++)s+=line(40,300+i*137,1090,300+i*137,C.grid);
 let months=new Set();for(let r of view){let m=r.date.slice(0,7);if(!months.has(m)){months.add(m);s+=text(x(r.date),813,new Date(r.date).toLocaleString('en-US',{month:'short',timeZone:'UTC'}),26,C.muted,'400','text-anchor="middle"')}}
 s+=`<g clip-path="url(#draw)">`;
 // Gap is unfilled; no invented BTC candle or MA bridge over missing dates.
 let cw=Math.max(3,Math.min(6,750/view.length));
 for(let r of view){let col=r.close>=r.open?'#26A69A':'#EF5350',xx=x(r.date);s+=line(xx,y(r.high),xx,y(r.low),col,1.6)+`<rect x="${xx-cw/2}" y="${Math.min(y(r.open),y(r.close))}" width="${cw}" height="${Math.max(1.5,Math.abs(y(r.open)-y(r.close)))}" fill="${col}"/>`}
 for(let [j,n] of [20,50,100].entries()){let pts='';view.forEach((r,i)=>{let idx=a.rows.indexOf(r),v=sma(a.rows,idx,n),gap=i&&id==='btc'&&(Date.parse(r.date)-Date.parse(view[i-1].date)>86400000);if(v!==null)pts+=`${i===0||gap?'M':'L'}${x(r.date)},${y(v)} `});s+=`<path d="${pts}" fill="none" stroke="${[C.gold,C.purple,C.blue][j]}" stroke-width="3"/>`}
 s+='</g>';
 let ah=a.anchors.high,al=a.anchors.low;
 s+=`<g opacity="${labels}">`+line(x(ah.date),y(ah.high),x(al.date),y(al.low),C.muted,2,'4 8')+`<circle cx="${x(ah.date)}" cy="${y(ah.high)}" r="6" fill="${C.muted}"/><circle cx="${x(al.date)}" cy="${y(al.low)}" r="6" fill="${C.muted}"/></g>`;
 let same=Math.abs(fib[2].value-a.d50)<.05;
 const recovery=a.score===0&&last.close<fib[0].value;
 let levels=[{v:a.d50,c:C.white,name:same?'D50 / Fib 50%':'D50 midpoint'},{v:fib[1].value,c:C.gold,name:recovery?'Fib 38.2% / next hurdle':'Fib 38.2% / reference'},{v:fib[0].value,c:C.green,name:recovery?'Fib 23.6% / reclaim':'Fib 23.6% / reference'},{v:a.support[0],c:C.red,name:'Support / must hold'}].sort((a,b)=>b.v-a.v);
 for(let [i,l] of levels.entries()){let yy=y(l.v),ly=[365,480,600,725][i];s+=`<g opacity="${labels}">`+line(40,yy,1110,yy,l.c,l.name.startsWith('D50')?3:2,l.name.startsWith('D50')?'':'7 7')+line(1110,yy,1135,ly,l.c)+text(1144,ly+6,fmt(l.v),32,l.c,700)+text(1144,ly+36,l.name,26,l.c)+'</g>'}
 s+=`<g opacity="${labels}"><circle cx="${x(last.date)}" cy="${y(last.close)}" r="9" fill="${C.white}" stroke="${C.header}" stroke-width="4"/>`+text(825,Math.min(777,Math.max(y(last.close)+38,y(a.support[0])+42)),`Now ${fmt(last.close)}`,28,C.white,700)+'</g>';
 let key=recovery?[`Support: ${fmt(a.support[0])}`,`Reclaim: ${fmt(fib[0].value)}`,`Next hurdle: ${fmt(fib[1].value)}`]:[`Support: ${fmt(a.support[0])}`,`Resistance: ${fmt(a.resistance[0])}`,`D50: ${fmt(a.d50)}`];
 let watch=copy.watch;
 let verdict=copy.verdict;
 s+=card(32,C.green,'KEY LEVELS',key)+card(552,C.blue,'WHAT TO WATCH',watch)+card(1070,C.gold,'ZFT VERDICT',verdict);
 if(id==='us')s+=text(32,1089,`Nasdaq ${fmt(A.nasdaq.last.close)} · ${copy.nasdaqLine}`,20,C.muted);
 s+=text(32,1068,`Yahoo Finance · ${a.symbol}${id==='us'?' / ^IXIC':''} · 1D · data to ${date}, ${last.date.slice(0,4)} · Not financial advice.`,21,C.muted);
 return s+'</svg>';
}
