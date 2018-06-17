// #region impl
// tslint:disable:no-if-statement no-expression-statement no-object-mutation
// tslint:disable:readonly-array array-type no-delete no-let no-use-before-declare
type ColumnMapImpl<T> = {
  s: [Array<number>, Array<T>]
  o: { [key: string]: ColumnMapImpl<T> }
  a: Array<ColumnMapImpl<T>>
}
const stripInPlace = <T>(store: ColumnMapImpl<T>): ColumnMap<T> => {
  if (store.s[0].length === 0) {
    delete store.s
  }
  const o = Object.values(store.o)
  if (o.length === 0) {
    delete store.o
  } else {
    o.forEach(stripInPlace)
  }
  const a = store.a
  if (a.length === 0) {
    delete store.a
  } else {
    a.forEach(stripInPlace)
  }
  return store
}

const ColumnMapImpl = {
  /**
   * Creates a new empty column map.
   * We are using mutability, so everything needs to be fresh.
   */
  empty: <T>(): ColumnMapImpl<T> => ({
    s: [[], []],
    o: {},
    a: [],
  }),
  /**
   * Strips unused fields in place and returns the thing as a ColumnStore, never
   * to be mutated again
   */
  build: stripInPlace,
}

const lookupO = <V>(m: { [k: string]: V }, k: string): V | undefined => m[k]

const getOrCreateO = <T>(store: ColumnMapImpl<T>, key: string): ColumnMapImpl<T> => {
  const result = lookupO(store.o, key)
  if (result !== undefined) {
    return result
  } else {
    const child = ColumnMapImpl.empty<T>()
    store.o[key] = child
    return child
  }
}

const lookupA = <V>(a: ReadonlyArray<V>, index: number): V | undefined => a[index]

const getOrCreateA = <T>(store: ColumnMapImpl<T>, index: number): ColumnMapImpl<T> => {
  const result = lookupA(store.a, index)
  if (result !== undefined) {
    return result
  } else {
    const child = ColumnMapImpl.empty<T>()
    store.a[index] = child
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
    if (typeof key === 'number') {
      console.log('got number key', key)
      throw new Error('WAT?')
    }
    // if (typeof key === 'string') {
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
    // } else if (typeof key === 'number') {
    //   const child = obj[key]
    //   const childExists = child !== undefined
    //   const child1 = childExists ? child : []
    //   const child2 = updateInPlace(child1, path, from + 1, value)
    //   // if the column store is canonical, I will never overwrite a scalar value,
    //   // and the from === path.length - 1 test is not necessary. But let's accept
    //   // non-canonical formats as well
    //   const mustUpdate = from === path.length - 1 || !childExists
    //   if (mustUpdate) {
    //     obj[key] = child2
    //   }
    // }
    return obj
  }
}

export const fromColumnMap = <T>(columns: ColumnMap<T>): RA<T> => {
  const rows: any = {}
  // first position is placeholder for the current index
  const path: Array<any> = [undefined]
  const addToRows = (store: ColumnMap<T>): void => {
    if (store.s !== undefined) {
      const [indices, values] = store.s
      if (values.length !== indices.length) {
        throw new Error()
      }
      for (let i = 0; i < values.length; i++) {
        const index = indices[i]
        const value = values[i]
        path[0] = String(index)
        updateInPlace(rows, path, 0, value)
      }
    }
    if (store.o !== undefined) {
      const children = store.o
      Object.entries(children).forEach(([key, childStore]) => {
        path.push(key)
        addToRows(childStore)
        path.pop()
      })
    }
    // if (store.a !== undefined) {
    //   const children = store.a
    //   for (let key = 0; key < children.length; key += 1) {
    //     const childStore = lookupA(store.a, key)
    //     if (childStore !== undefined) {
    //       path.push(key)
    //       addToRows(childStore)
    //       path.pop()
    //     }
    //   }
    // }
  }
  addToRows(columns)
  return Object.values(rows)
}

const addToValuesAndIndices = (store: ColumnMapImpl<any>, obj: any, index: number): void => {
  if (isPrimitive(obj)) {
    store.s[0].push(index)
    store.s[1].push(obj)
  } else if (Array.isArray(obj)) {
    for (let key = 0; key < obj.length; key += 1) {
      const childStore = getOrCreateA(store, key)
      const value = lookupA(obj, key)
      if (value !== undefined) {
        addToValuesAndIndices(childStore, value, index)
      }
    }
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const childStore = getOrCreateO(store, key)
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

const maxIndex = (a: ColumnMap<any>, max: number): number => {
  let currentMax = max
  if (a.s) {
    const indices = a.s[0]
    if (indices.length > 0) {
      currentMax = Math.max(currentMax, indices[indices.length - 1])
    }
  }
  if (a.o) {
    Object.values(a.o).forEach(child => {
      currentMax = maxIndex(child, currentMax)
    })
  }
  return currentMax
}

const shiftIndices = <T>(a: ColumnMap<T>, offset: number): ColumnMap<T> => {
  const scalar: [RA<number>, RA<T>] | undefined = a.s
    ? [a.s[0].map(x => x + offset), a.s[1]]
    : undefined
  const objects = a.o
    ? Object.entries(a.o).reduce(
        (acc, [k, v]) => {
          acc[k] = shiftIndices(v, offset)
          return acc
        },
        {} as { [key: string]: ColumnMap<T> },
      )
    : undefined
  return { s: scalar, o: objects }
}

const concat0 = <T>(a: ColumnMap<T>, b: ColumnMap<T>): ColumnMap<T> => {
  const av = a.s || [[], []]
  const bv = b.s || [[], []]
  const ac = a.o || {}
  const bc = b.o || {}
  const i1 = av[0].concat(bv[0])
  const v1 = av[1].concat(bv[1])
  const scalar: typeof a.s = i1.length > 0 ? [i1, v1] : undefined
  const children: typeof a.o = { ...ac, ...bc }
  const keys = Object.keys(children)
  keys.forEach(key => {
    const childa: ColumnMap<T> = ac[key]
    const childb: ColumnMap<T> = bc[key]
    if (childa && childb) {
      children[key] = concat0(childa, childb)
    }
  })
  return { s: scalar, o: keys.length > 0 ? children : undefined }
}

// @ts-ignore
const concat = <T>(a: ColumnMap<T>, b: ColumnMap<T>): ColumnMap<T> => {
  const offset = maxIndex(a, -1) + 1
  const b1 = shiftIndices(b, offset)
  return concat0(a, b1)
}

type ColumnIteratorResult = {
  value: any
  hasValue: boolean
}

type ColumnIterator = {
  next: (index: number, r: ColumnIteratorResult) => void
}

const ColumnIterator = {
  of: (values: [RA<number>, RA<any>]): ColumnIterator => {
    let current = 0
    const [is, vs] = values
    return {
      next: (index: number, r: ColumnIteratorResult): void => {
        while (current < is.length && is[current] < index) {
          current++
        }
        const hasValue = is[current] === index
        r.hasValue = hasValue
        r.value = hasValue ? vs[current] : undefined
      },
    }
  },
}

type ColumnIteratorMap<T> = Readonly<{
  values?: ColumnIterator
  children?: { [key: string]: ColumnIteratorMap<any> }
}>

const ColumnIteratorMap = {
  of: <T>(m: ColumnMap<T>): ColumnIteratorMap<T> => {
    const values = m.s !== undefined ? ColumnIterator.of(m.s) : undefined
    if (m.o === undefined) {
      return { values }
    } else {
      const children: { [key: string]: ColumnIteratorMap<any> } = {}
      Object.entries(m.o).forEach(([key, value]) => {
        children[key] = ColumnIteratorMap.of(value)
      })
      return { values, children }
    }
  },
}

const iterate0 = <T>(im: ColumnIteratorMap<T>, index: number, rs: ColumnIteratorResult): void => {
  if (im.values) {
    im.values.next(index, rs)
    if (rs.hasValue) {
      return
    }
  }
  let result: any
  if (im.children) {
    Object.entries(im.children).forEach(([key, value]) => {
      iterate0(value, index, rs)
      if (rs.hasValue) {
        if (result === undefined) {
          result = {}
        }
        result[key] = rs.value
      }
    })
  }
  rs.hasValue = result !== undefined
  rs.value = result
}

const iterator = <T>(value: ColumnMap<T>): Iterator<T> => {
  const im = ColumnIteratorMap.of(value)
  let index: number = 0
  const rs: ColumnIteratorResult = {
    hasValue: false,
    value: undefined,
  }
  return {
    next: (): IteratorResult<T> => {
      iterate0(im, index, rs)
      if (rs.hasValue) {
        index += 1
        return { value: rs.value, done: false }
      } else {
        // from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols
        // value - any JavaScript value returned by the iterator. Can be omitted when done is true.
        return { done: true } as any
      }
    },
  }
}

const builder = <T>(): ColumnMapBuilder<T> => {
  const rootStore: ColumnMapImpl<T> = ColumnMapImpl.empty()
  let index = 0
  return {
    add: (value: T): void => addToValuesAndIndices(rootStore, value, index++),
    build: () => ColumnMapImpl.build<T>(rootStore),
  }
}

const iterable = <T>(value: ColumnMap<T>): Iterable<T> => ({
  [Symbol.iterator]: () => iterator(value),
})
// #endregion
export type RA<T> = ReadonlyArray<T>
export type ColumnMap<T> = Readonly<{
  /**
   * Scalar values. Separate arrays of indices and values
   */
  s?: [RA<number>, RA<any>]
  /**
   * Object children, indexed by string
   */
  o?: { [key: string]: ColumnMap<any> }
  /**
   * Array children, indexed by number (dense)
   */
  a?: RA<ColumnMap<any>>
}>
export interface ColumnMapBuilder<T> {
  add: (value: T) => void
  build: () => ColumnMap<T>
}
export const ColumnMap = {
  of: toColumnMap,
  toArray: fromColumnMap,
  concat,
  iterable,
  iterator,
  builder,
}
