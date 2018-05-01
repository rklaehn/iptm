// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-delete no-let no-console
import * as shajs from 'sha.js'
import { toCbor } from './cbor'
import { CompressedArray, DagArray } from './dagArray'

export type RA<T> = ReadonlyArray<T>

type ColumnMapImpl<T> = {
  values: [Array<number>, Array<T>]
  children: { [key: string]: ColumnMapImpl<T> }
}
const stripInPlace = <T>(store: ColumnMapImpl<T>): ColumnMap<T> => {
  if (store.values[0].length === 0) {
    delete store.values
  }
  const children = Object.values(store.children)
  if (children.length === 0) {
    delete store.children
  } else {
    children.forEach(stripInPlace)
  }
  return store
}
const getCompressedSize = async (m: ColumnMap<any>): Promise<number> => {
  let result = 0
  if (m.values !== undefined) {
    // enable delta compression for indices
    result += await DagArray.getCompressedSize(m.values[0], { forceDelta: true })
    // let the compressor figure out if delta compression makes sense
    result += await DagArray.getCompressedSize(m.values[1])
  }
  if (m.children !== undefined) {
    for (const child of Object.values(m.children)) {
      result += await getCompressedSize(child)
    }
  }
  return result
}
const sha1 = (buffer: Buffer): string => {
  return shajs('sha1')
    .update(buffer.toString('hex'))
    .digest('hex')
}
const getBufferForSizing = (x: DagArray): Promise<Buffer> => {
  if (Array.isArray(x)) {
    return toCbor(x)
  } else {
    const ca = x as CompressedArray
    // not exactly accurate, since we would have to add the
    // compression type and reference in case of delta compression.
    // also, we assume that cbor dag will store a buffer without overhead
    // (no base64 or anything)
    return Promise.resolve(ca.d)
  }
}
const compressedSizeDedupImpl = async (
  m: ColumnMap<any>,
  sizes: { [key: string]: number },
): Promise<{ [key: string]: number }> => {
  if (m.values !== undefined) {
    // enable delta compression for indices
    const indices = await DagArray.compress(m.values[0], { forceDelta: true })
    const values = await DagArray.compress(m.values[1])
    const ib = await getBufferForSizing(indices)
    const vb = await getBufferForSizing(values)
    sizes[sha1(ib)] = ib.length
    sizes[sha1(vb)] = vb.length
  }
  if (m.children !== undefined) {
    for (const child of Object.values(m.children)) {
      await compressedSizeDedupImpl(child, sizes)
    }
  }
  return sizes
}
const getCompressedSizesDedup = (m: ColumnMap<any>): Promise<number> =>
  compressedSizeDedupImpl(m, {}).then(sizes => {
    console.log(sizes)
    return Object.values(sizes).reduce((x, y) => x + y, 0)
  })

const ColumnMapImpl = {
  /**
   * Creates a new empty column map.
   * We are using mutability, so everything needs to be fresh.
   */
  empty: <T>(): ColumnMapImpl<T> => ({
    values: [[], []],
    children: {},
  }),
  /**
   * Strips unused fields in place and returns the thing as a ColumnStore, never
   * to be mutated again
   */
  build: stripInPlace,
}

const getOrCreateInPlace = <T>(store: ColumnMapImpl<T>, key: string): ColumnMapImpl<T> => {
  const result = store.children[key]
  if (result !== undefined) {
    return result
  } else {
    const child = ColumnMapImpl.empty<T>()
    store.children[key] = child
    return child
  }
}

const isPrimitive = (key: any): boolean => {
  if (key === null) {
    return true
  }
  const type = typeof key
  if (type === 'function') {
    throw new Error('What do you think this is? unisonweb.org?')
  }
  if (type === 'object') {
    return false
  }
  return true
}

const updateInPlace = (obj: any, path: RA<string>, from: number, value: any): any => {
  if (from === path.length) {
    // at the end, just return the value and let the caller deal with storing it
    return value
  } else {
    const key = path[from]
    const child = obj[key]
    const childExists = child !== undefined
    const child1 = childExists ? child : {}
    const child2 = updateInPlace(child1, path, from + 1, value)
    // if the column store is canonical, I will never overwrite a scalar value,
    // and the from === path.length - 1 test is not necessary. But let's accept
    // non-canonical formats as well
    const mustUpdate = from === path.length - 1 || !childExists
    if (mustUpdate) {
      obj[key] = child2
    }
    return obj
  }
}

export const fromColumnMap = <T>(columns: ColumnMap<T>): RA<T> => {
  const rows: any = {}
  // first position is placeholder for the current index
  const path: Array<any> = [undefined]
  const addToRows = (store: ColumnMap<T>): void => {
    if (store.values !== undefined) {
      const [indices, values] = store.values
      if (values.length !== indices.length) {
        throw new Error()
      }
      for (let i = 0; i < values.length; i++) {
        const index = indices[i]
        const value = values[i]
        path[0] = index
        updateInPlace(rows, path, 0, value)
      }
    }
    if (store.children !== undefined) {
      const children = store.children
      Object.entries(children).forEach(([key, childStore]) => {
        path.push(key)
        addToRows(childStore)
        path.pop()
      })
    }
  }
  addToRows(columns)
  return Object.values(rows)
}

const addToValuesAndIndices = (store: ColumnMapImpl<any>, obj: any, index: number): void => {
  if (isPrimitive(obj)) {
    store.values[0].push(index)
    store.values[1].push(obj)
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const childStore = getOrCreateInPlace(store, key)
      addToValuesAndIndices(childStore, value, index)
    })
  }
}

export const toColumnMap = <T>(rows: RA<T>): ColumnMap<T> => {
  const rootStore: ColumnMapImpl<T> = ColumnMapImpl.empty()
  rows.forEach((row, index) => {
    addToValuesAndIndices(rootStore, row, index)
  })
  return ColumnMapImpl.build<T>(rootStore)
}

export interface ColumnMapBuilder<T> {
  add: (value: T) => void
  build: () => ColumnMap<T>
}

export const ColumnMapBuilder = {
  create: <T>(): ColumnMapBuilder<T> => {
    const rootStore: ColumnMapImpl<T> = ColumnMapImpl.empty()
    let index = 0
    return {
      add: (value: T): void => addToValuesAndIndices(rootStore, value, index++),
      build: () => ColumnMapImpl.build<T>(rootStore),
    }
  },
}

// const pick = <T>(a: ColumnMap<T>, indices: number[]): ColumnMap<T> => {
//   throw new Error()
// }

// @ts-ignore
const concat = <T>(a: ColumnMap<T>, b: ColumnMap<T>): ColumnMap<T> => {
  const offset = maxIndex(a, -1) + 1
  const b1 = shiftIndices(b, offset)
  return concat0(a, b1)
}

const concat0 = <T>(a: ColumnMap<T>, b: ColumnMap<T>): ColumnMap<T> => {
  const av = a.values || [[], []]
  const bv = b.values || [[], []]
  const ac = a.children || {}
  const bc = b.children || {}
  const i1 = av[0].concat(bv[0])
  const v1 = av[1].concat(bv[1])
  const values: typeof a.values = i1.length > 0 ? [i1, v1] : undefined
  const children: typeof a.children = { ...ac, ...bc }
  const keys = Object.keys(children)
  keys.forEach(key => {
    const childa: ColumnMap<T> = ac[key]
    const childb: ColumnMap<T> = bc[key]
    if (childa && childb) {
      children[key] = concat0(childa, childb)
    }
  })
  return { values, children: keys.length > 0 ? children : undefined }
}

const shiftIndices = <T>(a: ColumnMap<T>, offset: number): ColumnMap<T> => {
  const values: [RA<number>, RA<T>] | undefined = a.values
    ? [a.values[0].map(x => x + offset), a.values[1]]
    : undefined
  const children = a.children
    ? Object.entries(a.children).reduce(
        (acc, [k, v]) => {
          acc[k] = shiftIndices(v, offset)
          return acc
        },
        {} as { [key: string]: ColumnMap<T> },
      )
    : undefined
  return { values, children }
}

const maxIndex = (a: ColumnMap<any>, max: number): number => {
  let currentMax = max
  if (a.values) {
    const indices = a.values[0]
    if (indices.length > 0) {
      currentMax = Math.max(currentMax, indices[indices.length - 1])
    }
  }
  if (a.children) {
    Object.values(a.children).forEach(child => {
      currentMax = maxIndex(child, currentMax)
    })
  }
  return currentMax
}

export type TypedColumnMap<T> = Readonly<
  T extends object
    ? { children: { [K in keyof T]: TypedColumnMap<T[K]> } }
    : { values: [RA<number>, RA<T>] }
>
export type ColumnMap<T> = Readonly<{
  values?: [RA<number>, RA<any>]
  children?: { [key: string]: ColumnMap<any> }
}>
export const ColumnMap = {
  compressedSize: getCompressedSize,
  compressedSizeDedup: getCompressedSizesDedup,
  of: toColumnMap,
  toArray: fromColumnMap,
}
