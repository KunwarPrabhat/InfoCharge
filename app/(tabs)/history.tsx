import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { StorageService, BatteryLog } from '@/services/storage';
import { useIsFocused } from '@react-navigation/native';

export default function HistoryScreen() {
  const [logs, setLogs] = useState<BatteryLog[]>([]);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      loadLogs();
    }
  }, [isFocused]);

  const loadLogs = async () => {
    const data = await StorageService.getLogs();
    setLogs(data);
  };

  const getLevelData = () => {
    if (logs.length === 0) return { labels: ['No Data'], datasets: [{ data: [0] }] };
    
    // Sample up to 10 points for the chart to keep it readable
    const step = Math.max(1, Math.floor(logs.length / 10));
    const sampledLogs = logs.filter((_, index) => index % step === 0 || index === logs.length - 1);
    
    return {
      labels: sampledLogs.map(log => {
        const d = new Date(log.timestamp);
        return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      datasets: [
        {
          data: sampledLogs.map(log => log.level),
          color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`, // Green
        }
      ],
      legend: ['Battery Level (%)']
    };
  };

  const getHealthData = () => {
    if (logs.length === 0) return { labels: ['No Data'], datasets: [{ data: [0] }] };
    
    const step = Math.max(1, Math.floor(logs.length / 10));
    const sampledLogs = logs.filter((_, index) => index % step === 0 || index === logs.length - 1);
    
    return {
      labels: sampledLogs.map(log => {
        const d = new Date(log.timestamp);
        return `${d.getMonth()+1}/${d.getDate()}`; // M/D
      }),
      datasets: [
        {
          data: sampledLogs.map(log => log.healthPercent || 100),
          color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`, // Blue
        }
      ],
      legend: ['Health / Degradation (%)']
    };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Battery Drain History</Text>
        <Text style={styles.subtitle}>Recent battery percentage levels</Text>
        
        {logs.length > 0 ? (
          <LineChart
            data={getLevelData()}
            width={Dimensions.get('window').width - 32} // from react-native
            height={220}
            yAxisSuffix="%"
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: 'rgba(255, 255, 255, 0.02)',
              backgroundGradientTo: 'rgba(255, 255, 255, 0.02)',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#2ecc71'
              }
            }}
            bezier
            style={{
              marginVertical: 16,
              borderRadius: 16,
              marginHorizontal: 16
            }}
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No data logged yet.</Text>
          </View>
        )}

        <Text style={[styles.title, { marginTop: 24 }]}>Degradation Tracking</Text>
        <Text style={styles.subtitle}>Battery health over time</Text>
        
        {logs.length > 0 ? (
          <LineChart
            data={getHealthData()}
            width={Dimensions.get('window').width - 32}
            height={220}
            yAxisSuffix="%"
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: 'rgba(255, 255, 255, 0.02)',
              backgroundGradientTo: 'rgba(255, 255, 255, 0.02)',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#3498db'
              }
            }}
            bezier
            style={{
              marginVertical: 16,
              borderRadius: 16,
              marginHorizontal: 16
            }}
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No data logged yet.</Text>
          </View>
        )}
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
    paddingVertical: 48, // To account for safe area in some devices
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginHorizontal: 16,
    marginTop: 4,
  },
  noData: {
    height: 220,
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
  }
});
