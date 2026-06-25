# InfoCharge
Download the latest version from the release section.

InfoCharge is a comprehensive system utility application for Android built with React Native and Expo. It provides real-time monitoring and diagnostics for your device's battery health and network performance.

## Features

### Battery Dashboard
- Real-time current monitoring (mA) indicating charging or discharging rates.
- Dynamic gauge meter with smooth animations reflecting current power draw.
- Time estimations for full charge or complete discharge based on historical consumption rates.
- Detailed battery statistics: Level, Capacity, Voltage, Power, Temperature, Health, Plug Type, and Cycle Count.
- Background alarms and notifications for configurable charge level targets and temperature warnings.

### Network Diagnostics
- Overall daily data usage tracking per application.
- Speed test feature to measure actual download and upload bandwidth.
- Live ping diagnostic test calculating minimum, average, maximum, median, and jitter latency.
- Dynamic graphing to visualize ping stability over time.

## Technologies Used

- React Native & Expo: Core application framework and tooling.
- React Native Reanimated & React Native SVG: For smooth, performant dashboard animations and gauges.
- Custom Android Native Modules: Written in Kotlin to interface directly with Android system APIs (BatteryManager, TrafficStats, NetworkStatsManager) for highly accurate and low-latency telemetry data.

## Project Setup

### Requirements
- Node.js (v18 or newer recommended)
- Android Studio / Android SDK (for native builds)

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```

2. Because the application uses custom native Android modules, you must prebuild the project before running it for the first time, or after making native code changes:
   ```bash
   npx expo prebuild --clean
   ```

### Running Locally
To run the application directly on an attached physical Android device or emulator:
```bash
npx expo run:android
```

### Building for Production
To build a standalone Release APK locally:
```bash
cd android
./gradlew assembleRelease
```

## Permissions
The application requests the following permissions to function correctly:
- Notifications: To alert the user of temperature warnings and charge limits.
- Usage Access (AppOps): To calculate per-app data consumption statistics.
