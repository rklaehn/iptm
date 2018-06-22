// tslint:disable:no-expression-statement
import * as cbor from 'borc'

const decoder = new cbor.Decoder({ size: 10000000 })

export const toCbor = (data: any): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    try {
      resolve(cbor.Encoder.encode(data))
    } catch (e) {
      reject(e)
    }
  })

export const fromCbor = (buffer: Buffer): Promise<any> =>
  new Promise((resolve, reject) => {
    try {
      resolve(decoder.decodeFirst(buffer))
    } catch (e) {
      reject(e)
    }
  })
