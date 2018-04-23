# Efficient machine telemetry compression

---

![](https://i.imgur.com/PGO3ijB.png)

---

# Current state

## Size of a local database

|          | Size     | Size/ev  |
| -------- | -------- | -------- |
| Postgres | 17301504 | 200.2    |
| SQLite   | 39976960 | 462.6    |
| IndexedDB| ~6000000 | 72.6     |

---

Storage for *25* machine integrations and 365 days:

`364_789_760_000` bytes.

---

# Can this be improved?

---

# Columnar storage

---

- [CitusData](https://www.citusdata.com/)

  Vanilla postgres with columnar storage engine, open source, hosted service

- [AWS redshift](https://docs.aws.amazon.com/redshift/latest/mgmt/welcome.html)

  Customized postgres with columnar storage, only hosted

- [SQL Server](https://blogs.msdn.microsoft.com/sqlserverstorageengine/2017/02/09/json-data-in-clustered-column-store-indexes/)

  "Clustered ColumnStore Indices"

---

# That's great, but...

![](https://i.imgur.com/4k9zhye.jpg)

---

# So let's roll our own

I mean, how hard can it be...?

---

# What do we want?

- schemaless
  (to avoid coupling of storage engine with application)
- good compression
- easy access for querying
- low memory requirements
  (to run on a raspberry pi)
- storage in IPFS
  (so we don't have to decompress to transfer)

---

# What *don't* we want?

- Complex querying
- Full SQL including joins etc.

---

# Future extensions

- Simple filtering should work well
- Columnar is actually pretty neat for analytics
- Use postgres with custom storage backend to query?

---

# Basic transpose

---

Array of records (uniform type)
```javascript
[
  { latitude: 1, longitude: 2 },
  { latitude: 0, longitude: 3 },
  { latitude: 1, longitude: 2 },
  { latitude: 0, longitude: 3 },
  { latitude: 1, longitude: 5 },
  { latitude: 2, longitude: 2 }
]
```

---

Record of arrays

```javascript
{
  latitude: [1, 0, 1, 0, 1, 2],
  longitude: [2, 3, 2, 3, 5, 2]
}
```

---

# Heterogenous types

---

Array of heterogenous records
```javascript
[
  { type: 'circle', r: 10 }
  { type: 'rectangle', w: 3, h: 4 },
  { type: 'rectangle', w: 10, h: 10 }
]
```

---

Record of arrays and indices
```javascript
{
  type: [[0,1,2], ['circle','rectangle','rectangle']],
  r: [[0],[10]],
  w: [[1,2],[3,10]],
  h: [[1,2],[4,10]]
}
```

---

# Nested structures

---

Array of nested records
```javascript
[
  { type: 'start', pos: { lat: 10, lon: 10 }},
  { type: 'pause', pos: 'na'},
  { type: 'stop', pos: { lat: 20, lon: 0 }}
]
```

---

```javascript
{
  children: {
    type: {
      values: [[0,1,2], ['start', 'pause', 'stop']]
    },
    pos: {
      values: [[1], ['na']],
      children: {
        lat: {
          values: [[0, 2], [10,20]]
        },
        lon: {
          values: [[0, 2], [10,0]]
        }
      }
    }
```

---

# CBOR encoding

- Converts JSON to RFC7049 [binary](https://tools.ietf.org/html/rfc7049)
- More compact encoding, especially for numbers, boolean etc.
- Helps *a little bit* for arrays of strings
- Just use [ipfs-dag-cbor](https://github.com/ipld/js-ipld-dag-cbor)

---

# Compression

---

- Our arrays contain uniform data
  ```javascript
  [0, 1, 2, 3, 4, 5]
  ```
  or
  ```javascript
  ['start', 'pause', 'resume', 'pause', 'resume', 'stop']
  ```
- For such data, general purpose compression should do a good job

---

# Enum compression
e.g. type field of events

---

Example event type field data (1000 random elements)

```javascript
['start', 'resume', 'pause', ..., 'stop']
```

---

## Results

| Compression | bytes | bytes/sample |
| -------- | -------- | -------- |
| JSON     | 8502     | 8.502    |
| CBOR     | 6507     | 6.507    |
| Deflate  | 323      | 0.323    |

---

# Sensor data compression

e.g. temperature fluctuating due to sensor noise

---

Example temperature data (1000 random elements)

```javascript
[
  293.046,
  293.054,    
  293.158,
  293.08,
  ...
  293.024
]
```

---

## Results

| Compression | bytes | bytes/sample |
| -------- | -------- | -------- |
| JSON     | 7772     | 7.772    |
| CBOR     | 8955     | 8.955    |
| Deflate  | 2254     | 2.254    |

---

# Timestamp sequence compression

---

# Delta encoding for linear sequences

- Even when binary encoded, linear sequences are bad to compress for general purpose compression algorithms like deflate/gzip.

- Idea: use delta encoding and see if it improves things

---

Works well for

- timestamp sequences

- index sequences

- counters

---

Array of timestamps

```javascript
[1523565937887,1523565938890,1523565939895,1523565940896,1523565941896]
```
becomes
```javascript
{
  reference: 1523565937887,
  deltas: [1003,1005,1001,1000]
}
```

---

## Results

| Compression | bytes | bytes/sample |
| -------- | -------- | -------- |
| JSON     | 14001    | 14.001   |
| CBOR     |  9003    |  9.003   |
| Deflate  |  3502    |  3.502   |
| Δ-Deflate  | 672    | 0.672    |

---

# Deduplication

- Index arrays compress well with Δ-Deflate
- But we can do even better
- Index arrays will be repeated for records of the same type
- IPFS will automatically dedup them
- Matters mostly with very heterogenous rows

---

# Putting it all together

- Compress 100000 machine data events
- About one day at 1 Hz

---

```javascript
[
  {
    semantics: 'someFish',
    name: 'fish1',
    sourceId: 'asafjsiodfuhgildkh',
    sequence: 1,
    timestamp: 13,
    payload: {
      type: 'sample',
      value: 14,
      status: true
    }
  },
  ... // *100000
]
```

---

|                | size     | size/ev         |
| -------------- | -------- | --------------- |
| JSON           | 16265164 |	 162.65164    |
| CBOR           | 12268523 |	 122.68523    |
| JSON/deflate	 | 870921   | 	 8.70921      |
| CBOR/deflate   | 923066   |         9.23066 |
| Columns/CBOR/deflate | 162721 |	  1.62721 |
| " + dedup      |	 161769 |	      1.61769 |
| Theoretical optimum | 112500 |	    1.125 |

---

![](https://i.imgur.com/egHO6hu.png)

---

![](https://i.imgur.com/uIK6vHM.png)

---

# So?

![](https://i.imgur.com/4k9zhye.jpg)

---

Storage for *25* machine integrations and *10* years:

`12_693_240_000` bytes.

![](https://i.imgur.com/Gf7sKsl.png)

