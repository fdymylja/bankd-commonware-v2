/**
 * React Query provider for the mobile app.
 * Configures a QueryClient with sensible defaults for mobile.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile: slightly longer stale times to reduce network usage
      staleTime: 10_000,
      // Retry once on failure
      retry: 1,
      retryDelay: 1_000,
      // Don't refetch on window focus (mobile has AppState instead)
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Get the global QueryClient instance.
 * Useful for imperative cache invalidation outside of React.
 */
export function getQueryClient(): QueryClient {
  return queryClient
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    // Type assertion needed: monorepo has both @types/react@18 and @19,
    // QueryClientProvider resolves to @18's ReactNode while Expo uses @19.
    <QueryClientProvider client={queryClient}>
      {children as any}
    </QueryClientProvider>
  )
}
