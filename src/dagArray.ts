// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-delete no-let no-console
import * as zlib from 'zlib'
import { fromCbor, toCbor } from './cbor'
import { Int32 } from './int32'
import { log } from './log'

type CompressionOptions = {
  forceDelta: boolean
}
export const toDelta = (xs: ReadonlyArray<number>): ReadonlyArray<number> => {
  if (xs.length === 0) {
    throw new Error()
  }
  const result = xs.slice(1)
  for (let i = 0; i < result.length; i++) {
    result[i] = xs[i + 1] - xs[i]
  }
  return result
}
export const fromDelta = (reference: number, ds: ReadonlyArray<number>): ReadonlyArray<number> => {
  const xs: Array<any> = [reference, ...ds]
  let curr = reference
  for (let i = 1; i < xs.length; i++) {
    curr += xs[i]
    xs[i] = curr
  }
  return xs
}
export const deflate = (b: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.deflateRaw(b, (err, buffer) => {
      if (err !== null) {
        log.compress.error('deflate', b.toString('hex'), err)
        reject(err)
      } else {
        // log.compress.info('deflate', b.toString('hex'), buffer.toString('hex'))
        resolve(buffer)
      }
    })
  })
export const inflate = (b: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.inflateRaw(b, (err, buffer) => {
      if (err !== null) {
        log.compress.error('inflate', b.toString('hex'), err)
        reject(err)
      } else {
        // log.compress.info('inflate', b.toString('hex'), buffer.toString('hex'))
        resolve(buffer)
      }
    })
  })

export type CompressResult = {
  type: 'uncompressed' | 'deflate' | 'delta-deflate'
  size: number
  dag: DagArray
}
const uncompressed = (xs: ReadonlyArray<any>) =>
  // convert to cbor to check uncompressed size, even though
  // we will not use the cbor
  toCbor(xs).then<CompressResult>(buffer => ({
    type: 'uncompressed',
    size: buffer.length,
    dag: xs,
  }))
const compressed = (xs: ReadonlyArray<any>) =>
  toCbor(xs)
    .then(deflate)
    .then<CompressResult>(buffer => ({
      type: 'deflate',
      size: buffer.length,
      dag: {
        c: 'deflate',
        d: buffer,
      },
    }))
const deltaCompressed = (ns: ReadonlyArray<number>): Promise<CompressResult> =>
  toCbor(toDelta(ns))
    .then(deflate)
    .then<CompressResult>(buffer => ({
      type: 'delta-deflate',
      size: buffer.length,
      dag: {
        c: 'deflate',
        r: ns[0],
        d: buffer,
      },
    }))

const compare = (x: number, y: number): number => (x < y ? -1 : x > y ? 1 : 0)

const canDeltaCompress = (xs: ReadonlyArray<any>): ReadonlyArray<number> | undefined => {
  if (xs.length <= 1) {
    return
  }
  for (let i = 0; i < xs.length; i++) {
    if (!Number.isInteger(xs[i])) {
      return
    }
  }
  const ns: ReadonlyArray<number> = xs
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = ns[i]
    const x1 = ns[i + 1]
    const delta = x1 - x0
    if (delta + x0 !== x1) {
      return
    }
  }
  return ns
}

export const compressAllOptions = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions,
): Promise<ReadonlyArray<CompressResult>> => {
  const forceDelta = (options && options.forceDelta) || false
  if (xs.length <= 8) {
    return uncompressed(xs).then(x => [x])
  }
  const ns = canDeltaCompress(xs)
  const uncompressedResult = uncompressed(xs)
  const variants = ns
    ? forceDelta
      ? [uncompressedResult, deltaCompressed(xs)]
      : [uncompressedResult, compressed(xs), deltaCompressed(xs)]
    : [uncompressedResult, compressed(xs)]
  return Promise.all(variants).then(results => results.sort((x, y) => compare(x.size, y.size)))
}

type CompressionInfo = Readonly<{
  size: number
  type: string
}>
const getCompressionInfo = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions,
): Promise<ReadonlyArray<CompressionInfo>> =>
  compressAllOptions(xs, options).then(rs => rs.map(r => ({ size: r.size, type: r.type })))

const getCompressedSizeA = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions,
): Promise<number> => getCompressionInfo(xs, options).then(x => x[0].size)

const compressBestOption = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions,
): Promise<DagArray> => compressAllOptions(xs, options).then(xs => xs[0].dag)

const arrayFromCbor = (buffer: Buffer) =>
  fromCbor(buffer).then(
    dag => (Array.isArray(dag) ? Promise.resolve(dag) : Promise.reject('not an array')),
  )

const decompressDagArray = (x: DagArray): Promise<ReadonlyArray<any>> => {
  if (Array.isArray(x)) {
    return Promise.resolve(x)
  } else {
    const { c: compression, r: reference, d: data } = x as CompressedArray
    switch (compression) {
      case 'deflate': {
        if (reference === undefined) {
          return inflate(data).then(inflated => arrayFromCbor(inflated))
        } else {
          return inflate(data)
            .then(arrayFromCbor)
            .then(xs => {
              const ds = Int32.maybeArray(xs)
              return ds === undefined
                ? Promise.reject('not a number array')
                : Promise.resolve(fromDelta(reference, ds))
            })
        }
      }
      default:
        throw new Error(`unsupported compression ${compression}`)
    }
  }
}

export type CompressionType = 'deflate'
export type CompressedArray = {
  c: CompressionType // compression type
  r?: number // reference value for delta compression
  d: Buffer // or base64 encoded string?
}
export type DagArray = ReadonlyArray<any> | CompressedArray
export const DagArray = {
  compress: compressBestOption,
  decompress: decompressDagArray,
  getCompressionInfo,
  getCompressedSize: getCompressedSizeA,
}
