
import testSuite from 'macoolka-store-core/lib/testSuite'
import of from '../'
import * as E from 'fp-ts/lib/Either'
import * as TE from 'fp-ts/lib/TaskEither'
import { pipe } from 'fp-ts/lib/pipeable'
import { join } from 'path'
// Execute the test suite
const option={
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'macoolka',
    secretKey: 'macoolka'
}
testSuite(of(option), { providerName: 'minio', largeSize: true, root: join(__dirname, 'files') })

// Add custom, provider-specific tests
describe('Provider-specific tests for minio', function () {
    it('invalid endpoint', function () {
        expect(() => {
            // Missing endPoint
            of({
                accessKey: option.accessKey,
                secretKey: option.secretKey
            } as any)
        }).toThrowError(/invalid endpoint/i)
    })
    it('getaddrinfo error', async () => {
        const errorStore = of({
            endPoint: 'localhost1',
            port: 9000,
            useSSL: false,
            accessKey: 'macoolka',
            secretKey: 'macoolka'
        })
        const a = await pipe(
            errorStore.createContainer({ name: 'error' }),
            TE.mapLeft(error => {
                expect(error({}).includes('getaddrinfo')).toEqual(true)
            })
        )()
        expect(E.isLeft(a)).toEqual(true)

    },1000*10)

})
