// Review-preview companion. No source writes, deployment, external messages or task execution.
// Explicitly launched, no installation/autostart; durable processing is leased in the journal.
import { createHmac } from 'node:crypto';
const url = process.env.COMPANY_PREVIEW_URL;
if (!url || new URL(url).hostname !== '127.0.0.1') throw Error('Loopback URL required');
if (!process.env.VIEWER_PASSWORD || !process.env.SESSION_SECRET) throw Error('Owner credentials required');
const cookie = createHmac('sha256',process.env.SESSION_SECRET).update(process.env.VIEWER_PASSWORD).digest('hex');
let stopped=false,controller;
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopped=true;controller?.abort();});
while(!stopped){
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
  try{const r=await fetch(url+'/api/command-room',{headers:{cookie:`jarvis-session=${cookie}`},signal:controller.signal});if(!r.ok)console.error(`Company collector HTTP ${r.status}`);else await r.arrayBuffer();}
  catch{if(!stopped)console.error('Company collector unavailable; preserving receipts');}
  finally{clearTimeout(timeout);}
  if(!stopped)await new Promise(resolve=>{const stop=()=>{clearTimeout(timer);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);resolve();};const timer=setTimeout(stop,15000);process.once('SIGINT',stop);process.once('SIGTERM',stop);});
}
