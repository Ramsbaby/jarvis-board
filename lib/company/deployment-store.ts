import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {OwnerOrder} from './orders';
import {runtimePath} from './runtime-path';
import {deploymentStatus,type ReleaseManifest,type DeploymentReceipt,type ReleaseBinding} from './deployment';
const binding=(v:ReleaseBinding)=>v&&typeof v.id==='string'&&v.projectId==='jarvis-board'&&typeof v.updatedAt==='string'&&/^[a-f0-9]{64}$/.test(v.afterHash);
export function readDeploymentEvidence(root=process.env.JARVIS_ORDER_LAB_DIR||'',cwd=process.cwd(),buildDir=process.env.JARVIS_BUILD_DIR||'.next'){
 let release:ReleaseManifest|null=null,manifestHash='';const receipts:DeploymentReceipt[]=[];
 try{const raw=readFileSync(runtimePath(cwd,'deployment-manifest.json'),'utf8'),v=JSON.parse(raw);const build=readFileSync(runtimePath(cwd,buildDir,'BUILD_ID'),'utf8').trim();if(v.version===1&&v.buildId===build&&v.origin==='https://board.ramsbaby.com'&&Array.isArray(v.orders)&&v.orders.every(binding)&&typeof v.sourceHash==='string'&&typeof v.artifactHash==='string'){release=v;manifestHash=createHash('sha256').update(raw).digest('hex');}}catch{/* No trusted manifest: never infer a deployment from a completed order. */}
 if(root)try{for(const name of readdirSync(runtimePath(root,'deployments')).filter(n=>/^[A-Za-z0-9_-]+\.json$/.test(n)).slice(-100)){try{const r=JSON.parse(readFileSync(runtimePath(root,'deployments',name),'utf8'));if(r.version===1&&typeof r.buildId==='string'&&/^[a-f0-9]{64}$/.test(r.manifestHash)&&r.origin==='https://board.ramsbaby.com'&&Number.isFinite(Date.parse(r.checkedAt))&&typeof r.ok==='boolean'&&Array.isArray(r.orders)&&r.orders.every(binding))receipts.push(r);}catch{}}}catch{}
 return {release,manifestHash,receipts};
}
export function withDeployment(orders:OwnerOrder[],root?:string){const e=readDeploymentEvidence(root);return orders.map(o=>({...o,deployment:deploymentStatus(o,e.release,e.manifestHash,e.receipts)}));}
