import { NextRequest } from 'next/server'

import { shielddFetch } from '@/lib/rpc/shieldd'

export const dynamic = 'force-dynamic'
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const body = new Uint8Array(await request.arrayBuffer())
    const isText = request.headers.get('content-type')?.includes('grpc-web-text')
    return await shielddFetch(params.path.join('/'), { headers: request.headers, body: isText ? new TextDecoder().decode(body) : body })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid query', { status: 400 })
  }
}
