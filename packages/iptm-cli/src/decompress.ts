// tslint:disable no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable array-type no-console no-floating-promises no-object-mutation no-let
// tslint:disable no-expression-statement no-object-mutation
import { ColumnMap } from 'iptm'
import { dagGet, Link } from './dagApi'
import { loadAndDecompress } from './encodeDecode'

if (process.argv.length <= 2) {
  console.log('npm run decompress <ipfs hash>')
  process.exit(1)
}
const arg = process.argv[2]
const link = Link.of(arg)

loadAndDecompress(dagGet)(link).then(columns1 => {
  const rows = ColumnMap.toArray(columns1)
  console.log(JSON.stringify(rows))
})
