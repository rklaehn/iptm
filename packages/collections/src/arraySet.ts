// tslint:disable no-class no-this readonly-array no-expression-statement no-object-mutation no-let max-classes-per-file
import { Ord } from 'fp-ts/lib/Ord'
import { BinaryMerge, cr, index } from './binaryMerge'

const emptyArraySet: ArraySet<never> = [] as any
const unsafeToArraySet = <T>(value: ReadonlyArray<T>): ArraySet<T> => value as any

type RA<T> = ReadonlyArray<T>

const arrayCopy = <T>(a: RA<T>, a0: index, a1: index, t: T[]) => {
  let ai = a0
  while (ai < a1) {
    t.push(a[ai])
    ai++
  }
}

class Intersection<T> extends BinaryMerge {
  r: T[] = []
  constructor(private a: RA<T>, private b: RA<T>, private ord: Ord<T>) {
    super()
  }
  compare(ai: index, bi: index): cr {
    return this.ord.compare(this.a[ai], this.b[bi])
  }
  collision(ai: index, _bi: index): void {
    this.r.push(this.a[ai])
  }
}

class Union<T> extends BinaryMerge {
  r: T[] = []
  constructor(private a: RA<T>, private b: RA<T>, private ord: Ord<T>) {
    super()
  }
  compare(ai: index, bi: index): cr {
    return this.ord.compare(this.a[ai], this.b[bi])
  }
  collision(ai: index, _bi: index): void {
    this.r.push(this.a[ai])
  }
  fromA(a0: index, a1: index, _bi: index): void {
    arrayCopy(this.a, a0, a1, this.r)
  }
  fromB(_ai: index, b0: index, b1: index): void {
    arrayCopy(this.b, b0, b1, this.r)
  }
}

class Except<T> extends BinaryMerge {
  r: T[] = []
  constructor(private a: RA<T>, private b: RA<T>, private ord: Ord<T>) {
    super()
  }
  compare(ai: index, bi: index): cr {
    return this.ord.compare(this.a[ai], this.b[bi])
  }
  fromA(a0: index, a1: index): void {
    arrayCopy(this.a, a0, a1, this.r)
  }
}

export const enum ArraySetTag {}
export type ArraySet<T> = ReadonlyArray<T> & ArraySetTag
export const ArraySet = {
  empty: <T>(): ArraySet<T> => emptyArraySet,
  single: <T>(value: T): ArraySet<T> => unsafeToArraySet<T>([value]),
  isEmpty: <T>(s: ArraySet<T>): boolean => s.length === 0,
  union: <T>(a: ArraySet<T>, b: ArraySet<T>, ord: Ord<T>): ArraySet<T> =>
    unsafeToArraySet(new Union(a, b, ord).r),
  intersection: <T>(a: ArraySet<T>, b: ArraySet<T>, ord: Ord<T>): ArraySet<T> =>
    unsafeToArraySet(new Intersection(a, b, ord).r),
  except: <T>(a: ArraySet<T>, b: ArraySet<T>, ord: Ord<T>): ArraySet<T> =>
    unsafeToArraySet(new Except(a, b, ord).r),
}
