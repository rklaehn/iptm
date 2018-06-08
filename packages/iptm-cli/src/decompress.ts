// tslint:disable
// tslint:enable prettier
import * as commander from 'commander'
import { ColumnMap } from 'iptm'
import { DagApi, Link } from './dagApi'
import { loadAndDecompress } from './encodeDecode'

const args = commander
  .description('Decompresses an ipfs link and outputs it as a json array.')
  .usage('decompress [options] <ipfs hash>')
  .option('-v, --verbose', 'verbosity level', (_v, total) => total + 1, 0)
  .option('--compact', 'compact json output')
  .option(
    '--api <string>',
    'ipfs api to use. defaults to http://localhost:5001. No trailing slashes!',
  )
  .parse(process.argv)

// const verbose = args.verbose || 0
const api: string | undefined = args.api
const compact: boolean = args.compact || false
const dagApi = DagApi.of(api)

if (args.args.length === 0) {
  console.log('missing ipfs hash')
  args.outputHelp()
  process.exit(1)
}
const link = Link.of(args.args[0])

loadAndDecompress(dagApi.get)(link)
  .then(columns1 => {
    const rows = ColumnMap.toArray(columns1)
    const text = compact ? JSON.stringify(rows) : JSON.stringify(rows, undefined, 2)
    console.log(text)
  })
  .catch(error => {
    console.error('', error)
    process.exit(4)
  })
