/**
 * MonadFileStore Instance for minio
 * @file
 */
import { Client as MinioClient, ClientOptions as MinioClientOptions, BucketItem } from 'minio';
import { MonadFileStore, PresignedUrl, monadFileStore, containerNotExist } from 'macoolka-store-core';
import { get, pick } from 'macoolka-object';
import { FileQueryData, FileData } from 'macoolka-store-core';
import { pipe } from 'fp-ts/lib/pipeable';
import * as TE from 'fp-ts/lib/TaskEither';
import * as E from 'fp-ts/lib/Either';
import * as T from 'fp-ts/lib/Task';
import * as MN from 'macoolka-app/lib/MonadNode';
import { foldPath } from 'macoolka-fs';
import { Stream } from 'stream';
import { compareString } from 'macoolka-compare';
import * as path from 'path';
import { parallel } from 'macoolka-app/lib/MonadNode';
import { notEmpty } from 'macoolka-predicate';
export type StoreClient = MinioClient & { region?: string };
export type Options = MinioClientOptions;

const makeStore = (client: StoreClient): MonadFileStore & PresignedUrl => {
    const getFilePath = ({ name, folders = [] }: {
        name: string;
        folders?: Array<string>;
    }): string => {
        return foldPath([...folders, name].filter(notEmpty));
    };
    const createContainer: MonadFileStore['createContainer'] = (container) => {

        const region = get(client, 'region');
        return pipe(
            async () => client.makeBucket(container.name, region ? region : ''),
            T.map(() => container),
            MN.fromTask
        );
    };
    const deleteContainer: MonadFileStore['deleteContainer'] = ({ name }) => {
        return pipe(
            async () => client.removeBucket(name),
            MN.fromTask

        );

    };
    const existContainer: MonadFileStore['existContainer'] = ({ name }) => {
        return pipe(
            async () => client.bucketExists(name),
            T.map(result => {
                return !!result;
            }),
            MN.fromTask

        );
    };
    const updateContainer: MonadFileStore['updateContainer'] = (container) => {
        return pipe(
            existContainer(container.where),
            TE.chain(r => {
                return r ? deleteContainer(container.where) : TE.rightIO(() => void 0);
            }),
            TE.chain(() => createContainer(container.data))
        );

    };
    const containers: MonadFileStore['containers'] = () => {
        return pipe(
            async () => client.listBuckets(),
            T.map(result => {
                return result.map(el => ({ name: (el && el.name) || '' }));
            }),
            MN.fromTask
        );
    };
    const container: MonadFileStore['container'] = a => {
        return pipe(
            existContainer(a),
            TE.chain(result => {
                return result ? TE.right(a) : TE.left(containerNotExist(a.name));
            })
        );
    };
    const createFile: MonadFileStore['createFile'] = (createFileInput) => {
        return pipe(
            async () => client.putObject(
                createFileInput.container,
                getFilePath(createFileInput),
                createFileInput.data),
                MN.fromTask,
            TE.chain(() => file(createFileInput))
        );

    };
    const deleteFile: MonadFileStore['deleteFile'] = (file) => {

        return pipe(
            async () => {
               return client.removeObject(file.container, getFilePath(file));

            },
            MN.fromTask
        );

    };
    const updateFile: MonadFileStore['updateFile'] = (updateWhere) => {
        const { data } = updateWhere.data;
        const source = getFilePath(updateWhere.where);
        const path = getFilePath(updateWhere.data);
        const isSamePath = source === path && updateWhere.data.container === updateWhere.where.container;
        const newPath = { ...updateWhere.where, ...updateWhere.data };
        return data
            ? pipe(
                createFile({ ...newPath, data }),
                TE.chain(result =>
                    isSamePath
                        ? TE.right(result)
                        : pipe(
                            deleteFile(updateWhere.where),
                            TE.map(_ => result)
                        )
                )

            ) : isSamePath
                ? file(updateWhere.where)
                : pipe(
                    fileStream(updateWhere.where),
                    TE.chain(data => createFile({ ...newPath, data })),
                    TE.chain(_ => deleteFile(updateWhere.where)),
                    TE.chain(_ => file(newPath))

                );

    };

    const fileStream: MonadFileStore['fileStream'] = (file) => {
        return pipe(
            async () => client.getObject(file.container, getFilePath(file)),
            MN.fromTask
        );

    };
    const existFile: MonadFileStore['existFile'] = (a) => {
        return pipe(
            file(a),

            T.chain(a => async () => E.isLeft(a) ? E.right(false) : E.right(true))

        );

    };

    const file: MonadFileStore['file'] = (file) => {
        return pipe(
            async () => client.statObject(file.container, getFilePath(file)),
            T.map(a => ({ ...pick(file, ['name', 'container', 'folders']), size: a.size, lastModified: a.lastModified.toISOString() })),
            MN.fromTask
        );

    };
    const dataStreamToTask = <A>(stream: Stream, f: (a: A) => void) => new Promise((resolve, reject) => {
        stream.on('data', (obj: A) => {
            f(obj);
        });
        stream.on('error', (err) => {
            reject(err);
        });
        stream.on('end', () => {
            resolve();
        });
    });
    const glob: MonadFileStore['glob'] = ({ container, folders = [], pattern }) => {

        const list: FileQueryData[] = [];

        const add = ({ name, lastModified, size }: BucketItem) => {
            if (compareString.pattern(pattern)(name)) {

                const resultFile = path.parse(name);
                list.push({
                    container: container,
                    folders: [...resultFile.dir.split('/')],
                    name: resultFile.base,
                    size,
                    lastModified: lastModified.toISOString(),
                });

            }

        };

        return pipe(
            async () => dataStreamToTask(client.listObjectsV2(container, foldPath(folders), true), add),
            MN.fromTask,
            TE.map(() => list
            )
        );

    };
    const folders: MonadFileStore['folders'] = ({ container, folders = [] }) => {
        const _prefix = getFilePath({ folders, name: '' });
        const rootPrefix = notEmpty(_prefix)
        ? _prefix + '/' : undefined;
        const stream = client.listObjectsV2(container, rootPrefix, false);
        const list: FileData[] = [];
        const f: string[] = [];
        const add = ({ name, lastModified, prefix, size }: BucketItem) => {
            if (name && lastModified) {
                const resultFile = path.parse(name);
                list.push({
                    container: container,
                    folders: [...folders, ...resultFile.dir],
                    name: resultFile.base,
                    size,
                    lastModified: lastModified.toISOString(),
                });
            } else {
                const _resultPrefix = prefix.endsWith(path.sep) ? prefix.substring(0, prefix.length - 1) : prefix;
                const resultPrefix = rootPrefix ? _resultPrefix.slice(rootPrefix.length) : _resultPrefix;
                f.push(resultPrefix);
            }
        };
        return pipe(
            async () => dataStreamToTask(stream, add),
            MN.fromTask,
            TE.map(() => ({ files: list, folders: f }))
        );

    };
    const clearFolder: MonadFileStore['clearFolder'] = (file) => {
        return pipe(
            glob({container: file.container, folders: file.folders, pattern: '**/*'}),
            TE.chain(a => pipe(
                a.map(deleteFile),
                parallel
            )),
            TE.map(_ => void 0)
        );

    };
    const presignedGetUrl: PresignedUrl['presignedGetUrl'] = (a) => {
        return pipe(
            async () =>
                client.presignedGetObject(
                    a.container,
                    getFilePath(a),
                    a.ttl ? a.ttl : 86400
                ),
                MN.fromTask
        );
    };

    const presignedPutUrl: PresignedUrl['presignedGetUrl'] = (a) => {
        return pipe(
            async () =>
                client.presignedPutObject(
                    a.container,
                    getFilePath(a),
                    a.ttl ? a.ttl : 86400
                ),
                MN.fromTask
        );

    };
    return {
        presignedGetUrl,
        presignedPutUrl,
        ...monadFileStore({
            createContainer,
            updateContainer,
            deleteContainer,
            container,
            containers,
            existContainer,
            clearFolder,
            createFile,
            deleteFile,
            updateFile,
            file,
            fileStream,
            glob,
            existFile,

            folders,
        }),
    };
};
/**
 * build a MonadFileStore with a minio option
 * @desczh
 * 根据minio选项建立MonadFileStore
 * @example
 * import * as path from 'path';
 * import buildStore from 'macoolka-store-minio'
 * const store = buildStore({
 *    endPoint: 'macoolka.com',
 *    port: 9000,
 *    useSSL: false,
 *    accessKey: 'macoolka',
 *    secretKey: 'macoolka'
 * })
 * @since 0.2.0
 *
 */
const buildStore = (o: Options): MonadFileStore & PresignedUrl => {
    const client: StoreClient = new MinioClient(o);
    client.region = o.region;
    return makeStore(client);
};

export default buildStore;
