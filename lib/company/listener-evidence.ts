export function listenerIdentity(command:string,cwd:string|null,release:string):'matched'|'different_directory'|'unknown' {
  if(command.includes(`${release}/server.js`))return 'matched';
  if(cwd===release)return 'matched';
  return cwd?'different_directory':'unknown';
}
