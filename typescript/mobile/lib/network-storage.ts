import AsyncStorage from '@react-native-async-storage/async-storage'
import { getNetworkSettings, setNetworkSettings, type NetworkSettings } from './network'
const RPC_KEY = 'bankd_settings_evm_rpc'
const PROVER_KEY = 'bankd_settings_shieldd_prover'
export async function loadNetworkSettings() {
  const [rpcUrl, proverUrl] = await Promise.all([AsyncStorage.getItem(RPC_KEY), AsyncStorage.getItem(PROVER_KEY)])
  const defaults = getNetworkSettings()
  setNetworkSettings({ rpcUrl: rpcUrl || defaults.rpcUrl, proverUrl: proverUrl || defaults.proverUrl })
}
export async function saveNetworkSettings(settings: NetworkSettings) {
  setNetworkSettings(settings)
  await AsyncStorage.multiSet([[RPC_KEY, getNetworkSettings().rpcUrl], [PROVER_KEY, getNetworkSettings().proverUrl]])
}
