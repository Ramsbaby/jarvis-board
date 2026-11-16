/** Flutter's actual runner counters, never a timer-derived percentage. */
export function flutterTestProgress(output:string):string|undefined {
 const rows=[...output.slice(-16000).matchAll(/(?:^|[\r\n])\d+:\d+\s+\+(\d+)(?:\s+~(\d+))?(?:\s+-(\d+))?:/g)];
 const last=rows.at(-1);return last?`Flutter 검사 · 통과 ${last[1]} · 실패 ${last[3]||0} · 건너뜀 ${last[2]||0}`:undefined;
}
