const asInt32Array = (xs: ReadonlyArray<any>): ReadonlyArray<Int32> | undefined =>
  xs.every(isInt32) ? (xs as ReadonlyArray<Int32>) : undefined
const isInt32 = (x: any): boolean =>
  Number.isSafeInteger(x) && x >= Int32.minValue && x <= Int32.maxValue
const maybeInt32 = (x: any): Int32 | undefined => (isInt32(x) ? (x as Int32) : undefined)
export const enum Int32Tag {}
export type Int32 = number & Int32Tag
export const Int32 = {
  minValue: -2147483648 as Int32,
  maxValue: 2147483647 as Int32,
  zero: 0 as Int32,
  maybe: maybeInt32,
  is: isInt32,
  maybeArray: asInt32Array,
}
