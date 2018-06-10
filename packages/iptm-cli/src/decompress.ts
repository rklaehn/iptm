// tslint:disable
// tslint:enable prettier
import { ColumnMap } from 'iptm'
import { DagApi, Link } from './dagApi'
import { loadAndDecompress } from './encodeDecode'

type Options = Readonly<{
  api: string | undefined
  verbose: number
  compact: boolean
  hash: string
}>

export const decompress = (options: Options): void => {
  const { hash, compact, api } = options
  const link = Link.of(hash)
  const dagApi = DagApi.of(api)
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
}
