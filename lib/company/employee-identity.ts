import type { OfficeEmployee } from '../command-room/employees';
import { TEAM_REGISTRY } from '../map/team-registry';
/** Use registered responsibilities; do not invent a seniority rank from a character's name. */
export function employeeIdentity(employee?:Pick<OfficeEmployee,'id'|'name'|'role'>):string {
  if(!employee)return '담당 확인 필요';
  const role=TEAM_REGISTRY[employee.id]?.roleLabel;
  return role?`${employee.name} · ${role}`:employee.name;
}
