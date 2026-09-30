'use client'

import { useState } from 'react'
import { prepareDisclosureExport } from '@/lib/native-wallet/penumbra/services/disclosure'

export function DisclosureExport() {
  const [transactionId, setTransactionId] = useState('')
  const [height, setHeight] = useState('')
  const [action, setAction] = useState('0')
  const [output, setOutput] = useState('0')
  const [method, setMethod] = useState<'openings' | 'payload-keys'>('openings')
  const [prepared, setPrepared] = useState<Awaited<ReturnType<typeof prepareDisclosureExport>>>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const clear = () => { setPrepared(undefined); setError('') }
  async function prepare() {
    clear(); setBusy(true)
    try {
      if (![action, output].every(value => /^\d+$/.test(value))) throw new Error('Action and output indexes must be unsigned integers')
      setPrepared(await prepareDisclosureExport({ transactionId, height, action: Number(action), output: Number(output) }, method))
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  function download() {
    if (!prepared) return
    const url = URL.createObjectURL(new Blob([prepared.packageJson], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'disclosure.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="space-y-3 rounded border p-4" aria-label="Voluntary disclosure export">
    <h2 className="text-lg font-semibold">Export a selected payment</h2>
    <p>Unlock your wallet, then select an accepted Shieldd transaction and output. Preparing an export leaves balances and reserved notes unchanged.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Shieldd transaction ID<input className="block w-full rounded border p-2" value={transactionId} onChange={event => { clear(); setTransactionId(event.target.value.trim()) }} /></label>
      <label className="block">Accepted block height<input className="block rounded border p-2" value={height} onChange={event => { clear(); setHeight(event.target.value) }} /></label>
      <label className="block">Action index<input className="block rounded border p-2" value={action} onChange={event => { clear(); setAction(event.target.value) }} /></label>
      <label className="block">Output index<input className="block rounded border p-2" value={output} onChange={event => { clear(); setOutput(event.target.value) }} /></label>
      <label className="block" htmlFor="disclosure-evidence">Evidence</label>
      <select id="disclosure-evidence" className="block rounded border p-2" value={method} onChange={event => { clear(); setMethod(event.target.value as typeof method) }}>
        <option value="openings">Note opening</option><option value="payload-keys">Payload key</option>
      </select>
      <p>{method === 'openings' ? 'Reveals the selected amount, asset, recipient and commitment blinding.' : 'Reveals the selected note and its decryption key. The key also grants access to memo data for the whole transaction, including unselected outputs.'}</p>
      <button type="button" className="rounded border p-2" onClick={prepare}>{busy ? 'Preparing…' : 'Prepare disclosure preview'}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {prepared && <><pre className="max-h-80 overflow-auto whitespace-pre-wrap">{prepared.preview}</pre><p>Cryptography and acceptance checked against the configured node.</p><button className="rounded border p-2" onClick={download}>Download disclosure</button></>}
  </section>
}
