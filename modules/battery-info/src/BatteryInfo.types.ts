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
} & BatteryState;

export type NetworkUsageStat = {
  uid: number;
  packageName: string;
  appName: string;
  rxBytes: number;
  txBytes: number;
  totalBytes?: number;
  iconBase64?: string;
};
