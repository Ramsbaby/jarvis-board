/** Next's internal URL may use localhost while the owner's browser uses 127.0.0.1. */
export function sameOrderOrigin(origin:string|null,host:string|null,protocol:string) {
  if(!origin||!host||!['http:','https:'].includes(protocol))return false;
  try{return new URL(origin).origin===new URL(`${protocol}//${host}`).origin;}catch{return false;}
}
