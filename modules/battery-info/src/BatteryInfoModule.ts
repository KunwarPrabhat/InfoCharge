import { NativeModule, requireNativeModule } from 'expo';
import { BatteryState, NetworkUsageStat } from './BatteryInfo.types';

declare class BatteryInfoModule extends NativeModule<{
  onBatteryStateChanged: (event: BatteryState) => void;
}> {
  getBatteryState(): BatteryState;
  startMonitoring(): void;
  stopMonitoring(): void;
  hasUsagePermission(): boolean;
  requestUsagePermission(): void;
  getNetworkUsageSinceMidnight(): NetworkUsageStat[];
  getLiveTrafficStats(): NetworkUsageStat[];
}

export default requireNativeModule<BatteryInfoModule>('BatteryInfo');
