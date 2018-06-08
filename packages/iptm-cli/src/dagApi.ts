// #region impl
// tslint:disable
// tslint:enable prettier
const mkBody: (data: any) => FormData = data => {
  const FormData = require('form-data')
  const form = new FormData()
  form.append('file', new Buffer(JSON.stringify(data)))
  return form
}

const ga: any = global
ga.fetch = require('node-fetch')

const dagPut = (base: string) => <T>(obj: T): Promise<Link<T>> => {
  const body = mkBody(obj)
  const options = { method: 'POST', body }
  return fetch(`${base}/api/v0/dag/put`, options)
    .then(response => (response.ok ? response : Promise.reject<Response>('')))
    .then(x => x.json())
    .then(x => x.Cid)
}

const dagGet = (base: string) => <T>(link: Link<T>): Promise<T> =>
  fetch(`${base}/api/v0/dag/get?arg=${link['/']}`)
    .then(response => (response.ok ? response : Promise.reject<Response>('')))
    .then(x => x.json())

const mkDagApi = (ipfsApi: string | undefined): DagApi => {
  const base = ipfsApi || 'http://localhost:5001'
  return {
    get: dagGet(base),
    put: dagPut(base),
  }
}
// #endregion
export type Link<T> = { ['/']: string }
export const Link = {
  of: (cid: string) => ({ ['/']: cid }),
}
export type DagPut = <T>(obj: T) => Promise<Link<T>>
export type DagGet = <T>(link: Link<T>) => Promise<T>
export type DagApi = Readonly<{
  get: DagGet
  put: DagPut
}>
export const DagApi = {
  of: mkDagApi,
}
