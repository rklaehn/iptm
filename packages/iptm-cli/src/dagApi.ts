export type DagPut = <T>(obj: T) => Promise<Link<T>>
export type DagGet = <T>(link: Link<T>) => Promise<T>
export type Link<T> = { ['/']: string }
export const Link = {
  of: (cid: string) => ({ ['/']: cid }),
}
// tslint:disable:no-if-statement no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-console no-floating-promises no-object-mutation no-let no-var-requires
const mkBody: (data: any) => FormData = data => {
  const FormData = require('form-data')
  const form = new FormData()
  form.append('file', new Buffer(JSON.stringify(data)))
  return form
}

const ga: any = global
ga.fetch = require('node-fetch')

const dagGetCid = (cid: string): Promise<any> =>
  fetch(`http://localhost:5001/api/v0/dag/get?arg=${cid}`)
    .then(response => (response.ok ? response : Promise.reject<Response>('')))
    .then(x => x.json())

export const dagPut: DagPut = <T>(obj: T): Promise<Link<T>> => {
  const body = mkBody(obj)
  const options = { method: 'POST', body }
  return fetch('http://localhost:5001/api/v0/dag/put', options)
    .then(response => (response.ok ? response : Promise.reject<Response>('')))
    .then(x => x.json())
    .then(x => x.Cid)
}

export const dagGet: DagGet = <T>(link: Link<T>): Promise<T> => dagGetCid(link['/'])
