// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-delete no-let no-console no-use-before-declare
import { ColumnMap, CompressedArray, DagArray, toCbor } from 'iptm'
import * as shajs from 'sha.js'

export const compressedSize = async (m: ColumnMap<any>): Promise<number> => {
  let result = 0
  if (m.values !== undefined) {
    // enable delta compression for indices
    result += await DagArray.getCompressedSize(m.values[0], { forceDelta: true })
    // let the compressor figure out if delta compression makes sense
    result += await DagArray.getCompressedSize(m.values[1])
  }
  if (m.children !== undefined) {
    for (const child of Object.values(m.children)) {
      result += await compressedSize(child)
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
    const ca: CompressedArray = x as any
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
export const compressedSizeDedup = (m: ColumnMap<any>): Promise<number> =>
  compressedSizeDedupImpl(m, {}).then(sizes => {
    console.log(sizes)
    return Object.values(sizes).reduce((x, y) => x + y, 0)
  })
