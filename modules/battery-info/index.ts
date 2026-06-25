import BatteryInfoModule from './src/BatteryInfoModule';
import { BatteryState, NetworkUsageStat } from './src/BatteryInfo.types';

export function getBatteryState(): BatteryState {
  return BatteryInfoModule.getBatteryState();
}

export function startMonitoring(): void {
  BatteryInfoModule.startMonitoring();
}

export function stopMonitoring(): void {
  BatteryInfoModule.stopMonitoring();
}

export function hasUsagePermission(): boolean {
  return BatteryInfoModule.hasUsagePermission();
}

export function requestUsagePermission(): void {
  BatteryInfoModule.requestUsagePermission();
}

export async function getNetworkUsageSinceMidnight(): Promise<NetworkUsageStat[]> {
  return await BatteryInfoModule.getNetworkUsageSinceMidnight();
}

export async function getLiveTrafficStats(): Promise<NetworkUsageStat[]> {
  return await BatteryInfoModule.getLiveTrafficStats();
}

export async function getNetworkProvider(): Promise<string> {
  return await BatteryInfoModule.getNetworkProvider();
}

export function addBatteryStateListener(listener: (event: BatteryState) => void) {
  return BatteryInfoModule.addListener('onBatteryStateChanged', listener);
}

export { BatteryState, NetworkUsageStat };
