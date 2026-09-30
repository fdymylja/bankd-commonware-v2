'use client'

import '@react-sigma/core/lib/style.css'

import {
  ControlsContainer,
  FullScreenControl,
  SigmaContainer,
  ZoomControl,
  useCamera,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
  useSigma,
} from '@react-sigma/core'
import { useLayoutCircular } from '@react-sigma/layout-circular'
import { useWorkerLayoutForceAtlas2 } from '@react-sigma/layout-forceatlas2'
import {
  DEFAULT_EDGE_CURVATURE,
  EdgeCurvedArrowProgram,
  indexParallelEdgesIndex,
} from '@sigma/edge-curve'
import { MultiDirectedGraph } from 'graphology'
import { circular } from 'graphology-layout'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { CircleDashed, Fullscreen, Waypoints } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EdgeArrowProgram } from 'sigma/rendering'
import type { NodeDisplayData } from 'sigma/types'
import { animateNodes } from 'sigma/utils'

type BankNetworkNodeKind = 'hub' | 'regional-bank' | 'shared-service'

type BankNetworkNode = {
  label: string
  subtitle: string
  kind: BankNetworkNodeKind
  region: string
  size: number
  color: string
  x: number
  y: number
}

type BankNetworkEdge = {
  label: string
  channel: string
  capability: 'IBC'
  size: number
  color: string
  type?: 'straight' | 'curved'
  curvature?: number
}

type NetworkNodeDefinition = Omit<BankNetworkNode, 'color'> & {
  id: string
}

type NetworkEdgeDefinition = Omit<BankNetworkEdge, 'size' | 'color'> & {
  id: string
  source: string
  target: string
}

const nodeColors: Record<BankNetworkNodeKind, string> = {
  hub: '#2563eb',
  'regional-bank': '#16a34a',
  'shared-service': '#0891b2',
}

const edgeColors: Record<BankNetworkEdge['capability'], string> = {
  IBC: '#2563eb',
}

const nodes: NetworkNodeDefinition[] = [
  {
    id: 'bcb-hub',
    label: 'Brazil Central Bank Hub',
    subtitle: 'Sovereign settlement hub',
    kind: 'hub',
    region: 'Brazil',
    size: 22,
    x: 0,
    y: 0,
  },
  {
    id: 'itau',
    label: 'Itaú Unibanco',
    subtitle: 'Regional commercial bank',
    kind: 'regional-bank',
    region: 'São Paulo',
    size: 14,
    x: -34,
    y: -5,
  },
  {
    id: 'banco-do-brasil',
    label: 'Banco do Brasil',
    subtitle: 'Regional public bank',
    kind: 'regional-bank',
    region: 'Brasília',
    size: 14,
    x: 34,
    y: -5,
  },
  {
    id: 'bradesco',
    label: 'Bradesco',
    subtitle: 'Regional commercial bank',
    kind: 'regional-bank',
    region: 'São Paulo',
    size: 14,
    x: -28,
    y: 24,
  },
  {
    id: 'caixa',
    label: 'Caixa Econômica Federal',
    subtitle: 'Regional public bank',
    kind: 'regional-bank',
    region: 'Brasília',
    size: 14,
    x: 28,
    y: 24,
  },
  {
    id: 'santander',
    label: 'Santander Brasil',
    subtitle: 'Regional commercial bank',
    kind: 'regional-bank',
    region: 'São Paulo',
    size: 14,
    x: -55,
    y: 17,
  },
  {
    id: 'mercantil',
    label: 'Banco Mercantil',
    subtitle: 'Regional commercial bank',
    kind: 'regional-bank',
    region: 'Minas Gerais',
    size: 13,
    x: 55,
    y: 17,
  },
]

const edges: NetworkEdgeDefinition[] = [
  {
    id: 'itau-channel-0',
    source: 'itau',
    target: 'bcb-hub',
    label: 'Itaú Unibanco <> BCB Hub',
    channel: 'channel-0',
    capability: 'IBC',
  },
  {
    id: 'bb-channel-1',
    source: 'banco-do-brasil',
    target: 'bcb-hub',
    label: 'Banco do Brasil <> BCB Hub',
    channel: 'channel-1',
    capability: 'IBC',
  },
  {
    id: 'bradesco-channel-2',
    source: 'bradesco',
    target: 'bcb-hub',
    label: 'Bradesco <> BCB Hub',
    channel: 'channel-2',
    capability: 'IBC',
  },
  {
    id: 'caixa-channel-3',
    source: 'caixa',
    target: 'bcb-hub',
    label: 'Caixa Econômica Federal <> BCB Hub',
    channel: 'channel-3',
    capability: 'IBC',
  },
  {
    id: 'santander-channel-4',
    source: 'santander',
    target: 'bcb-hub',
    label: 'Santander Brasil <> BCB Hub',
    channel: 'channel-4',
    capability: 'IBC',
  },
  {
    id: 'mercantil-channel-0',
    source: 'mercantil',
    target: 'bcb-hub',
    label: 'Banco Mercantil <> BCB Hub',
    channel: 'channel-0',
    capability: 'IBC',
  },
]

const forceAtlas2Duration = 350

function getCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0) return DEFAULT_EDGE_CURVATURE
  if (index < 0) return -getCurvature(-index, maxIndex)
  const amplitude = 3.5
  const maxCurvature =
    amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE
  return (maxCurvature * index) / maxIndex
}

function buildGraph(): MultiDirectedGraph<BankNetworkNode, BankNetworkEdge> {
  const graph = new MultiDirectedGraph<BankNetworkNode, BankNetworkEdge>()

  for (const node of nodes) {
    graph.addNode(node.id, {
      ...node,
      color: nodeColors[node.kind],
    })
  }

  for (const edge of edges) {
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      label: edge.label,
      channel: edge.channel,
      capability: edge.capability,
      color: edgeColors[edge.capability],
      size: 2,
    })
  }

  indexParallelEdgesIndex(graph, {
    edgeIndexAttribute: 'parallelIndex',
    edgeMinIndexAttribute: 'parallelMinIndex',
    edgeMaxIndexAttribute: 'parallelMaxIndex',
  })

  graph.forEachEdge((edge, attributes) => {
    const parallelIndex = (attributes as { parallelIndex?: number | null }).parallelIndex
    const parallelMaxIndex = (attributes as { parallelMaxIndex?: number | null }).parallelMaxIndex

    if (typeof parallelIndex === 'number' && typeof parallelMaxIndex === 'number') {
      graph.mergeEdgeAttributes(edge, {
        type: parallelIndex ? 'curved' : 'straight',
        curvature: getCurvature(parallelIndex, parallelMaxIndex),
      })
    } else {
      graph.setEdgeAttribute(edge, 'type', 'straight')
    }
  })

  return graph
}

export function BankNetworkGraph() {
  const graph = useMemo(() => buildGraph(), [])

  return (
    <div className="relative h-[680px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <SigmaContainer
        className="h-full w-full"
        graph={MultiDirectedGraph}
        settings={{
          renderLabels: true,
          allowInvalidContainer: true,
          defaultEdgeType: 'straight',
          enableEdgeEvents: true,
          labelSize: 13,
          labelWeight: '600',
          edgeProgramClasses: {
            straight: EdgeArrowProgram,
            curved: EdgeCurvedArrowProgram,
          },
        }}
      >
        <BankNetworkGraphControls graph={graph} />
      </SigmaContainer>
    </div>
  )
}

function BankNetworkGraphControls({
  graph,
}: {
  graph: MultiDirectedGraph<BankNetworkNode, BankNetworkEdge>
}) {
  const sigma = useSigma()
  const loadGraph = useLoadGraph()
  const registerEvents = useRegisterEvents()
  const setSettings = useSetSettings()
  const { reset: recenter } = useCamera()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [layout, setLayout] = useState<'hub' | 'circular' | 'forceatlas2'>('hub')
  const stopAnimationRef = useRef<() => void>(() => {})

  const { positions: circularPositions } = useLayoutCircular({ scale: 70 })
  const { start: startForceAtlas2, stop: stopForceAtlas2 } = useWorkerLayoutForceAtlas2({
    settings: {
      ...forceAtlas2.inferSettings(graph),
      gravity: 1.2,
      scalingRatio: 8,
    },
  })

  useEffect(() => {
    loadGraph(graph)
    recenter()

    const timeout = window.setTimeout(() => {
      sigma.getCamera().ratio = 1.15
      sigma.refresh()
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [graph, loadGraph, recenter, sigma])

  useEffect(() => {
    return registerEvents({
      enterNode: ({ node }) => setHoveredNode(node),
      leaveNode: () => setHoveredNode(null),
      enterEdge: ({ edge }) => setHoveredEdge(edge),
      leaveEdge: () => setHoveredEdge(null),
    })
  }, [registerEvents])

  useEffect(() => {
    const hoveredNeighbors = hoveredNode
      ? new Set([...graph.neighbors(hoveredNode), hoveredNode])
      : null
    const connectedEdges = hoveredNode
      ? new Set(graph.edges(hoveredNode))
      : null

    setSettings({
      nodeReducer: (node, data) => {
        const next: Partial<NodeDisplayData> = { ...data }
        if (hoveredNeighbors && !hoveredNeighbors.has(node)) {
          next.color = '#d1d5db'
          next.label = ''
        }
        if (node === hoveredNode) {
          next.highlighted = true
        }
        return next
      },
      edgeReducer: (edge, data) => {
        if (hoveredEdge && edge !== hoveredEdge) {
          return { ...data, hidden: true }
        }
        if (connectedEdges && !connectedEdges.has(edge)) {
          return { ...data, hidden: true }
        }
        return data
      },
    })
  }, [graph, hoveredEdge, hoveredNode, setSettings])

  const setHubLayout = useCallback(() => {
    stopAnimationRef.current()
    setLayout('hub')
    const targetPositions = Object.fromEntries(
      nodes.map((node) => [node.id, { x: node.x, y: node.y }])
    )
    stopAnimationRef.current = animateNodes(
      sigma.getGraph(),
      targetPositions,
      { duration: forceAtlas2Duration, easing: 'quadraticInOut' },
      () => recenter()
    )
  }, [recenter, sigma])

  const setCircularLayout = useCallback(() => {
    stopAnimationRef.current()
    setLayout('circular')
    circular.assign(sigma.getGraph(), { scale: 70 })
    stopAnimationRef.current = animateNodes(
      sigma.getGraph(),
      circularPositions(),
      { duration: forceAtlas2Duration, easing: 'quadraticInOut' },
      () => recenter()
    )
  }, [circularPositions, recenter, sigma])

  const setForceAtlas2Layout = useCallback(() => {
    stopAnimationRef.current()
    setLayout('forceatlas2')
    startForceAtlas2()
    const timeout = setTimeout(() => {
      stopForceAtlas2()
      recenter()
    }, forceAtlas2Duration)
    stopAnimationRef.current = () => {
      clearTimeout(timeout)
      stopForceAtlas2()
    }
  }, [recenter, startForceAtlas2, stopForceAtlas2])

  const hoveredEdgeAttributes = hoveredEdge
    ? graph.getEdgeAttributes(hoveredEdge)
    : null

  return (
    <>
      <style jsx global>{`
        .bank-network-controls .react-sigma-control > button {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .bank-network-controls .react-sigma-control > button > svg {
          display: block;
          margin: 0 auto;
        }
      `}</style>

      <ControlsContainer position="top-left" className="bank-network-controls flex flex-col items-center">
        <ZoomControl />
        <FullScreenControl />
        <div className="react-sigma-control">
          <button
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Hub & spoke layout"
            onClick={setHubLayout}
          >
            <Fullscreen width="1em" height="1em" />
          </button>
        </div>
        <div className="react-sigma-control">
          <button
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Circular layout"
            onClick={setCircularLayout}
          >
            <CircleDashed width="1em" height="1em" />
          </button>
        </div>
        <div className="react-sigma-control">
          <button
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Force-directed layout"
            onClick={setForceAtlas2Layout}
          >
            <Waypoints width="1em" height="1em" />
          </button>
        </div>
      </ControlsContainer>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-gray-200 bg-white/90 p-3 text-xs text-gray-700 shadow-sm backdrop-blur">
        <div className="mb-2 font-semibold text-gray-900">Legend</div>
        {Object.entries(nodeColors).map(([kind, color]) => (
          <div key={kind} className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{kind.replace('-', ' ')}</span>
          </div>
        ))}
      </div>

      {(hoveredEdgeAttributes || hoveredNode) && (
        <div className="pointer-events-none absolute right-4 top-4 max-w-sm rounded-xl border border-gray-200 bg-white/95 p-4 text-sm text-gray-700 shadow-sm backdrop-blur">
          {hoveredEdgeAttributes ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">IBC Channel</div>
              <div className="mt-1 font-semibold text-gray-900">{hoveredEdgeAttributes.label}</div>
              <div className="mt-2 flex gap-2 text-xs">
                <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
                  {hoveredEdgeAttributes.channel}
                </span>
                <span className="rounded-full bg-purple-50 px-2 py-1 font-medium text-purple-700">
                  {hoveredEdgeAttributes.capability}
                </span>
              </div>
            </>
          ) : hoveredNode ? (
            (() => {
              const node = graph.getNodeAttributes(hoveredNode)
              return (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Chain</div>
                  <div className="mt-1 font-semibold text-gray-900">{node.label}</div>
                  <div className="mt-1 text-gray-600">{node.subtitle}</div>
                  <div className="mt-2 text-xs text-gray-500">{node.region}</div>
                </>
              )
            })()
          ) : null}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-xs text-gray-600 shadow-sm backdrop-blur">
        Layout: <span className="font-semibold text-gray-900">{layout}</span>
      </div>
    </>
  )
}
