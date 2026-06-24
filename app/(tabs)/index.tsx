import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, Platform, Text, View } from 'react-native';
import Meter from '@/components/Meter';
import StatCard from '@/components/StatCard';
import * as BatteryInfo from '@/modules/battery-info';
import type { BatteryState } from '@/modules/battery-info';
import * as Notifications from 'expo-notifications';
import { StorageService, UserSettings } from '@/services/storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function DashboardScreen() {
  const [batteryState, setBatteryState] = useState<BatteryState | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [timeEstimation, setTimeEstimation] = useState<string>('Calculating...');
  
  const lastLogTimeRef = useRef<number>(Date.now());
  const alarmTriggeredRef = useRef<boolean>(false);
  const tempTriggeredRef = useRef<boolean>(false);

  // For time estimation
  const rateHistoryRef = useRef<number[]>([]);
  const lastChargeRef = useRef<{time: number, capacity: number} | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        setBatteryState(BatteryInfo.getBatteryState());
        BatteryInfo.startMonitoring();
        
        const subscription = BatteryInfo.addBatteryStateListener((state) => {
          setBatteryState(state);
        });

        const intervalId = setInterval(() => {
          setBatteryState(BatteryInfo.getBatteryState());
        }, 1000);

        const settingsInterval = setInterval(async () => {
          setSettings(await StorageService.getSettings());
        }, 5000);

        StorageService.getSettings().then(setSettings);
        Notifications.requestPermissionsAsync();

        return () => {
          clearInterval(intervalId);
          clearInterval(settingsInterval);
          subscription.remove();
          BatteryInfo.stopMonitoring();
        };
      } catch (e) {
        console.warn('Native module not available. Need to build native app.');
      }
    }
  }, []);

  // Process data changes (Logging, Alarms, Estimations)
  useEffect(() => {
    if (!batteryState) return;
    const now = Date.now();

    // 1. Time Estimation Logic
    let cellMultiplier = 1;
    if (batteryState.designCapacity > 0 && batteryState.chargeCounter > 0 && batteryState.level > 0) {
      let calculatedMaxCapacity = (batteryState.chargeCounter / 1000) / (batteryState.level / 100);
      if (batteryState.designCapacity / calculatedMaxCapacity >= 1.5) {
        cellMultiplier = Math.round(batteryState.designCapacity / calculatedMaxCapacity);
      }
    }
    
    const currentRemainingmAh = batteryState.chargeCounter > 0 ? (batteryState.chargeCounter / 1000) * cellMultiplier : 0;
    
    if (lastChargeRef.current && currentRemainingmAh > 0) {
      const timeDelta = now - lastChargeRef.current.time; // ms
      if (timeDelta >= 10000) { // Update rate every 10 seconds to avoid micro-fluctuations
        const capacityDelta = currentRemainingmAh - lastChargeRef.current.capacity; // mAh
        
        // rate in mAh per hour
        const ratePerHour = (capacityDelta / (timeDelta / 1000 / 3600));
        
        if (Math.abs(ratePerHour) > 50) { // filter noise
          rateHistoryRef.current.push(ratePerHour);
          if (rateHistoryRef.current.length > 5) rateHistoryRef.current.shift();
        }
        
        lastChargeRef.current = { time: now, capacity: currentRemainingmAh };
      }
    } else if (currentRemainingmAh > 0) {
      lastChargeRef.current = { time: now, capacity: currentRemainingmAh };
    }

    // Calculate time based on average rate
    if (rateHistoryRef.current.length > 0) {
      const avgRate = rateHistoryRef.current.reduce((a,b) => a+b, 0) / rateHistoryRef.current.length;
      
      if (avgRate > 0 && batteryState.status === 2) {
        // Charging
        const totalmAh = batteryState.designCapacity > 0 ? batteryState.designCapacity : 0;
        if (totalmAh > currentRemainingmAh) {
          const hoursLeft = (totalmAh - currentRemainingmAh) / avgRate;
          if (hoursLeft > 0 && hoursLeft < 24) {
            const h = Math.floor(hoursLeft);
            const m = Math.floor((hoursLeft - h) * 60);
            setTimeEstimation(`Full in ${h > 0 ? h + 'h ' : ''}${m}m`);
          } else {
            setTimeEstimation('Calculating...');
          }
        } else {
          setTimeEstimation('Almost Full');
        }
      } else if (avgRate < 0 && batteryState.status !== 2 && batteryState.status !== 5) {
        // Discharging
        const hoursLeft = currentRemainingmAh / Math.abs(avgRate);
        if (hoursLeft > 0 && hoursLeft < 48) {
          const h = Math.floor(hoursLeft);
          const m = Math.floor((hoursLeft - h) * 60);
          setTimeEstimation(`Empty in ${h > 0 ? h + 'h ' : ''}${m}m`);
        } else {
          setTimeEstimation('Calculating...');
        }
      } else {
        setTimeEstimation('--');
      }
    }

    // 2. Logging
    if (now - lastLogTimeRef.current > 5 * 60 * 1000) { // 5 mins
      // Calculate health to store
      let healthPercentInt = 100;
      if (batteryState.designCapacity > 0 && batteryState.chargeCounter > 0 && batteryState.level > 0) {
        let calculatedMaxCapacity = (batteryState.chargeCounter / 1000) / (batteryState.level / 100);
        calculatedMaxCapacity *= cellMultiplier;
        healthPercentInt = Math.min(Math.round((calculatedMaxCapacity / batteryState.designCapacity) * 100), 100);
      }
      
      StorageService.addLog({
        timestamp: now,
        level: batteryState.level,
        healthPercent: healthPercentInt
      });
      lastLogTimeRef.current = now;
    }

    // 3. Alarms and Warnings
    if (settings) {
      if (settings.alarmEnabled && batteryState.level >= settings.alarmLevel && !alarmTriggeredRef.current && (batteryState.status === 2 || batteryState.status === 5)) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Charge Alarm',
            body: `Battery has reached ${batteryState.level}%! You can unplug now.`,
          },
          trigger: null,
        });
        alarmTriggeredRef.current = true;
      } else if (batteryState.level < settings.alarmLevel || (batteryState.status !== 2 && batteryState.status !== 5)) {
        alarmTriggeredRef.current = false;
      }

      const tempC = batteryState.temperature > 0 ? batteryState.temperature / 10 : 0;
      if (settings.tempWarningEnabled && tempC >= settings.tempWarningThreshold && !tempTriggeredRef.current) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Temperature Warning',
            body: `Battery temperature is high: ${tempC}°C!`,
          },
          trigger: null,
        });
        tempTriggeredRef.current = true;
      } else if (tempC < settings.tempWarningThreshold) {
        tempTriggeredRef.current = false;
      }
    }
  }, [batteryState, settings]);

  if (!batteryState) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Waiting for battery data...</Text>
        {Platform.OS !== 'android' && (
          <Text style={styles.subText}>This module is designed for Android.</Text>
        )}
      </View>
    );
  }

  // Interpretation Logic for UI
  const isCharging = batteryState.status === 2;
  const isFull = batteryState.status === 5;
  const isDischarging = batteryState.status === 3;
  const isPlugged = batteryState.plugType > 0;

  let statusText = 'Not Plugged In';
  if (isCharging) statusText = 'Charging';
  else if (isFull) statusText = 'Fully Charged';
  else if (isDischarging) statusText = 'Discharging';
  else if (isPlugged) statusText = 'Plugged In, Not Charging';

  const currentmA = batteryState.currentNow ? batteryState.currentNow / 1000 : 0;
  const voltageV = batteryState.voltage > 0 ? (batteryState.voltage / 1000).toFixed(2) : '0';
  const tempC = batteryState.temperature > 0 ? (batteryState.temperature / 10).toFixed(1) : '0';
  const powerW = ((parseFloat(voltageV)) * (Math.abs(currentmA) / 1000)).toFixed(2);

  let plugStr = 'Battery';
  if (batteryState.plugType === 1) plugStr = 'AC Charger';
  else if (batteryState.plugType === 2) plugStr = 'USB';
  else if (batteryState.plugType === 4) plugStr = 'Wireless';

  let healthStr = 'Unknown';
  let healthColor = '#e74c3c';
  switch (batteryState.health) {
    case 2: healthStr = 'Good'; healthColor = '#2ecc71'; break;
    case 3: healthStr = 'Overheat'; break;
    case 4: healthStr = 'Dead'; break;
    case 5: healthStr = 'Over Voltage'; break;
    case 6: healthStr = 'Failure'; break;
    case 7: healthStr = 'Cold'; break;
  }

  let healthDisplay = healthStr;
  let cellMultiplier = 1;
  let calculatedMaxCapacity = 0;
  
  if (batteryState.designCapacity > 0 && batteryState.chargeCounter > 0 && batteryState.level > 0) {
    calculatedMaxCapacity = (batteryState.chargeCounter / 1000) / (batteryState.level / 100);
    
    if (calculatedMaxCapacity > 0) {
      const ratio = batteryState.designCapacity / calculatedMaxCapacity;
      if (ratio >= 1.5) {
        cellMultiplier = Math.round(ratio);
      }
    }
    
    calculatedMaxCapacity *= cellMultiplier;
    let healthPercent = (calculatedMaxCapacity / batteryState.designCapacity) * 100;
    
    healthPercent = Math.min(Math.round(healthPercent), 100);
    
    healthDisplay = `${healthPercent}%`;
    healthColor = healthPercent >= 80 ? '#2ecc71' : (healthPercent >= 60 ? '#f1c40f' : '#e74c3c');
  } else if (batteryState.designCapacity > 0) {
    healthDisplay = 'Charge fully once to see';
    healthColor = '#f1c40f';
  } else if (batteryState.chargeCounter > 0 && batteryState.level > 0) {
    calculatedMaxCapacity = (batteryState.chargeCounter / 1000) / (batteryState.level / 100);
  }

  let remainingmAh = batteryState.chargeCounter > 0 ? (batteryState.chargeCounter / 1000) * cellMultiplier : 0;
  let totalmAh = batteryState.designCapacity > 0 ? batteryState.designCapacity : calculatedMaxCapacity;

  const capacityStr = remainingmAh > 0 && totalmAh > 0 ? `${remainingmAh.toFixed(0)}/${totalmAh.toFixed(0)}` : 'Unknown';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Meter 
          currentmA={Math.abs(currentmA)} 
          statusText={statusText} 
          isCharging={isCharging || isFull} 
        />

        <View style={styles.estimationContainer}>
          <Text style={styles.estimationText}>{timeEstimation}</Text>
        </View>
        
        <View style={styles.gridContainer}>
          <StatCard 
            title="Level" 
            value={`${batteryState.level}%`} 
            icon="battery-half" 
            color={isCharging ? '#00e676' : '#3498db'} 
          />
          
          <StatCard 
            title="Capacity" 
            value={capacityStr} 
            icon="flash" 
            color="#f1c40f" 
          />
          
          <StatCard 
            title="Voltage" 
            value={`${voltageV} V`} 
            icon="speedometer-outline" 
            color="#9b59b6" 
          />
          
          <StatCard 
            title="Power" 
            value={`${powerW} W`} 
            icon="flash-outline" 
            color="#e67e22" 
          />
          
          <StatCard 
            title="Temperature" 
            value={`${tempC} °C`} 
            icon="thermometer-outline" 
            color={parseFloat(tempC) > 40 ? '#e74c3c' : '#2ecc71'} 
          />
          
          <StatCard 
            title="Health" 
            value={healthDisplay} 
            icon="medkit-outline" 
            color={healthColor} 
          />
          
          <StatCard 
            title="Plug Type" 
            value={plugStr} 
            icon="power-outline" 
            color="#34495e" 
          />
          
          <StatCard 
            title="Cycle Count" 
            value={batteryState.cycleCount > 0 ? batteryState.cycleCount : 'N/A'} 
            icon="sync-outline" 
            color="#8e44ad" 
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    paddingVertical: 24,
    paddingBottom: 40,
  },
  estimationContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  estimationText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '500',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  subText: {
    color: '#888',
    marginTop: 8,
  }
});
