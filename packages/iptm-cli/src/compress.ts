// tslint:disable no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable array-type no-console no-floating-promises no-object-mutation no-let
// tslint:disable no-expression-statement no-object-mutation
import * as fs from 'fs'
import { ColumnMap } from 'iptm'
import { dagPut } from './dagApi'
import { compressAndStore } from './encodeDecode'

if (process.argv.length <= 2) {
  console.log('npm run compress <json file>')
  process.exit(1)
}
const arg = process.argv[2]
const json = JSON.parse(fs.readFileSync(arg, 'utf8'))

if (!Array.isArray(json)) {
  console.log('must be array!')
  process.exit(2)
}

const columns = ColumnMap.of(json)
// const rand = (n: number): number => {
//   if (n <= 0 || !Number.isSafeInteger(n)) {
//     throw new Error()
//   }
//   return Math.floor(Math.random() * n)
// }
//
// const createSample = (_: any, i: number) => ({
//   semantics: 'someFish', // constant
//   name: 'fish1', // constant
//   sourceId: 'asafjsiodfuhgildkh', // constant
//   sequence: i + 1, // regular => constant
//   timestamp: i * 1000 + rand(16), // 4 bits
//   payload: {
//     type: 'sample', // constant
//     value: rand(16), // 4 bits
//     status: rand(2) === 0, // 1 bit
//   },
// })
// const testData = Array.from({ length: 100000 }).map(createSample)
// fs.writeFileSync('test.json', JSON.stringify(testData))

compressAndStore(dagPut)(columns).then(res => {
  console.log(res['/'])
  // return loadAndDecompress(dagGet)(res).then(columns1 => {
  //   const rows = ColumnMap.toArray(columns1)
  //   console.log(JSON.stringify(rows))
  // })
})
