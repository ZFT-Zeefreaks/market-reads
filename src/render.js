import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sharp,require,save,args,direct} from './common.js';
import {analyzeMarket} from './analyze.js';
import {makeCopy} from './copy.js';
import {svg} from './chart.js';
export async function renderMarket(market,dir,slotId,A=analyzeMarket(market,dir)){
  const image=sharp(),copy=makeCopy(market,A,slotId),a=A[market];
  const final=svg(a,3,A,copy),base=path.join(dir,market),frameDir=path.join(dir,'frames');
  fs.mkdirSync(frameDir,{recursive:true});fs.writeFileSync(base+'.svg',final);
  await image(Buffer.from(final)).png().toFile(base+'.png');
  await image(base+'.png').resize(400).png().toFile(path.join(dir,'phone.png'));
  for(let i=0;i<76;i++)await image(Buffer.from(svg(a,i/25,A,copy))).png().toFile(path.join(frameDir,String(i).padStart(3,'0')+'.png'));
  let ff=process.env.FFMPEG;try{ff ||= require('ffmpeg-static');}catch{ff||='ffmpeg';}
  const command=['-y','-v','error','-framerate','25','-i',path.join(frameDir,'%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0','-final_delay','500',base+'.gif'];
  const result=spawnSync(ff,command,{encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:1024*1024});
  save(path.join(dir,'motion.json'),{frames:76,frameRate:25,finalHoldMs:5000,ffmpeg:ff,args:command,success:result.status===0&&!result.error});
  if(result.error||result.status!==0){fs.writeFileSync(path.join(dir,'GIF-PENDING.txt'),`GIF not produced: ${result.error?.message||result.stderr||'ffmpeg failure'}\nPNG and 76 frames exist. Run node src/gif.js --dir "${dir}" --market ${market} with FFMPEG configured. Verification and READY are blocked until GIF passes.\n`);return {gifPending:true};}
  return {gifPending:false};
}
if(direct(import.meta.url)){const o=args();try{await renderMarket(o.market,o.dir,o['slot-id']||path.basename(o.dir));}catch(e){console.error('RENDER FAILED: '+e.message);process.exitCode=1;}}
