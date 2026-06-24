export type BatteryState = {
  level: number;
  scale: number;
  status: number;
  health: number;
  plugType: number;
  voltage: number;
  temperature: number;
  cycleCount: number;
  currentNow: number;
  chargeCounter: number;
  capacity: number;
  designCapacity: number;
};

export type BatteryStateChangeEvent = {
  // It seems Expo's Events sends the exact payload we passed
} & BatteryState;
