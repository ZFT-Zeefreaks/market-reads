// Local helper for the keeper if ffmpeg could not spawn in the builder sandbox.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {args,json,save} from './common.js';
const o=args(),p=path.join(o.dir,'motion.json'),m=json(p);
const r=spawnSync(process.env.FFMPEG||m.ffmpeg,m.args,{stdio:'inherit',timeout:120000,windowsHide:true});
if(r.error||r.status!==0){console.error(r.error?.message||'ffmpeg failed');process.exitCode=1;}else{m.success=true;save(p,m);const pending=path.join(o.dir,'GIF-PENDING.txt');if(fs.existsSync(pending))fs.unlinkSync(pending);console.log('GIF built; run src/verify.js before accepting it.');}
