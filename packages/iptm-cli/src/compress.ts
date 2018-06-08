// tslint:disable
// tslint:enable prettier
import * as commander from 'commander'
import * as fs from 'fs'
import { ColumnMap } from 'iptm'
import { DagApi } from './dagApi'
import { compressAndStore } from './encodeDecode'

// copied from https://github.com/sindresorhus/get-stdin
const stdinToBuffer = (): Promise<Buffer> => {
  const { stdin } = process
  const ret: any[] = []
  let len = 0

  return new Promise(resolve => {
    if (stdin.isTTY) {
      console.log('interactive input not supported')
      args.outputHelp()
      process.exit(3)
    }

    stdin.on('readable', () => {
      let chunk

      while ((chunk = stdin.read())) {
        ret.push(chunk)
        len += chunk.length
      }
    })

    stdin.on('end', () => {
      resolve(Buffer.concat(ret, len))
    })
  })
}

const args = commander
  .description(
    'Compresses an arbitrary JSON array and stores it in IPFS.\n' +
      'File can be passed as an argument or via stdin',
  )
  .usage('compress [options] <json file>')
  .option('-v, --verbose', 'verbosity level', (_v, total) => total + 1, 0)
  .option(
    '--api <string>',
    'ipfs api to use. defaults to http://localhost:5001. No trailing slashes!',
  )
  .parse(process.argv)

const verbose = args.verbose || 0
const api: string | undefined = args.api
const dagApi = DagApi.of(api)

const bufferP =
  args.args.length === 0 ? stdinToBuffer() : Promise.resolve(fs.readFileSync(args.args[0]))

bufferP
  .then(buffer => {
    const text = buffer.toString('utf8')
    const json = JSON.parse(text)

    if (!Array.isArray(json)) {
      console.log('must be array!')
      process.exit(2)
    }

    const columns = ColumnMap.of(json)

    return compressAndStore(dagApi.put)(columns).then(result => {
      if (verbose > 0) {
        console.log('Input size      ', buffer.length)
        console.log('Compressed size ', result.stats.size)
        console.log('Ratio           ', (buffer.length / result.stats.size).toFixed(2))
        console.log('IPFS dag objects', result.stats.blocks)
      }
      console.log(result.link['/'])
    })
  })
  .catch(error => {
    console.error('', error)
    process.exit(4)
  })
