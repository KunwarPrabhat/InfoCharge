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
  getNetworkUsageSinceMidnight(): Promise<NetworkUsageStat[]>;
  getLiveTrafficStats(): Promise<NetworkUsageStat[]>;
  getNetworkProvider(): Promise<string>;
  getAppRxBytes(): number;
  getAppTxBytes(): number;
  measurePingNative(host: string, port: number): Promise<number>;
}

export default requireNativeModule<BatteryInfoModule>('BatteryInfo');
