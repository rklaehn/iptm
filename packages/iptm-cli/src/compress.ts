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
  .option('-v, --verbose', 'logs compression statistics')
  .option(
    '--api <string>',
    'ipfs api to use. defaults to http://localhost:5001. No trailing slashes!',
  )
  .parse(process.argv)

const verbose: boolean = args.verbose || true
const api: string | undefined = args.api
const dagApi = DagApi.of(api)

const bufferP =
  args.args.length === 0 ? stdinToBuffer() : Promise.resolve(fs.readFileSync(args.args[0]))

bufferP.then(buffer => {
  const text = buffer.toString('utf8')
  const json = JSON.parse(text)

  if (!Array.isArray(json)) {
    console.log('must be array!')
    process.exit(2)
  }

  const columns = ColumnMap.of(json)

  return compressAndStore(dagApi.put)(columns).then(result => {
    if (verbose) {
      console.log('Input size      ', buffer.length)
      console.log('Compressed size ', result.stats.size)
      console.log('IPFS dag objects', result.stats.blocks)
    }
    console.log(result.link['/'])
  })
})
