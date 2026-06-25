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

export function getNetworkUsageSinceMidnight(): NetworkUsageStat[] {
  return BatteryInfoModule.getNetworkUsageSinceMidnight();
}

export function getLiveTrafficStats(): NetworkUsageStat[] {
  return BatteryInfoModule.getLiveTrafficStats();
}

export function addBatteryStateListener(listener: (event: BatteryState) => void) {
  return BatteryInfoModule.addListener('onBatteryStateChanged', listener);
}

export { BatteryState, NetworkUsageStat };
