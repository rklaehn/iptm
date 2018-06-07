// tslint:disable:no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-console
import * as fs from 'fs'
import { toCbor } from 'iptm'
import { ColumnMap, toColumnMap } from 'iptm'
import { deflate } from 'iptm'

export const logCompression = (rows: any[], bits: number, file: string) => {
  const n = rows.length
  console.log(rows.slice(0, 100))
  const columns = toColumnMap(rows)
  console.log(columns)
  const text = JSON.stringify(rows)
  const compressed = deflate(new Buffer(text)).then(x => x.length)
  const colSize = ColumnMap.compressedSize(columns)
  const colSizeDedup = ColumnMap.compressedSizeDedup(columns)
  const cbor = toCbor(rows).then(x => x.length)
  const cborDeflate = toCbor(rows)
    .then(deflate)
    .then(x => x.length)
  const ws = fs.createWriteStream(file, { encoding: 'utf8' })
  const write = (...args: Array<any>) => {
    args.forEach((arg, i) => {
      if (i > 0) {
        ws.write(' ')
      }
      if (arg === null) {
        ws.write('null')
      } else {
        ws.write(arg.toString())
      }
    })
    ws.write('\n')
  }
  return Promise.all([compressed, cbor, cborDeflate, colSize, colSizeDedup])
    .then(([compressed, cbor, cborDeflate, colSize, colSizeDedup]) => {
      write('JSON.stringify            \t', text.length, '\t', text.length / n)
      write('CBOR                      \t', cbor, '\t', cbor / n)
      write('JSON.stringify and deflate\t', compressed, '\t', compressed / n)
      write('CBOR and deflate          \t', cborDeflate, '\t', cborDeflate / n)
      write('Compressed columns        \t', colSize, '\t', colSize / n)
      write('Compressed columns (dedup)\t', colSizeDedup, '\t', colSizeDedup / n)
      if (bits > 0) {
        write('Theoretical optimum       \t', (n * bits) / 8, '\t', bits / 8)
      }
    })
    .then(() => {
      ws.end()
    })
}
