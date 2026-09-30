import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'

import { CoSignModal } from '@/components/multisig'
import {
  MultisigProvider,
  NativeWalletProvider,
  PenumbraProvider,
  QueryProvider,
  WagmiProvider,
} from '@/components/providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mizu',
  description: 'Mizu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <QueryProvider>
          <NativeWalletProvider>
            <MultisigProvider>
              <WagmiProvider>
                <PenumbraProvider>{children}</PenumbraProvider>
                <CoSignModal />
              </WagmiProvider>
            </MultisigProvider>
          </NativeWalletProvider>

          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#333',
                color: '#fff',
                maxWidth: '32rem',
                wordBreak: 'break-word',
              },
              success: {
                style: {
                  background: '#059669',
                },
              },
              error: {
                style: {
                  background: '#dc2626',
                },
              },
              loading: {
                duration: Infinity,
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  )
}
