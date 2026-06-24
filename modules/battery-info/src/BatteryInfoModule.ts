import { NativeModule, requireNativeModule } from 'expo';
import { BatteryState } from './BatteryInfo.types';

declare class BatteryInfoModule extends NativeModule<{
  onBatteryStateChanged: (event: BatteryState) => void;
}> {
  getBatteryState(): BatteryState;
  startMonitoring(): void;
  stopMonitoring(): void;
}

export default requireNativeModule<BatteryInfoModule>('BatteryInfo');
