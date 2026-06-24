import { registerWebModule, NativeModule } from 'expo';

class BatteryInfoModule extends NativeModule<{}> {}

export default registerWebModule(BatteryInfoModule, 'BatteryInfoModule');
