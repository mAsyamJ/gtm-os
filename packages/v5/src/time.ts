import { GtmError } from '../../observability/src/index.js';

export const TARGET_ZONES = ['America/New_York','America/Los_Angeles','Europe/London'] as const;
export function wallTime(at: Date, zone: string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Find all valid instants rather than applying an assumed fixed UTC offset across DST. */
export function resolveSlot(local: string, zone: string) {
  if(!TARGET_ZONES.includes(zone as typeof TARGET_ZONES[number]) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw new GtmError('INVALID_SLOT','Audience zone and minute-resolution local slot required',2);
  const base=Date.parse(local+'Z');
  if(!Number.isFinite(base) || new Date(base).toISOString().slice(0,16)!==local)throw new GtmError('INVALID_SLOT','Invalid calendar date or time',2);
  const matches:number[]=[];
  for(let offset=-14*60;offset<=14*60;offset+=15){const instant=base+offset*60000;if(wallTime(new Date(instant),zone)===local)matches.push(instant);}
  if(matches.length!==1)throw new GtmError('DST_SLOT','Ambiguous or nonexistent local time; choose an unambiguous slot',2);
  return new Date(matches[0]!).toISOString();
}
export function timeDisplay(dueAt: string, zone: string) {const at=new Date(dueAt);return {utc:at.toISOString(),wib:wallTime(at,'Asia/Jakarta'),audience:wallTime(at,zone),audienceZone:zone,operatorZone:'Asia/Jakarta'};}
