import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, ScrollView, Text, View, TouchableOpacity, Animated, Image, AppState, AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { 
  getNetworkProvider, 
  hasUsagePermission, 
  requestUsagePermission, 
  getNetworkUsageSinceMidnight, 
  NetworkUsageStat 
} from '@/modules/battery-info';

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
};

const labels = [0, 5, 10, 50, 100, 250, 500, 750, 1000];

const getPercent = (val: number) => {
  if (val <= 0) return 0;
  if (val >= 1000) return 1;
  for (let i = 0; i < labels.length - 1; i++) {
    if (val >= labels[i] && val <= labels[i+1]) {
      const range = labels[i+1] - labels[i];
      const p = (val - labels[i]) / range;
      return (i + p) / (labels.length - 1);
    }
  }
  return 1;
};

const Speedometer = ({ value }: { value: number }) => {
  const radius = 130;
  const strokeWidth = 24;
  const center = 150;
  const startAngle = -135;
  const endAngle = 135;
  const angleRange = endAngle - startAngle;

  const percent = getPercent(value);
  const currentAngle = startAngle + (percent * angleRange);

  return (
    <View style={styles.meterContainer}>
      <Svg width={300} height={300} viewBox="0 0 300 300">
        <Defs>
          <LinearGradient id="grad" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#00d2ff" stopOpacity="1" />
            <Stop offset="0.5" stopColor="#3a7bd5" stopOpacity="1" />
            <Stop offset="1" stopColor="#8e44ad" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        
        <Path
          d={describeArc(center, center, radius, startAngle, endAngle)}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        
        {value > 0 && (
          <Path
            d={describeArc(center, center, radius, startAngle, currentAngle)}
            stroke="url(#grad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {labels.map((val, index) => {
          const valPercent = index / (labels.length - 1);
          const valAngle = startAngle + (valPercent * angleRange);
          const pos = polarToCartesian(center, center, radius - 35, valAngle);
          return (
            <SvgText
              key={val}
              x={pos.x}
              y={pos.y + 4}
              fill="#aaa"
              fontSize="13"
              fontWeight="bold"
              textAnchor="middle"
            >
              {val}
            </SvgText>
          );
        })}

        <Circle cx={center} cy={center} r={6} fill="#fff" />
        
        <Line
          x1={center}
          y1={center}
          x2={polarToCartesian(center, center, radius - 45, currentAngle).x}
          y2={polarToCartesian(center, center, radius - 45, currentAngle).y}
          stroke="#fff"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </Svg>
      
      <View style={styles.meterTextContainer}>
        <Text style={styles.speedValueText}>{value.toFixed(2)}</Text>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
           <Feather name="arrow-down-circle" size={16} color="#00d2ff" style={{marginRight: 6}} />
           <Text style={styles.speedUnitText}>Mbps</Text>
        </View>
      </View>
    </View>
  );
};

export default function InternetScreen() {
  const [activeTab, setActiveTab] = useState<'Overall' | 'Speed Test'>('Speed Test');
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [overallData, setOverallData] = useState<NetworkUsageStat[]>([]);
  const [totalOverallBytes, setTotalOverallBytes] = useState<number>(0);
  const isFocused = useIsFocused();

  const [provider, setProvider] = useState<string>('Detecting...');
  const [isTesting, setIsTesting] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Test Now');
  
  const animatedValue = useRef(new Animated.Value(0)).current;
  const gradientShiftX = useRef(new Animated.Value(0)).current;
  const [displaySpeed, setDisplaySpeed] = useState(0);

  const checkPermissionAndFetchOverall = useCallback(async () => {
    const granted = hasUsagePermission();
    setHasPermission(granted);
    if (granted && activeTab === 'Overall') {
      const stats = await getNetworkUsageSinceMidnight();
      const total = stats.reduce((sum, app) => sum + (app.totalBytes || 0), 0);
      setTotalOverallBytes(total);
      setOverallData(stats.slice(0, 30)); 
    }
  }, [activeTab]);

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
    Animated.spring(animatedValue, {
      toValue: currentSpeed,
      useNativeDriver: false,
      friction: 7,
      tension: 50,
    }).start();
  }, [currentSpeed]);

  useEffect(() => {
    const listener = animatedValue.addListener(({ value }) => {
      setDisplaySpeed(value);
    });
    return () => animatedValue.removeListener(listener);
  }, []);

  useEffect(() => {
    if (isTesting) {
      Animated.loop(
        Animated.timing(gradientShiftX, {
          toValue: -200, 
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      gradientShiftX.stopAnimation();
      gradientShiftX.setValue(0);
    }
  }, [isTesting]);

  useEffect(() => {
    const fetchProvider = async () => {
      try {
        const prov = await getNetworkProvider();
        setProvider(prov);
      } catch(e) {
        setProvider('Unknown Network');
      }
    };
    fetchProvider();
  }, []);

  const measurePing = async () => {
    setStatusText('Testing Ping...');
    const start = Date.now();
    try {
      await fetch(`https://www.google.com/favicon.ico?t=${start}`, { cache: 'no-store' });
      const end = Date.now();
      setPing(end - start);
    } catch(e) {
      setPing(0);
    }
  };

  const runSpeedTest = (url: string, method: string, payload: any = null) => {
    return new Promise<number>((resolve) => {
      const xhr = new XMLHttpRequest();
      const startTime = Date.now();
      let lastTime = startTime;
      let lastLoaded = 0;
      let speeds: number[] = [];
      let isFinished = false;

      xhr.open(method, `${url}?t=${Date.now()}`, true);
      
      const onProgress = (e: ProgressEvent) => {
        if (isFinished) return;
        const now = Date.now();
        const totalElapsed = now - startTime;
        const delta = now - lastTime;

        if (delta > 200) { 
          const bytes = e.loaded - lastLoaded;
          const bits = bytes * 8;
          const mbps = (bits / (delta / 1000)) / 1000000;
          
          if (mbps >= 0) {
            speeds.push(mbps);
            setCurrentSpeed(mbps);
          }
          
          lastTime = now;
          lastLoaded = e.loaded;
        }

        if (totalElapsed >= 10000) { 
          isFinished = true;
          xhr.abort();
          speeds.sort((a, b) => b - a);
          const topSpeeds = speeds.slice(0, Math.max(1, Math.floor(speeds.length * 0.7)));
          const avg = topSpeeds.length > 0 ? topSpeeds.reduce((a,b)=>a+b,0)/topSpeeds.length : 0;
          resolve(avg);
        }
      };

      if (method === 'GET') {
        xhr.responseType = 'arraybuffer';
        xhr.onprogress = onProgress;
      } else {
        xhr.upload.onprogress = onProgress;
      }

      xhr.onload = () => {
        if (isFinished) return;
        isFinished = true;
        const avg = speeds.length > 0 ? speeds.reduce((a,b)=>a+b,0)/speeds.length : 0;
        resolve(avg);
      };
      
      xhr.onerror = () => {
        if (!isFinished) {
          isFinished = true;
          resolve(0);
        }
      };
      
      xhr.send(payload);
    });
  };

  const startTest = async () => {
    setIsTesting(true);
    setDownloadSpeed(null);
    setUploadSpeed(null);
    setCurrentSpeed(0);
    setPing(null);
    
    await measurePing();
    
    setStatusText('Testing Download...');
    const dSpeed = await runSpeedTest('https://speed.cloudflare.com/__down?bytes=50000000', 'GET'); 
    setDownloadSpeed(dSpeed);
    setCurrentSpeed(0);
    
    setStatusText('Testing Upload...');
    const payload = new Float32Array(5000000); 
    const uSpeed = await runSpeedTest('https://speed.cloudflare.com/__up', 'POST', payload);
    setUploadSpeed(uSpeed);
    setCurrentSpeed(uSpeed);
    
    setStatusText('Test Now');
    setIsTesting(false);
  };

  if (!hasPermission && activeTab === 'Overall') {
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
            style={[styles.tabButton, activeTab === 'Speed Test' && styles.activeTabButton]} 
            onPress={() => setActiveTab('Speed Test')}
          >
            <Text style={[styles.tabText, activeTab === 'Speed Test' && styles.activeTabText]}>Speed Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.centeredContainer}>
          <MaterialIcons name="security" size={64} color="#aaa" />
          <Text style={styles.title}>Permission Required</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginHorizontal: 32 }]}>
            To accurately show overall network traffic, InfoCharge needs Usage Access permission.
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
          style={[styles.tabButton, activeTab === 'Speed Test' && styles.activeTabButton]} 
          onPress={() => setActiveTab('Speed Test')}
        >
          <Text style={[styles.tabText, activeTab === 'Speed Test' && styles.activeTabText]}>Speed Test</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {activeTab === 'Overall' ? (
          <View style={{ width: '100%' }}>
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
          </View>
        ) : (
          <>
            <Speedometer value={displaySpeed > 0 ? displaySpeed : (downloadSpeed || uploadSpeed || 0)} />

            <View style={styles.actionContainer}>
              <TouchableOpacity 
                style={styles.testButtonWrapper} 
                onPress={startTest}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                <View style={[styles.testButton, isTesting && styles.testButtonDisabled]}>
                  {isTesting && (
                    <Animated.View style={[styles.gradientBg, { transform: [{ translateX: gradientShiftX }] }]}>
                      <Svg height="100%" width="400" viewBox="0 0 400 60" preserveAspectRatio="none">
                        <Defs>
                          <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor="#00d2ff" stopOpacity="0.8" />
                            <Stop offset="0.5" stopColor="#3a7bd5" stopOpacity="0.8" />
                            <Stop offset="1" stopColor="#8e44ad" stopOpacity="0.8" />
                          </LinearGradient>
                        </Defs>
                        <Rect width="400" height="60" fill="url(#btnGrad)" />
                      </Svg>
                    </Animated.View>
                  )}
                  
                  <View style={styles.buttonContent}>
                    {!isTesting && <Feather name="play" size={20} color="#fff" style={{marginRight: 8}} />}
                    <Text style={styles.testButtonText}>{statusText}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.metricsCard}>
              <View style={styles.providerRow}>
                <View style={styles.providerIcon}>
                  <Feather name="globe" size={24} color="#00d2ff" />
                </View>
                <View>
                  <Text style={styles.providerTitle}>{provider}</Text>
                  <Text style={styles.providerSubtitle}>Service Provider</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <MaterialCommunityIcons name="speedometer" size={24} color="#aaa" />
                  <Text style={styles.statLabel}>Ping</Text>
                  <Text style={styles.statValue}>
                    {ping !== null ? `${ping} ms` : '--'}
                  </Text>
                </View>
                
                <View style={styles.statBox}>
                  <Feather name="arrow-down" size={24} color="#2ecc71" />
                  <Text style={styles.statLabel}>Download</Text>
                  <Text style={styles.statValue}>
                    {downloadSpeed !== null ? downloadSpeed.toFixed(2) : '--'}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Feather name="arrow-up" size={24} color="#e74c3c" />
                  <Text style={styles.statLabel}>Upload</Text>
                  <Text style={styles.statValue}>
                    {uploadSpeed !== null ? uploadSpeed.toFixed(2) : '--'}
                  </Text>
                </View>
              </View>
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
  container: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
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
  headerContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
    marginTop: 8,
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
    width: '100%',
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
  meterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  meterTextContainer: {
    position: 'absolute',
    bottom: 25,
    alignItems: 'center',
  },
  speedValueText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '300',
    letterSpacing: -1,
  },
  speedUnitText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '500',
  },
  actionContainer: {
    marginVertical: 24,
    width: '100%',
    alignItems: 'center',
  },
  testButtonWrapper: {
    borderRadius: 30,
    shadowColor: '#00d2ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  testButton: {
    backgroundColor: '#3498db',
    width: 200,
    height: 56,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  testButtonDisabled: {
    backgroundColor: '#2c3e50',
    shadowOpacity: 0,
    elevation: 0,
  },
  gradientBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 400,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  metricsCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 210, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  providerSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: '100%',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
