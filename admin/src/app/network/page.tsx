import { PageContainer } from '@/components/layout'
import { BankNetworkGraphClient } from '@/components/network/BankNetworkGraphClient'

const stats = [
  { label: 'Connected institutions', value: '7' },
  { label: 'IBC channels', value: '6' },
]

const channelRows = [
  ['Itaú Unibanco', 'Brazil Central Bank Hub', 'channel-0', 'IBC'],
  ['Banco do Brasil', 'Brazil Central Bank Hub', 'channel-1', 'IBC'],
  ['Bradesco', 'Brazil Central Bank Hub', 'channel-2', 'IBC'],
  ['Caixa Econômica Federal', 'Brazil Central Bank Hub', 'channel-3', 'IBC'],
  ['Santander Brasil', 'Brazil Central Bank Hub', 'channel-4', 'IBC'],
  ['Banco Mercantil', 'Brazil Central Bank Hub', 'channel-0', 'IBC'],
]

export default function NetworkPage() {
  return (
    <PageContainer
      title="Network"
      description="A hub-and-spoke view of connected bank regions and IBC channels. Every chain has privacy built in."
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
              <div className="mt-1 text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-950">Brazil Central Bank Hub topology</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-900">
            This hardcoded demo map mirrors the intended production model: the central bank operates the
            settlement hub and regional banks connect over dedicated IBC channels. Privacy is built into
            every chain, so there are no separate privacy zones to connect to.
          </p>
        </div>

        <BankNetworkGraphClient />

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Highlighted channels</h2>
            <p className="mt-1 text-sm text-gray-500">Representative IBC paths for the hub-and-spoke banking network.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Channel</th>
                  <th className="px-5 py-3">Capability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {channelRows.map(([source, destination, channel, capability]) => (
                  <tr key={`${source}-${destination}-${channel}`}>
                    <td className="px-5 py-3 font-medium text-gray-900">{source}</td>
                    <td className="px-5 py-3 text-gray-700">{destination}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {channel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{capability}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
