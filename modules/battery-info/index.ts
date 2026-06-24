import BatteryInfoModule from './src/BatteryInfoModule';
import { BatteryState } from './src/BatteryInfo.types';

export function getBatteryState(): BatteryState {
  return BatteryInfoModule.getBatteryState();
}

export function startMonitoring(): void {
  BatteryInfoModule.startMonitoring();
}

export function stopMonitoring(): void {
  BatteryInfoModule.stopMonitoring();
}

export function addBatteryStateListener(listener: (event: BatteryState) => void) {
  return BatteryInfoModule.addListener('onBatteryStateChanged', listener);
}

export { BatteryState };
