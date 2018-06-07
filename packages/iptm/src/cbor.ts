// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array
// tslint:disable:array-type no-delete no-let no-console
import * as dagCBOR from 'ipld-dag-cbor'
import { log } from './log'

export const toCbor = (data: any): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    dagCBOR.util.serialize(data, (err: any, serialized: Buffer) => {
      if (err !== null) {
        log.cbor.error('toCbor', data, err)
        reject(err)
      } else {
        // log.cbor.info('toCbor', data, serialized.toString('hex'))
        resolve(serialized)
      }
    })
  })

export const fromCbor = (buffer: Buffer): Promise<any> =>
  new Promise((resolve, reject) => {
    dagCBOR.util.deserialize(buffer, (err: any, dagObject: any) => {
      if (err !== null) {
        log.cbor.error('fromCbor', buffer.toString('hex'), err)
        reject(err)
      } else {
        // log.cbor.info('fromCbor', buffer.toString('hex'), dagObject)
        resolve(dagObject)
      }
    })
  })
