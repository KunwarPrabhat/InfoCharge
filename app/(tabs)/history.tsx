import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, Text, View, TouchableOpacity, AppState, AppStateStatus, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { hasUsagePermission, requestUsagePermission, getNetworkUsageSinceMidnight, getLiveTrafficStats, NetworkUsageStat } from '@/modules/battery-info';

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

type LiveSpeed = {
  uid: number;
  packageName: string;
  appName: string;
  rxSpeed: number;
  txSpeed: number;
  totalSpeed: number;
  iconBase64?: string;
};

export default function NetworkUsageScreen() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'Overall' | 'Live'>('Overall');
  
  const [overallData, setOverallData] = useState<NetworkUsageStat[]>([]);
  const [totalOverallBytes, setTotalOverallBytes] = useState<number>(0);
  
  const [liveSpeeds, setLiveSpeeds] = useState<LiveSpeed[]>([]);
  
  const isFocused = useIsFocused();
  
  const prevLiveStatsRef = useRef<Record<number, NetworkUsageStat>>({});
  const lastTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const checkPermissionAndFetchOverall = useCallback(() => {
    const granted = hasUsagePermission();
    setHasPermission(granted);
    if (granted && activeTab === 'Overall') {
      const stats = getNetworkUsageSinceMidnight();
      const total = stats.reduce((sum, app) => sum + (app.totalBytes || 0), 0);
      setTotalOverallBytes(total);
      setOverallData(stats.slice(0, 30)); 
    }
  }, [activeTab]);

  const pollLiveStats = useCallback(() => {
    const stats = getLiveTrafficStats();
    const now = Date.now();
    const deltaMs = now - lastTimeRef.current;
    
    if (deltaMs > 0 && Object.keys(prevLiveStatsRef.current).length > 0) {
      const speeds: LiveSpeed[] = [];
      stats.forEach(current => {
        const prev = prevLiveStatsRef.current[current.uid];
        if (prev) {
          const rxDiff = current.rxBytes - prev.rxBytes;
          const txDiff = current.txBytes - prev.txBytes;
          
          const rxSpeed = Math.max(0, (rxDiff * 1000) / deltaMs);
          const txSpeed = Math.max(0, (txDiff * 1000) / deltaMs);
          const totalSpeed = rxSpeed + txSpeed;
          
          // Show apps with more than 100 bytes/sec to avoid noise
          if (totalSpeed > 100) {
            speeds.push({
              uid: current.uid,
              packageName: current.packageName,
              appName: current.appName,
              rxSpeed,
              txSpeed,
              totalSpeed,
              iconBase64: current.iconBase64
            });
          }
        }
      });
      
      speeds.sort((a, b) => b.totalSpeed - a.totalSpeed);
      setLiveSpeeds(speeds);
    }
    
    const nextPrev: Record<number, NetworkUsageStat> = {};
    stats.forEach(s => nextPrev[s.uid] = s);
    prevLiveStatsRef.current = nextPrev;
    lastTimeRef.current = now;
  }, []);

  useEffect(() => {
    if (isFocused) {
      checkPermissionAndFetchOverall();
    }
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissionAndFetchOverall();
      }
    });
    return () => subscription.remove();
  }, [isFocused, checkPermissionAndFetchOverall]);

  useEffect(() => {
    if (hasPermission && activeTab === 'Live' && isFocused) {
      prevLiveStatsRef.current = {};
      lastTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        pollLiveStats();
      }, 1000);
      
      pollLiveStats();
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasPermission, activeTab, isFocused, pollLiveStats]);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centeredContainer}>
          <MaterialIcons name="security" size={64} color="#aaa" />
          <Text style={styles.title}>Permission Required</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginHorizontal: 32 }]}>
            To accurately show network traffic, InfoCharge needs Usage Access permission.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestUsagePermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Overall' && styles.activeTabButton]} 
          onPress={() => setActiveTab('Overall')}
        >
          <Text style={[styles.tabText, activeTab === 'Overall' && styles.activeTabText]}>Overall</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'Live' && styles.activeTabButton]} 
          onPress={() => setActiveTab('Live')}
        >
          <Text style={[styles.tabText, activeTab === 'Live' && styles.activeTabText]}>Live</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {activeTab === 'Overall' ? (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.totalTimeText}>{formatBytes(totalOverallBytes, 2)}</Text>
              <Text style={styles.subtitle}>Total data used today</Text>
            </View>

            <View style={styles.listContainer}>
              {overallData.length === 0 ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#888' }}>No data</Text>
                </View>
              ) : (
                overallData.map((app, index) => (
                  <View 
                    key={app.uid} 
                    style={[
                      styles.listItem, 
                      index === overallData.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.iconWrapper}>
                      {app.iconBase64 ? (
                        <Image 
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }} 
                          style={styles.appIcon} 
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.iconPlaceholder}>
                          <Text style={styles.iconPlaceholderText}>
                            {app.appName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.listTextContainer}>
                      <Text style={styles.appName} numberOfLines={1}>{app.appName}</Text>
                      <Text style={styles.appTime}>{formatBytes(app.totalBytes || 0)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerContainer}>
              <Text style={[styles.subtitle, { color: '#3498db' }]}>Monitoring network in real-time</Text>
            </View>
            <View style={styles.listContainer}>
              {liveSpeeds.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Feather name="activity" size={32} color="#444" style={{ marginBottom: 12 }} />
                  <Text style={{ color: '#888' }}>No active network traffic</Text>
                </View>
              ) : (
                liveSpeeds.map((app, index) => (
                  <View 
                    key={app.uid} 
                    style={[
                      styles.listItem, 
                      index === liveSpeeds.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.iconWrapper}>
                      {app.iconBase64 ? (
                        <Image 
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }} 
                          style={styles.appIcon} 
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.iconPlaceholder}>
                          <Text style={styles.iconPlaceholderText}>
                            {app.appName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.listTextContainer}>
                      <Text style={styles.appName} numberOfLines={1}>{app.appName}</Text>
                    </View>
                    <View style={styles.speedContainer}>
                      <View style={styles.speedRow}>
                        <Feather name="arrow-down" size={14} color="#2ecc71" />
                        <Text style={styles.speedText}>{formatBytes(app.rxSpeed)}/s</Text>
                      </View>
                      <View style={styles.speedRow}>
                        <Feather name="arrow-up" size={14} color="#e74c3c" />
                        <Text style={styles.speedText}>{formatBytes(app.txSpeed)}/s</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
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
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTabButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 15,
  },
  activeTabText: {
    color: '#fff',
  },
  container: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  totalTimeText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  listContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconWrapper: {
    marginRight: 16,
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholderText: {
    color: '#3498db',
    fontSize: 18,
    fontWeight: 'bold',
  },
  listTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  appName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  appTime: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  speedContainer: {
    alignItems: 'flex-end',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  speedText: {
    color: '#ddd',
    fontSize: 13,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
    width: 70,
    textAlign: 'right',
  },
});
