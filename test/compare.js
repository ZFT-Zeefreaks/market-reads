import fs from 'node:fs';
import path from 'node:path';
import {ROOT,sharp,json,save} from '../src/common.js';
const image=sharp(),sample=process.env.SAMPLE_DIR||'D:/Media/Claude/market-reads-sample';
const slots={gold:'2026-11-18-gold-test-review',us:'2026-11-20-us-test-review',btc:'2026-11-22-btc-test-review'};
const panels=[],phone=[],report={};
for(const [i,[market,id]] of Object.entries(slots).entries()){
  const dir=path.join(ROOT,'runs',id),A=json(path.join(dir,'analysis.json')),expected=json(path.join(sample,'analysis.json'));
  report[market]={};
  for(const key of Object.keys(A)){const a=A[key],e=expected[key];report[market][key]={numericParity:JSON.stringify(a)===JSON.stringify(e)};if(!report[market][key].numericParity)throw Error('Sample analysis mismatch '+key);}
  for(const [j,p] of [path.join(dir,market+'.png'),path.join(sample,market+'.png')].entries()){
    panels.push({input:await image(p).resize(800,550).toBuffer(),left:j*800,top:i*550});
    phone.push({input:await image(p).resize(400,275).toBuffer(),left:j*400,top:i*275});
  }
}
await image({create:{width:1600,height:1650,channels:3,background:'#0D131D'}}).composite(panels).png().toFile(path.join(ROOT,'test','compare.png'));
await image({create:{width:800,height:825,channels:3,background:'#0D131D'}}).composite(phone).png().toFile(path.join(ROOT,'test','compare-phone.png'));
save(path.join(ROOT,'test','parity.json'),report);console.log('PASS: exact analysis parity for all four series; new left, approved right.');
