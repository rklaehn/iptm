// tslint:disable:no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-console
import * as fs from 'fs'
import { logCompression } from './logCompression';

if (process.argv.length <= 2) {
  console.log('yarn compress <json file>')
  process.exit(1)
}
const arg = process.argv[2]
const json = JSON.parse(fs.readFileSync(arg, 'utf8'))

if (!Array.isArray(json)) {
  console.log('must be array!')
  process.exit(2)
}

const rows: any[] = json
const target = process.argv[3] || 'out.csv'
logCompression(rows, -1, target)
