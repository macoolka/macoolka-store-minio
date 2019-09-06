---
title: index.ts
nav_order: 1
parent: Modules
---

# Overview

MonadFileStore Instance for minio

---

<h2 class="text-delta">Table of contents</h2>

- [Options (type alias)](#options-type-alias)
- [StoreClient (type alias)](#storeclient-type-alias)
- [buildStore (function)](#buildstore-function)

---

# Options (type alias)

**Signature**

```ts
export type Options = MinioClientOptions
```

Added in v0.2.0

# StoreClient (type alias)

**Signature**

```ts
export type StoreClient = MinioClient & { region?: string }
```

Added in v0.2.0

# buildStore (function)

build a MonadFileStore with a minio option

**Signature**

```ts

export const buildStore = (o: Options): MonadFileStore & PresignedUrl => ...

```

**Example**

```ts
import * as path from 'path'
import buildStore from 'macoolka-store-minio'
const store = buildStore({
  endPoint: 'macoolka.com',
  port: 9000,
  useSSL: false,
  accessKey: 'macoolka',
  secretKey: 'macoolka'
})
```

Added in v0.2.0
