import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BatteryLog {
  timestamp: number;
  level: number;
  healthPercent: number;
}

export interface UserSettings {
  alarmEnabled: boolean;
  alarmLevel: number; // 1-100
  tempWarningEnabled: boolean;
  tempWarningThreshold: number; // in Celsius
}

const LOG_KEY = '@battery_logs';
const SETTINGS_KEY = '@user_settings';

export const DEFAULT_SETTINGS: UserSettings = {
  alarmEnabled: false,
  alarmLevel: 80,
  tempWarningEnabled: false,
  tempWarningThreshold: 45,
};

export const StorageService = {
  async getLogs(): Promise<BatteryLog[]> {
    try {
      const data = await AsyncStorage.getItem(LOG_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to get logs', e);
    }
    return [];
  },

  async addLog(log: BatteryLog): Promise<void> {
    try {
      const logs = await this.getLogs();
      // Keep only last 24 hours of logs roughly (e.g. 288 logs if logging every 5 mins)
      // Let's just keep the last 300 logs
      if (logs.length >= 300) {
        logs.shift(); // remove oldest
      }
      logs.push(log);
      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to add log', e);
    }
  },

  async getSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(SETTINGS_KEY);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error('Failed to get settings', e);
    }
    return DEFAULT_SETTINGS;
  },

  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LOG_KEY);
    } catch (e) {
      console.error('Failed to clear logs', e);
    }
  }
};
