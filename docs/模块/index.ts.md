---
title: index.ts
nav_order: 1
parent: 模块
---

# 概述

MonadFileStore Instance for minio

---

<h2 class="text-delta">目录</h2>

- [Options (类型)](#options-%E7%B1%BB%E5%9E%8B)
- [StoreClient (类型)](#storeclient-%E7%B1%BB%E5%9E%8B)
- [buildStore (函数)](#buildstore-%E5%87%BD%E6%95%B0)

---

# Options (类型)

**签名**

```ts
export type Options = MinioClientOptions
```

v0.2.0 中添加

# StoreClient (类型)

**签名**

```ts
export type StoreClient = MinioClient & { region?: string }
```

v0.2.0 中添加

# buildStore (函数)

根据 minio 选项建立 MonadFileStore

**签名**

```ts

export const buildStore = (o: Options): MonadFileStore & PresignedUrl => ...

```

**示例**

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

v0.2.0 中添加
