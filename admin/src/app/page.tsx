'use client'

import Link from 'next/link'

import { PageContainer } from '@/components/layout'
import { Card } from '@/components/ui'

export default function Home() {
  return (
    <PageContainer title="" description="">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-600 text-white">
          <span className="text-3xl font-bold">M</span>
        </div>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-gray-900">
          Mizu
        </h1>
        <p className="mt-4 max-w-2xl text-xl text-gray-500">
          Privacy-preserving infrastructure for institutional finance
        </p>
        <p className="mt-2 max-w-xl text-base text-gray-400">
          Sovereign L1 blockchain combining zero-knowledge privacy, EVM smart
          contracts, and secure interoperability with instant finality.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
        <Link href="/demo/audit" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Audit</h3>
                <p className="mt-1 text-base text-gray-500">
                  Review flagged transfers and audit known users by name.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/demo/lending" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lending</h3>
                <p className="mt-1 text-base text-gray-500">
                  Lending with privacy-preserving collateral. Deposit, borrow, and repay, securely.
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/demo/avp-swap" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AvP Swap</h3>
                <p className="mt-1 text-base text-gray-500">
                  Atomic Payment vs Payment settlement with instant finality.
                  Trustless token swaps.
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/assets" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Assets</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Issue and manage digital currencies
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/security" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Security</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Manage authorized network participants
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/transfers" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Transfers</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Send funds between institutions
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/configuration" className="group">
          <Card className="h-full transition-colors group-hover:border-primary-300 group-hover:bg-primary-50">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Configuration</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Adjust system parameters and policies
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </PageContainer>
  )
}
