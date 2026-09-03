/**
 * Built-in equipment constants (附录 B).
 */

export const EQUIPMENT = [
  '杠铃',
  '哑铃',
  '固定器械',
  '缆绳',
  '自重',
  '史密斯机',
  '壶铃',
  '弹力带',
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_SET: ReadonlySet<Equipment> = new Set(EQUIPMENT);

export function isEquipment(value: string): value is Equipment {
  return EQUIPMENT_SET.has(value as Equipment);
}
