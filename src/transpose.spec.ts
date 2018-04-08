// tslint:disable:no-if-statement no-object-mutation no-expression-statement no-shadowed-variable readonly-array array-type no-delete no-let
import * as fs from 'fs'
import * as dagCBOR from 'ipld-dag-cbor'
import * as shajs from 'sha.js'
import * as zlib from 'zlib'

export type Cid = string
// @ts-ignore
export type Link<T> = { ['/']: Cid }
type ColumnMap<T> = {
  indices?: ReadonlyArray<number>
  values?: ReadonlyArray<T>
  children?: { [key: string]: ColumnMap<T> }
}
type ColumnMapImpl<T> = {
  indices: Array<number>
  values: Array<T>
  children: { [key: string]: ColumnMapImpl<T> }
}
const stripInPlace = <T>(store: ColumnMapImpl<T>): ColumnMap<T> => {
  if (store.values.length !== store.indices.length) {
    throw new Error()
  }
  if (store.values.length === 0) {
    delete store.values
    delete store.indices
  }
  const children = Object.values(store.children)
  if (children.length === 0) {
    delete store.children
  } else {
    children.forEach(stripInPlace)
  }
  return store
}
const getCompressedSize = async (m: ColumnMap<any>): Promise<number> => {
  let result = 0
  if (m.indices !== undefined && m.values !== undefined) {
    // enable delta compression for indices
    result += await DagArray.getCompressedSize(m.indices, { forceDelta: true })
    // let the compressor figure out if delta compression makes sense
    result += await DagArray.getCompressedSize(m.values)
  }
  if (m.children !== undefined) {
    for (const child of Object.values(m.children)) {
      result += await getCompressedSize(child)
    }
  }
  return result
}
const sha1 = (buffer: Buffer): string => {
  return shajs('sha1')
    .update(buffer.toString('hex'))
    .digest('hex')
}
const getBufferForSizing = (x: DagArray): Promise<Buffer> => {
  if (Array.isArray(x)) {
    return toCbor(x)
  } else {
    const ca = x as CompressedArray
    // not exactly accurate, since we would have to add the
    // compression type and reference in case of delta compression.
    // also, we assume that cbor dag will store a buffer without overhead
    // (no base64 or anything)
    return Promise.resolve(ca.d)
  }
}
const compressedSizeDedupImpl = async (
  m: ColumnMap<any>,
  sizes: { [key: string]: number },
): Promise<{ [key: string]: number }> => {
  if (m.indices !== undefined && m.values !== undefined) {
    // enable delta compression for indices
    const indices = await DagArray.compress(m.indices, { forceDelta: true })
    const values = await DagArray.compress(m.values)
    const ib = await getBufferForSizing(indices)
    const vb = await getBufferForSizing(values)
    sizes[sha1(ib)] = ib.length
    sizes[sha1(vb)] = vb.length
  }
  if (m.children !== undefined) {
    for (const child of Object.values(m.children)) {
      await compressedSizeDedupImpl(child, sizes)
    }
  }
  return sizes
}
const getCompressedSizesDedup = (m: ColumnMap<any>): Promise<number> =>
  compressedSizeDedupImpl(m, {}).then(sizes => {
    console.log(sizes)
    return Object.values(sizes).reduce((x, y) => x + y, 0)
  })

const ColumnMap = {
  compressedSize: getCompressedSize,
  compressedSizeDedup: getCompressedSizesDedup,
}
const ColumnMapImpl = {
  /**
   * Creates a new empty column map.
   * We are using mutability, so everything needs to be fresh.
   */
  empty: <T>(): ColumnMapImpl<T> => ({
    indices: [],
    values: [],
    children: {},
  }),
  /**
   * Strips unused fields in place and returns the thing as a ColumnStore, never
   * to be mutated again
   */
  build: stripInPlace,
}

const getOrCreateInPlace = <T>(store: ColumnMapImpl<T>, key: string): ColumnMapImpl<T> => {
  const result = store.children[key]
  if (result !== undefined) {
    return result
  } else {
    const child = ColumnMapImpl.empty<T>()
    store.children[key] = child
    return child
  }
}

const isPrimitive = (key: any): boolean => {
  if (key === null) {
    return true
  }
  const type = typeof key
  if (type === 'function') {
    throw new Error('What do you think this is? unisonweb.org?')
  }
  if (type === 'object') {
    return false
  }
  return true
}

const updateInPlace = (obj: any, path: ReadonlyArray<string>, from: number, value: any): any => {
  if (from === path.length) {
    // at the end, just return the value and let the caller deal with storing it
    return value
  } else {
    const key = path[from]
    const child = obj[key]
    const childExists = child !== undefined
    const child1 = childExists ? child : {}
    const child2 = updateInPlace(child1, path, from + 1, value)
    // if the column store is canonical, I will never overwrite a scalar value,
    // and the from === path.length - 1 test is not necessary. But let's accept
    // non-canonical formats as well
    const mustUpdate = from === path.length - 1 || !childExists
    if (mustUpdate) {
      obj[key] = child2
    }
    return obj
  }
}

const fromColumnMap = <T>(columns: ColumnMap<T>): ReadonlyArray<T> => {
  const rows: any = {}
  // first position is placeholder for the current index
  const path: Array<any> = [undefined]
  const addToRows = (store: ColumnMap<T>): void => {
    if (store.values !== undefined && store.indices !== undefined) {
      const indices = store.indices
      const values = store.values
      if (values.length !== indices.length) {
        throw new Error()
      }
      for (let i = 0; i < store.values.length; i++) {
        const index = indices[i]
        const value = values[i]
        path[0] = index
        updateInPlace(rows, path, 0, value)
      }
    }
    if (store.children !== undefined) {
      const children = store.children
      Object.entries(children).forEach(([key, childStore]) => {
        path.push(key)
        addToRows(childStore)
        path.pop()
      })
    }
  }
  addToRows(columns)
  return Object.values(rows)
}

const log = {
  compress: {
    info: console.log,
    error: console.error,
  },
  cbor: {
    info: console.log,
    error: console.error,
  },
}

const toColumnMap = <T>(rows: ReadonlyArray<T>): ColumnMap<T> => {
  const rootStore: ColumnMapImpl<T> = ColumnMapImpl.empty()
  const addToValuesAndIndices = (store: ColumnMapImpl<any>, obj: any, index: number): void => {
    if (isPrimitive(obj)) {
      store.indices.push(index)
      store.values.push(obj)
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        const childStore = getOrCreateInPlace(store, key)
        addToValuesAndIndices(childStore, value, index)
      })
    }
  }
  rows.forEach((row, index) => {
    addToValuesAndIndices(rootStore, row, index)
  })
  return ColumnMapImpl.build<T>(rootStore)
}

const asInt32Array = (xs: ReadonlyArray<any>): ReadonlyArray<Int32> | undefined =>
  xs.every(isInt32) ? (xs as ReadonlyArray<Int32>) : undefined
const isInt32 = (x: any): boolean =>
  Number.isSafeInteger(x) && x >= Int32.minValue && x <= Int32.maxValue
const maybeInt32 = (x: any): Int32 | undefined => (isInt32(x) ? (x as Int32) : undefined)
const enum Int32Tag {}
type Int32 = number & Int32Tag
const Int32 = {
  minValue: -2147483648 as Int32,
  maxValue: 2147483647 as Int32,
  zero: 0 as Int32,
  maybe: maybeInt32,
  is: isInt32,
  maybeArray: asInt32Array,
}
const toCbor = (data: any): Promise<Buffer> =>
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

const fromCbor = (buffer: Buffer): Promise<any> =>
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

type CompressionOptions = {
  forceDelta: boolean
}
const toDelta = (xs: ReadonlyArray<number>): ReadonlyArray<number> => {
  if (xs.length === 0) {
    throw new Error()
  }
  const result = xs.slice(1)
  for (let i = 0; i < result.length; i++) {
    result[i] = xs[i + 1] - xs[i]
  }
  return result
}
const fromDelta = (reference: number, ds: ReadonlyArray<number>): ReadonlyArray<number> => {
  const xs = [reference, ...ds]
  let curr = reference
  for (let i = 1; i < xs.length; i++) {
    curr += xs[i]
    xs[i] = curr
  }
  return xs
}
const deflate = (b: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.deflateRaw(b, (err, buffer) => {
      if (err !== null) {
        log.compress.error('deflate', b.toString('hex'), err)
        reject(err)
      } else {
        // log.compress.info('deflate', b.toString('hex'), buffer.toString('hex'))
        resolve(buffer)
      }
    })
  })
const inflate = (b: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.inflateRaw(b, (err, buffer) => {
      if (err !== null) {
        log.compress.error('inflate', b.toString('hex'), err)
        reject(err)
      } else {
        // log.compress.info('inflate', b.toString('hex'), buffer.toString('hex'))
        resolve(buffer)
      }
    })
  })

type CompressResult = {
  type: 'uncompressed' | 'deflate' | 'delta-deflate'
  size: number
  dag: DagArray
}
const uncompressed = (xs: ReadonlyArray<any>) =>
  // convert to cbor to check uncompressed size, even though
  // we will not use the cbor
  toCbor(xs).then<CompressResult>(buffer => ({
    type: 'uncompressed',
    size: buffer.length,
    dag: xs,
  }))
const compressed = (xs: ReadonlyArray<any>) =>
  toCbor(xs)
    .then(deflate)
    .then<CompressResult>(buffer => ({
      type: "deflate",
      size: buffer.length,
      dag: {
        c: "deflate",
        d: buffer
      }
    }));
const deltaCompressed = (ns: ReadonlyArray<number>): Promise<CompressResult> =>
  toCbor(toDelta(ns))
    .then(deflate)
    .then<CompressResult>(buffer => ({
      type: "delta-deflate",
      size: buffer.length,
      dag: {
        c: "deflate",
        r: ns[0],
        d: buffer
      }
    }));

const compare = (x: number, y: number): number => (x < y ? -1 : x > y ? 1 : 0);

const compressAllOptions = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions
): Promise<ReadonlyArray<CompressResult>> => {
  const forceDelta = (options && options.forceDelta) || false;
  if (xs.length <= 8) {
    return uncompressed(xs).then(x => [x]);
  }
  const ns = asInt32Array(xs);
  const uncompressedResult = uncompressed(xs);
  const variants = ns
    ? forceDelta
      ? [uncompressedResult, deltaCompressed(xs)]
      : [uncompressedResult, compressed(xs), deltaCompressed(xs)]
    : [uncompressedResult, compressed(xs)];
  return Promise.all(variants).then(results =>
    results.sort((x, y) => compare(x.size, y.size))
  );
};

type CompressionInfo = Readonly<{
  size: number;
  type: string;
}>;
const getCompressionInfo = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions
): Promise<ReadonlyArray<CompressionInfo>> =>
  compressAllOptions(xs, options).then(rs =>
    rs.map(r => ({ size: r.size, type: r.type }))
  );

const getCompressedSizeA = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions
): Promise<number> => getCompressionInfo(xs, options).then(x => x[0].size);

const compressBestOption = (
  xs: ReadonlyArray<any>,
  options?: CompressionOptions
): Promise<DagArray> => compressAllOptions(xs, options).then(xs => xs[0].dag);

const arrayFromCbor = (buffer: Buffer) =>
  fromCbor(buffer).then(
    dag =>
      Array.isArray(dag) ? Promise.resolve(dag) : Promise.reject("not an array")
  );

const decompressDagArray = (x: DagArray): Promise<ReadonlyArray<any>> => {
  if (Array.isArray(x)) {
    return Promise.resolve(x);
  } else {
    const { c: compression, r: reference, d: data } = x as CompressedArray;
    switch (compression) {
      case "deflate": {
        if (reference === undefined) {
          return inflate(data).then(inflated => arrayFromCbor(inflated));
        } else {
          return inflate(data)
            .then(arrayFromCbor)
            .then(xs => {
              const ds = asInt32Array(xs);
              return ds === undefined
                ? Promise.reject("not a number array")
                : Promise.resolve(fromDelta(reference, ds));
            });
        }
      }
      default:
        throw new Error(`unsupported compression ${compression}`);
    }
  }
};

type CompressionType = "deflate";
type CompressedArray = {
  c: CompressionType; // compression type
  r?: number; // reference value for delta compression
  d: Buffer; // or base64 encoded string?
};
type DagArray = ReadonlyArray<any> | CompressedArray;
const DagArray = {
  compress: compressBestOption,
  decompress: decompressDagArray,
  getCompressionInfo,
  getCompressedSize: getCompressedSizeA
};

describe("toDelta/fromDelta", () => {
  const roundtrip = (xs: Array<number>) => fromDelta(xs[0], toDelta(xs));
  it("should fail on empty array", () => {
    expect(() => toDelta([])).toThrow();
  });

  it("should be reversible for any numeric array not containing NaN", () => {
    const xs = [1, 2, 3, 4];
    expect(roundtrip(xs)).toEqual(xs);
  });
});

describe("DagArray", () => {
  const smallArray = ["a", "b", "c"];
  // deflate will even get some compression from random doubles,
  // so the array needs to be small
  const smallRandom = Array.from({ length: 9 }, () => Math.random());
  const compressibleStrings = Array.from(
    { length: 128 },
    (_, x) => `number${x}`
  );
  const compressibleStringsSmall = Array.from(
    { length: 9 },
    (_, x) => `number${x}`
  );
  const increasingSmallIntegers = Array.from({ length: 128 }, (_, x) => x);
  const roundtrip = (data: ReadonlyArray<any>): Promise<ReadonlyArray<any>> =>
    DagArray.compress(data).then(DagArray.decompress);
  describe("compress", () => {
    it("should not attempt to compress very small arrays", () =>
      expect(
        compressAllOptions(smallArray).then(_ => _.map(_ => _.type))
      ).resolves.toEqual(["uncompressed"]));

    it("should not compress if the data is random", () =>
      expect(
        compressAllOptions(smallRandom)
          .then(x => x.map(y => y.type))
          .then(x => x[0])
      ).resolves.toEqual("uncompressed"));

    it("should compress if the data is strings that contain some redundancy", () =>
      expect(
        compressAllOptions(compressibleStrings)
          .then(_ => _.map(_ => _.type))
          .then(x => x[0])
      ).resolves.toEqual("deflate"));

    it("should delta-compress if the data is numbers that are ascending", () =>
      expect(
        compressAllOptions(increasingSmallIntegers)
          .then(_ => _.map(_ => _.type))
          .then(x => x[0])
      ).resolves.toEqual("delta-deflate"));

    it("should not attempt non-delta compression if the forceDelta option is set", () =>
      expect(
        compressAllOptions(increasingSmallIntegers, { forceDelta: true }).then(
          _ => _.map(_ => _.type)
        )
      ).resolves.toEqual(["delta-deflate", "uncompressed"]));
  });

  describe("decompress", () => {
    it("should work for various cases", () => {
      const cases = [
        smallArray, // too small to be considered for compression
        smallRandom, // will not be compressed because it is not worth it
        compressibleStringsSmall, // small example that will be compressed
        compressibleStrings, // larger example
        increasingSmallIntegers // will use delta compression
      ];
      return expect(Promise.all(cases.map(roundtrip))).resolves.toEqual(cases);
    });
  });
});

const roundtrip = <T>(rows: ReadonlyArray<T>): ReadonlyArray<T> =>
  fromColumnMap(toColumnMap(rows));
describe("toColumnMap/fromColumnMap", () => {
  it("should work for normal time series data", () => {
    const rows = [{ x: 1, y: 2 }, { x: 2, y: 1 }];

    expect(toColumnMap(rows)).toMatchSnapshot();
    expect(roundtrip(rows)).toEqual(rows);
  });

  it("should properly deal with missing values", () => {
    const rows = [{ y: 2 }, { x: 2 }];

    expect(toColumnMap(rows)).toMatchSnapshot();
    expect(roundtrip(rows)).toEqual(rows);
  });

  it("should properly deal with nested objects", () => {
    const rows = [
      { type: "start", data: { timestamp: 1 } },
      { type: "stop", data: { reason: "because" } }
    ];

    expect(toColumnMap(rows)).toMatchSnapshot();
    expect(roundtrip(rows)).toEqual(rows);
  });

  it("should properly deal with weird javascript crap", () => {
    const rows = [
      // unusual values as values
      {
        x: undefined,
        y: null,
        z: true,
        w: false,
        a: 1.0,
        b: NaN,
        c: Infinity,
        d: -Infinity
      },
      // unusual values as keys
      { true: 1, false: 0, 1: 0, 0: 1, undefined: false, null: 1 }
    ];
    expect(toColumnMap(rows)).toMatchSnapshot();
    expect(roundtrip(rows)).toEqual(rows);
  });
});

const rand = (n: number): number => {
  if (n <= 0 || !Number.isSafeInteger(n)) {
    throw new Error();
  }
  return Math.floor(Math.random() * n);
};

const createSample = (_: any, i: number) => ({
  semantics: "someFish", // constant
  name: "fish1", // constant
  sourceId: "asafjsiodfuhgildkh", // constant
  sequence: i + 1, // regular => constant
  timestamp: i * 1000 + rand(16), // 4 bits
  payload: {
    type: "sample", // constant
    value: rand(16), // 4 bits
    status: rand(2) === 0 // 1 bit
  }
});
const sampleBits = 9;

describe("overall compression", () => {
  const n = 100000;
  const rows = Array.from({ length: n }, createSample);
  it("should be reversible", () => {
    expect(roundtrip(rows)).toEqual(rows);
  });
  it(
    "should compress well",
    () => {
      console.log(rows.slice(0, 100));
      const columns = toColumnMap(rows);
      console.log(columns);
      const text = JSON.stringify(rows);
      const compressed = deflate(new Buffer(text)).then(x => x.length);
      const colSize = ColumnMap.compressedSize(columns);
      const colSizeDedup = ColumnMap.compressedSizeDedup(columns);
      const cbor = toCbor(rows).then(x => x.length);
      const cborDeflate = toCbor(rows)
        .then(deflate)
        .then(x => x.length);
      const ws = fs.createWriteStream("test.csv", { encoding: "utf8" });
      const write = (...args: any[]) => {
        args.forEach((arg, i) => {
          if (i > 0) {
            ws.write(" ");
          }
          if (arg === null) {
            ws.write("null");
          } else {
            ws.write(arg.toString());
          }
        });
        ws.write("\n");
      };
      return Promise.all([compressed, cbor, cborDeflate, colSize, colSizeDedup])
        .then(([compressed, cbor, cborDeflate, colSize, colSizeDedup]) => {
          write("JSON.stringify\t", text.length, "\t", text.length / n);
          write("CBOR\t", cbor, "\t", cbor / n);
          write(
            "JSON.stringify and deflate\t",
            compressed,
            "\t",
            compressed / n
          );
          write("CBOR and deflate\t", cborDeflate, "\t", cborDeflate / n);
          write("Compressed columns\t", colSize, "\t", colSize / n);
          write(
            "Compressed columns (dedup)\t",
            colSizeDedup,
            "\t",
            colSizeDedup / n
          );
          write(
            "Theoretical optimum\t",
            n * sampleBits / 8,
            "\t",
            sampleBits / 8
          );
        })
        .then(() => {
          ws.end();
        });
    },
    60000
  );
});
