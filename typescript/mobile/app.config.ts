import type { ConfigContext, ExpoConfig } from 'expo/config'
import { withAndroidManifest } from 'expo/config-plugins'

export default ({ config }: ConfigContext): ExpoConfig => {
  const result = { ...config, name: "Bank'd Wallet", slug: 'bankd-wallet' } as ExpoConfig
  if (process.env.EXPO_PUBLIC_ALLOW_HTTP !== '1') return result
  result.ios = { ...result.ios, infoPlist: { ...result.ios?.infoPlist, NSAppTransportSecurity: { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoadsInWebContent: true } } }
  return withAndroidManifest(result, mod => {
    const application = mod.modResults.manifest.application?.[0]
    if (application) application.$['android:usesCleartextTraffic'] = 'true'
    return mod
  })
}
