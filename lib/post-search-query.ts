/** Search-box input is text, not an FTS expression (hyphens, quotes and colons included). */
export function postSearchQuery(input:string):string {
  return input.trim().split(/\s+/).filter(Boolean)
    .map(term=>'"'+term.replace(/"/g,'""')+'"*').join(' AND ');
}
