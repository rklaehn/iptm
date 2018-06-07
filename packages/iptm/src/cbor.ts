// tslint:disable:no-if-statement no-expression-statement
import * as cbor from 'borc'
import * as dagCBOR from 'ipld-dag-cbor'

const decoder = new cbor.Decoder({ size: 10000000 })

export const toCbor = (data: any): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    dagCBOR.util.serialize(data, (err: any, serialized: Buffer) => {
      if (err !== null) {
        reject(err)
      } else {
        resolve(serialized)
      }
    })
  })

export const fromCbor = (buffer: Buffer): Promise<any> =>
  new Promise((resolve, reject) => {
    try {
      resolve(decoder.decodeFirst(buffer))
    } catch (e) {
      reject(e)
    }
  })
