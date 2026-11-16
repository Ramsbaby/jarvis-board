"""격리 빌드(.next-<release>)를 .releases/<release> 로 묶고 ai.jarvis.board 를 교체한다. 실패하면 이전 설정으로 되돌린다.
사용: JARVIS_BUILD_DIR=.next-<release> npx next build --webpack && python3 scripts/company-promote.py <release> && python3 scripts/company-release.py verify"""
import sys,json,shutil,plistlib,os,re,subprocess,time
sys.path.insert(0,'scripts')
import importlib.util
spec=importlib.util.spec_from_file_location('cr','scripts/company-release.py');cr=importlib.util.module_from_spec(spec);spec.loader.exec_module(cr)
from pathlib import Path
rel=sys.argv[1];ROOT=cr.ROOT;build=ROOT/('.next-'+rel);dest=ROOT/'.releases'/rel
assert (build/'BUILD_ID').exists() and not dest.exists()
shutil.copytree(build/'standalone',dest,ignore=shutil.ignore_patterns('.env','.env.local'),symlinks=True);shutil.copytree(build/'static',dest/build.name/'static',dirs_exist_ok=True);shutil.copytree(ROOT/'public',dest/'public',dirs_exist_ok=True,ignore=shutil.ignore_patterns('jarvis-ab.html'))
m={'version':1,'buildId':(build/'BUILD_ID').read_text().strip(),'origin':cr.ORIGIN,'createdAt':cr.now(),'sourceHash':cr.source_hash(),'artifactHash':cr.tree_hash(dest,['server.js',build.name+'/server',build.name+'/static',build.name+'/BUILD_ID']),'orders':[],'note':'사장 지시 없이 진행한 직접 UI 개선(직원 상태 기준 통일·지도 상태 점)'}
cr.atomic(dest/'deployment-manifest.json',m)
FLOW=cr.FLOW;path=Path.home()/'Library/LaunchAgents/ai.jarvis.board.plist';raw=path.read_bytes();(FLOW/'board-before.plist').write_bytes(raw);os.chmod(FLOW/'board-before.plist',0o600)
c=plistlib.loads(raw);c['ProgramArguments']=['/opt/homebrew/bin/node',str(dest/'server.js')];c['WorkingDirectory']=str(dest);c['EnvironmentVariables'].update(JARVIS_BUILD_DIR=build.name,JARVIS_ORDER_SOURCE_ROOT=str(ROOT))
(FLOW/'board-next.plist').write_bytes(plistlib.dumps(c));os.chmod(FLOW/'board-next.plist',0o600);cr.atomic(FLOW/'release.json',{'release':str(dest),'buildId':m['buildId']})
dom=f'gui/{os.getuid()}'
subprocess.run(['launchctl','bootout',dom+'/ai.jarvis.board'],check=True)
try:
 shutil.copy2(FLOW/'board-next.plist',path);os.chmod(path,0o600)
 for i in range(20):
  r=subprocess.run(['launchctl','bootstrap',dom,str(path)],capture_output=True,text=True)
  if r.returncode==0:break
  time.sleep(.5)
 else:raise RuntimeError('bootstrap failed')
except Exception:
 shutil.copy2(FLOW/'board-before.plist',path);subprocess.run(['launchctl','bootstrap',dom,str(path)],check=True);raise
print('promoted',rel,m['buildId'])
