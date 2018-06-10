// tslint:disable
// tslint:enable prettier
import * as fs from 'fs'
import { ColumnMap } from 'iptm'
import { DagApi } from './dagApi'
import { compressAndStore } from './encodeDecode'

// copied from https://github.com/sindresorhus/get-stdin
const stdinToBuffer = (abort: () => never): Promise<Buffer> => {
  const { stdin } = process
  const ret: any[] = []
  let len = 0

  return new Promise(resolve => {
    if (stdin.isTTY) {
      abort()
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

type Options = Readonly<{
  api: string | undefined
  verbose: number
  file: string | undefined
  abort: () => never
}>

export const compress = (options: Options) => {
  const { verbose, api, abort, file } = options
  const dagApi = DagApi.of(api)
  const bufferP = file === undefined ? stdinToBuffer(abort) : Promise.resolve(fs.readFileSync(file))

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
}
