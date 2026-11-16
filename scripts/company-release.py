#!/usr/bin/env python3
"""Host-only release provenance and authenticated external verification. No web write API."""
from pathlib import Path
import argparse,hashlib,json,os,plistlib,shutil,sqlite3,re,urllib.request,urllib.error,hmac
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/deployment-link';WORK.mkdir(parents=True,exist_ok=True)
FLOW=ROOT/'work/development-flow';ORIGIN='https://board.ramsbaby.com'
def now():return datetime.now(timezone.utc).isoformat()
def sha(raw):return hashlib.sha256(raw).hexdigest()
def tree_hash(base,paths):
 files=[]
 for part in paths:
  p=base/part
  if p.is_file():files.append(p)
  elif p.is_dir():files.extend(x for x in p.rglob('*') if x.is_file())
 h=hashlib.sha256()
 for p in sorted(set(files)):
  if '__pycache__' in p.parts or p.name=='.DS_Store':continue
  if p.is_symlink():raise ValueError('Source/artifact symlink requires explicit review: '+str(p.relative_to(base)))
  content=p.read_bytes()
  if p.relative_to(base)==Path('tsconfig.json'):
   # Next adds only generated type-directory includes during an isolated build.
   config=json.loads(content);config['include']=[x for x in config.get('include',[]) if not re.fullmatch(r'\.next(?:-[a-z0-9-]+)?/(?:dev/)*types/\*\*/\*\.ts',x)]
   content=json.dumps(config,sort_keys=True,separators=(',',':')).encode()
  h.update(str(p.relative_to(base)).encode());h.update(b'\0');h.update(sha(content).encode());h.update(b'\n')
 return h.hexdigest()
def source_hash():return tree_hash(ROOT,['app','components','lib','public','scripts','package.json','package-lock.json','pnpm-lock.yaml','next.config.ts','next.config.mjs','middleware.ts','proxy.ts','tsconfig.json'])
def atomic(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');os.chmod(temp,0o600);temp.replace(path)
def config():return plistlib.loads((Path.home()/'Library/LaunchAgents/ai.jarvis.board.plist').read_bytes())
def capture(args):
 c=config();db=sqlite3.connect(c['EnvironmentVariables']['JARVIS_ORDER_LAB_DIR']+'/orders.sqlite');orders=[]
 for ident in args.order:
  row=db.execute('SELECT data FROM owner_orders WHERE id=?',(ident,)).fetchone();assert row,'Unknown order';o=json.loads(row[0]);e=o.get('execution',{})
  assert o.get('projectId','jarvis-board')=='jarvis-board' and o['stage']=='reported' and o.get('review',{}).get('verdict')=='accepted' and e.get('applied') is True and re.fullmatch('[a-f0-9]{64}',e.get('afterHash','')),'Order is not an accepted applied board change'
  hashes={}
  for name in e['files']:
   p=(ROOT/name).resolve();assert p.is_relative_to(ROOT) and p.is_file(),'Missing or unsafe included file';hashes[name]=sha(p.read_bytes())
  orders.append({'id':o['id'],'projectId':'jarvis-board','updatedAt':o['updatedAt'],'afterHash':e['afterHash'],'includedFiles':hashes,'inclusionReview':args.review})
 db.close();atomic(WORK/'source-proof.json',{'sourceHash':source_hash(),'capturedAt':now(),'orders':orders});print('Captured reviewed order inclusion and source fingerprint:',len(orders))
def prepare(args):
 assert re.fullmatch('company-[0-9]{8}[a-z]+',args.release);proof=json.loads((WORK/'source-proof.json').read_text());assert proof['sourceHash']==source_hash(),'Source changed since pre-build capture'
 build=ROOT/('.next-'+args.release);dest=ROOT/'.releases'/args.release;assert (build/'BUILD_ID').exists() and not dest.exists()
 shutil.copytree(build/'standalone',dest,ignore=shutil.ignore_patterns('.env','.env.local'),symlinks=True);shutil.copytree(build/'static',dest/build.name/'static',dirs_exist_ok=True);shutil.copytree(ROOT/'public',dest/'public',dirs_exist_ok=True)
 manifest={'version':1,'buildId':(build/'BUILD_ID').read_text().strip(),'origin':ORIGIN,'createdAt':now(),'sourceHash':proof['sourceHash'],'artifactHash':tree_hash(dest,['server.js',build.name+'/server',build.name+'/static',build.name+'/BUILD_ID']),'orders':[{k:v for k,v in o.items() if k not in ['includedFiles','inclusionReview']} for o in proof['orders']]}
 atomic(dest/'deployment-manifest.json',manifest);atomic(WORK/(args.release+'-inclusion.json'),proof)
 path=Path.home()/'Library/LaunchAgents/ai.jarvis.board.plist';raw=path.read_bytes();(FLOW/'board-before.plist').write_bytes(raw);os.chmod(FLOW/'board-before.plist',0o600);c=plistlib.loads(raw);c['ProgramArguments']=['/opt/homebrew/bin/node',str(dest/'server.js')];c['WorkingDirectory']=str(dest);c['EnvironmentVariables'].update(JARVIS_BUILD_DIR=build.name,JARVIS_ORDER_SOURCE_ROOT=str(ROOT));(FLOW/'board-next.plist').write_bytes(plistlib.dumps(c));os.chmod(FLOW/'board-next.plist',0o600);atomic(FLOW/'release.json',{'release':str(dest),'buildId':manifest['buildId']});print('Prepared release with reviewed provenance:',args.release)
def verify(args):
 c=plistlib.loads((FLOW/'board-next.plist').read_bytes());e=c['EnvironmentVariables'];dest=Path(c['WorkingDirectory']);raw=(dest/'deployment-manifest.json').read_bytes();manifest=json.loads(raw);assert manifest['origin']==ORIGIN
 build=e['JARVIS_BUILD_DIR'];assert manifest['artifactHash']==tree_hash(dest,['server.js',build+'/server',build+'/static',build+'/BUILD_ID']),'Release artifact changed'
 token=hmac.new(e['SESSION_SECRET'].encode(),e['VIEWER_PASSWORD'].encode(),hashlib.sha256).hexdigest()
 def get(path,auth=True):
  req=urllib.request.Request(ORIGIN+path,headers={'User-Agent':'JarvisReleaseVerifier/1','Cache-Control':'no-cache',**({'Cookie':'jarvis-session='+token} if auth else {})})
  with urllib.request.urlopen(req,timeout=30) as r:
   assert r.url.startswith(ORIGIN+'/') and r.status==200;return r.read().decode()
 receipt={'version':1,'buildId':manifest['buildId'],'manifestHash':sha(raw),'origin':ORIGIN,'checkedAt':now(),'ok':False,'orders':manifest['orders']}
 try:
  live=json.loads(get('/api/command-room/deployment'));assert live['manifestHash']==sha(raw) and live['release']==manifest,'External release identity mismatch'
  assert manifest['buildId'] in get('/sw.js',False),'External build mismatch'
  page=get('/');assert 'JARVIS HEADQUARTERS' in page and page.index('JARVIS HEADQUARTERS')<page.index('id="company-records"')
  assets=re.findall(r'(?:src|href)="([^" ]+/_next/static/[^" ]+|/_next/static/[^" ]+)"',page);assert assets,'No external asset'
  asset=next((x for x in assets if x.endswith('.js')),assets[0]);assert asset.startswith('/_next/static/');assert get(asset,False),'Empty asset'
  try:get('/api/command-room/deployment',False);raise AssertionError('Release identity must require owner authentication')
  except urllib.error.HTTPError as ex:assert ex.code==401
  receipt['ok']=True;receipt['checks']=['외부 배포 식별자 일치','외부 게임 첫 화면 응답','외부 정적 자원 응답','소유자 인증 확인']
 finally:
  receipt['checkedAt']=now();atomic(Path(e['JARVIS_ORDER_LAB_DIR'])/'deployments'/(manifest['buildId']+'.json'),receipt)
 print('External deployment verified; linked orders:',len(manifest['orders']))
def main():
 p=argparse.ArgumentParser();s=p.add_subparsers(dest='command',required=True);a=s.add_parser('capture');a.add_argument('--order',action='append',required=True);a.add_argument('--review',required=True);a=s.add_parser('prepare');a.add_argument('--release',required=True);s.add_parser('verify');args=p.parse_args();globals()[args.command](args)

if __name__=='__main__':main()
