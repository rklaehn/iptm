// tslint:disable no-let no-if-statement no-expression-statement no-object-mutation
import { ColumnMap, RA } from './columnMap'

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
    const values = m.values !== undefined ? ColumnIterator.of(m.values) : undefined
    if (m.children === undefined) {
      return { values }
    } else {
      const children: { [key: string]: ColumnIteratorMap<any> } = {}
      Object.entries(m.children).forEach(([key, value]) => {
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

export const iterator = <T>(value: ColumnMap<T>): Iterator<T> => {
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

export const iterable = <T>(value: ColumnMap<T>): Iterable<T> => ({
  [Symbol.iterator]: () => iterator(value),
})
