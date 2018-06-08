// tslint:disable:no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-console no-floating-promises no-object-mutation no-let
import { ColumnMap, CompressedArray, DagArray } from 'iptm'
import { DagGet, DagPut, Link } from './dagApi'

// @ts-ignore
export type ColumnIndex<T> = Readonly<{
  values?: [Link<DagArray>, Link<DagArray>]
  children?: {
    [key: string]: ColumnIndex<any>
  }
}>

const bufferToString = (x: DagArray): DagArray => {
  if (Array.isArray(x)) return x
  const ca: CompressedArray = x as any
  ca.d = ca.d.toString('base64') as any
  return ca
}

const stringToBuffer = (x: DagArray): DagArray => {
  if (Array.isArray(x)) return x
  const ca: CompressedArray = x as any
  if (typeof ca.d === 'string') {
    ca.d = new Buffer(ca.d, 'base64')
  }
  return ca
}

export type CompressionStats = Readonly<{
  size: number
  blocks: number
}>

export type CompressionResult<T> = Readonly<{
  link: Link<ColumnIndex<T>>
  stats: CompressionStats
}>

export const compressAndStore = <T>(dagPut: DagPut) => (
  data: ColumnMap<T>,
): Promise<CompressionResult<T>> => {
  const blockMap: { [key: string]: number } = {}
  const toIndex = async (m: ColumnMap<any>): Promise<ColumnIndex<any>> => {
    let result: ColumnIndex<any> = {}
    const children: any = {}
    if (m.values !== undefined) {
      const compressedIndices = await DagArray.compress(m.values[0])
      const compressedValues = await DagArray.compress(m.values[1])
      const indexLink = await dagPut(bufferToString(compressedIndices))
      const valueLink = await dagPut(bufferToString(compressedValues))
      blockMap[indexLink['/']] = await DagArray.cborSize(compressedIndices)
      blockMap[valueLink['/']] = await DagArray.cborSize(compressedValues)
      result = { values: [indexLink, valueLink] }
    }
    if (m.children !== undefined) {
      for (const [key, child] of Object.entries(m.children)) {
        children[key] = await toIndex(child)
      }
    }
    if (Object.keys(children).length > 0) {
      result = { ...result, children }
    }
    return result
  }
  return toIndex(data)
    .then(index => dagPut(index))
    .then<CompressionResult<T>>(link => {
      const values = Object.values(blockMap)
      const size = values.reduce((x, y) => x + y, 0)
      const blocks = values.length
      return {
        link,
        stats: {
          size,
          blocks,
        },
      }
    })
}

export const loadAndDecompress = <T>(dagGet: DagGet) => (
  link: Link<ColumnIndex<T>>,
): Promise<ColumnMap<T>> => {
  const toColumnMap = async (m: ColumnIndex<any>): Promise<ColumnMap<any>> => {
    let result: ColumnMap<any> = {}
    const children: any = {}
    if (m.values !== undefined) {
      const ic: DagArray = stringToBuffer(await dagGet(m.values[0]))
      const vc: DagArray = stringToBuffer(await dagGet(m.values[1]))
      const i = await DagArray.decompress(ic)
      const v = await DagArray.decompress(vc)
      result = { values: [i, v] }
    }
    if (m.children !== undefined) {
      for (const [key, child] of Object.entries(m.children)) {
        children[key] = await toColumnMap(child)
      }
    }
    if (Object.keys(children).length > 0) {
      result = { ...result, children }
    }
    return result
  }
  return dagGet(link).then(index => toColumnMap(index))
}
