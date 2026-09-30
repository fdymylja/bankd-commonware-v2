import { rewriteShielddQueryUrl as rewrite, shielddQueryUrl, wrapShielddTransaction } from '@bankd/shieldd-web'

import { penumbraConfig } from '@/lib/config'
export { wrapShielddTransaction }
export const embeddedShielddQueryUrl = shielddQueryUrl
export const rewriteShielddQueryUrl = (url: string) => rewrite(url, penumbraConfig.grpcUrl)

type FetchScope = typeof globalThis & { __bankdEmbeddedShielddFetchInstalled?: boolean }
export function installEmbeddedShielddQueryRouting(): void {
  if (typeof window === 'undefined') return
  const scope = globalThis as FetchScope
  if (scope.__bankdEmbeddedShielddFetchInstalled) return
  const nativeFetch = scope.fetch.bind(scope)
  scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const rewritten = rewriteShielddQueryUrl(url)
    if (typeof input === 'string' || input instanceof URL) return nativeFetch(rewritten, init)
    return nativeFetch(new Request(new URL(rewritten, window.location.origin), input), init)
  }) as typeof fetch
  scope.__bankdEmbeddedShielddFetchInstalled = true
}
