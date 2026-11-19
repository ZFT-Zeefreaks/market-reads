// Alternative host only. Not installed or enabled by this project.
import {run} from '../../src/run.js';
const day=new Date(Date.now()+8*3600000).getUTCDay(),market=({3:'gold',5:'us',0:'btc'})[day];
if(!market)throw Error('No slot today; no catch-up');
const result=await run({market});console.log(JSON.stringify(result));if(result.status==='FAILED')process.exitCode=1;
