// tslint:disable:no-if-statement no-expression-statement
import * as dagCBOR from 'ipld-dag-cbor'

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
    dagCBOR.util.deserialize(buffer, (err: any, dagObject: any) => {
      if (err !== null) {
        reject(err)
      } else {
        resolve(dagObject)
      }
    })
  })
