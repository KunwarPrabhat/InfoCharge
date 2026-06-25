import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, ScrollView, Text, View, TouchableOpacity, Animated, Image, AppState, AppStateStatus, TextInput, Easing, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { 
  getNetworkProvider, 
  hasUsagePermission, 
  requestUsagePermission, 
  getNetworkUsageSinceMidnight, 
  getAppRxBytes,
  getAppTxBytes,
  measurePingNative,
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

const describeArcForward = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 1, end.x, end.y,
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

const getSpeedFromPercent = (p: number) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1000;
  const scaledP = p * (labels.length - 1);
  const index = Math.floor(scaledP);
  const fraction = scaledP - index;
  if (index >= labels.length - 1) return 1000;
  const valStart = labels[index];
  const valEnd = labels[index + 1];
  return valStart + fraction * (valEnd - valStart);
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const Speedometer = ({ 
  animatedPercent, 
  animatedNeedlePercent 
}: { 
  animatedPercent: Animated.Value; 
  animatedNeedlePercent: Animated.Value; 
}) => {
  const radius = 130;
  const strokeWidth = 24;
  const center = 150;
  const startAngle = -135;
  const endAngle = 135;
  const angleRange = endAngle - startAngle;
  const ARC_LENGTH = 612.61; // 0.75 * 2 * Math.PI * 130

  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const listener = animatedPercent.addListener(({ value }) => {
      const speed = getSpeedFromPercent(value);
      textInputRef.current?.setNativeProps({ text: speed.toFixed(1) });
    });
    return () => {
      animatedPercent.removeListener(listener);
    };
  }, [animatedPercent]);

  const arcPath = describeArcForward(center, center, radius, startAngle, endAngle);

  const strokeDashoffset = animatedPercent.interpolate({
    inputRange: [0, 1],
    outputRange: [ARC_LENGTH, 0],
    extrapolate: 'clamp',
  });

  const rotationInterpolate = animatedNeedlePercent.interpolate({
    inputRange: [0, 1],
    outputRange: ['-135deg', '135deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.meterContainer}>
      <View style={{ width: 300, height: 300 }}>
        <Svg width={300} height={300} viewBox="0 0 300 300">
          <Defs>
            <LinearGradient id="grad" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#00d2ff" stopOpacity="1" />
              <Stop offset="0.5" stopColor="#3a7bd5" stopOpacity="1" />
              <Stop offset="1" stopColor="#8e44ad" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          
          {/* Background arc */}
          <Path
            d={arcPath}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          <AnimatedPath
            d={arcPath}
            stroke="url(#grad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
            strokeDashoffset={strokeDashoffset}
          />

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
        </Svg>

        {/* Overlay Needle Svg */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ rotate: rotationInterpolate }]
            }
          ]}
          pointerEvents="none"
        >
          <Svg width={300} height={300} viewBox="0 0 300 300">
            <Circle cx={center} cy={center} r={6} fill="#fff" />
            <Line
              x1={center}
              y1={center}
              x2={center}
              y2={center - (radius - 45)}
              stroke="#fff"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      </View>
      
      <View style={styles.meterTextContainer}>
        <TextInput
          ref={textInputRef}
          underlineColorAndroid="transparent"
          editable={false}
          value="0.0"
          style={styles.speedValueText}
        />
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
           <Feather name="arrow-down-circle" size={16} color="#00d2ff" style={{marginRight: 6}} />
           <Text style={styles.speedUnitText}>Mbps</Text>
        </View>
      </View>
    </View>
  );
};

export default function InternetScreen() {
  const { width: screenWidth } = Dimensions.get('window');
  const graphWidth = screenWidth - 80;

  const [activeTab, setActiveTab] = useState<'Overall' | 'Speed Test'>('Speed Test');
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [overallData, setOverallData] = useState<NetworkUsageStat[]>([]);
  const [totalOverallBytes, setTotalOverallBytes] = useState<number>(0);
  const isFocused = useIsFocused();

  const [provider, setProvider] = useState<string>('Detecting...');
  const [isTesting, setIsTesting] = useState(false);
  const [downloadSpeed, setDownloadSpeed] = useState<number | null>(null);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('Test Now');

  // Ping Diagnostic State
  const [pingTesting, setPingTesting] = useState(false);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [pingTimeText, setPingTimeText] = useState<string>('');
  const pingAbortControllerRef = useRef<boolean>(false);
  
  const animatedPercent = useRef(new Animated.Value(0)).current;
  const animatedNeedlePercent = useRef(new Animated.Value(0)).current;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isTestingRef = useRef(false);
  const isMountedRef = useRef(true);

  const animateToSpeed = useCallback((speed: number, duration = 300, isLinear = false) => {
    const targetPercent = getPercent(speed);
    Animated.parallel([
      Animated.timing(animatedPercent, {
        toValue: targetPercent,
        duration,
        useNativeDriver: false,
        easing: isLinear ? Easing.linear : Easing.out(Easing.ease),
      }),
      Animated.timing(animatedNeedlePercent, {
        toValue: targetPercent,
        duration,
        useNativeDriver: true,
        easing: isLinear ? Easing.linear : Easing.out(Easing.ease),
      })
    ]).start();
  }, [animatedPercent, animatedNeedlePercent]);

  const checkPermissionAndFetchOverall = useCallback(async () => {
    const granted = hasUsagePermission();
    if (isMountedRef.current) {
      setHasPermission(granted);
    }
    if (granted && activeTab === 'Overall') {
      const stats = await getNetworkUsageSinceMidnight();
      const total = stats.reduce((sum, app) => sum + (app.totalBytes || 0), 0);
      if (isMountedRef.current) {
        setTotalOverallBytes(total);
        setOverallData(stats.slice(0, 30));
      }
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
    isMountedRef.current = true;
    const fetchProvider = async () => {
      try {
        const prov = await getNetworkProvider();
        if (isMountedRef.current) {
          setProvider(prov);
        }
      } catch(e) {
        if (isMountedRef.current) {
          setProvider('Unknown Network');
        }
      }
    };
    fetchProvider();
    
    return () => {
      isMountedRef.current = false;
      stopTest();
      stopPingTest();
    };
  }, []);

  const measurePing = async () => {
    setStatusText('Testing Ping...');
    const url = `https://www.google.com/favicon.ico?t=${Date.now()}`;
    
    // Warm up connection (DNS lookup + TCP handshake + TLS connection setup)
    try {
      await fetch(url, { cache: 'no-store' });
    } catch(e) {}

    // Run 3 sequential trials and take the minimum duration
    let minPing = 9999;
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await fetch(`https://www.google.com/favicon.ico?t=${Date.now()}_${i}`, { cache: 'no-store' });
        const duration = Date.now() - start;
        if (duration < minPing) {
          minPing = duration;
        }
      } catch(e) {}
      // Short yield delay between trials
      await new Promise(r => setTimeout(r, 60));
    }
    return minPing === 9999 ? 0 : minPing;
  };

  const stopTest = () => {
    isTestingRef.current = false;
    if (isMountedRef.current) {
      setIsTesting(false);
      setStatusText('Test Now');
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    animateToSpeed(0, 300);
  };

  const runNativeSpeedTest = (type: 'download' | 'upload', durationMs = 10000) => {
    return new Promise<number>(async (resolve) => {
      const startTime = Date.now();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Precompute 5MB payload once to avoid JS thread memory locks/setup overhead
      const UPLOAD_PAYLOAD = '0'.repeat(5000000);

      // Spawn 3 concurrent download/upload fetch requests to fully saturate the pipeline
      const CONCURRENT_WORKERS = 3;
      const runFetchLoop = async () => {
        while (isTestingRef.current) {
          try {
            if (type === 'download') {
              await fetch(`https://speed.cloudflare.com/__down?bytes=25000000&t=${Date.now()}`, { 
                signal: abortController.signal, 
                cache: 'no-store' 
              });
            } else {
              await fetch(`https://speed.cloudflare.com/__up?t=${Date.now()}`, { 
                method: 'POST', 
                body: UPLOAD_PAYLOAD,
                headers: { 'Content-Type': 'text/plain' },
                signal: abortController.signal 
              });
            }
            await new Promise(r => setTimeout(r, 20));
          } catch(e) {
            break;
          }
        }
      };

      for (let i = 0; i < CONCURRENT_WORKERS; i++) {
        runFetchLoop();
      }

      const initialBytes = type === 'download' ? getAppRxBytes() : getAppTxBytes();
      const samples: { time: number; bytes: number }[] = [{ time: startTime, bytes: initialBytes }];
      let currentSpeed = 0;

      const interval = setInterval(() => {
        if (!isTestingRef.current) {
          clearInterval(interval);
          resolve(0);
          return;
        }

        const now = Date.now();
        const currentBytes = type === 'download' ? getAppRxBytes() : getAppTxBytes();
        samples.push({ time: now, bytes: currentBytes });

        // Keep last 1000ms of history for sliding window
        const cutoff = now - 1000;
        while (samples.length > 2 && samples[0].time < cutoff) {
          samples.shift();
        }

        const oldest = samples[0];
        const newest = samples[samples.length - 1];
        const timeDiff = (newest.time - oldest.time) / 1000; // in seconds
        const bytesDiff = Math.max(0, newest.bytes - oldest.bytes);
        const rawSpeed = timeDiff > 0 ? (bytesDiff * 8 / timeDiff) / 1000000 : 0;

        // Linear interpolation logic for constant animation speed
        // Limit the change to a maximum rate of 15 Mbps per 50ms interval (300 Mbps per second)
        const maxStep = 15;
        let diff = rawSpeed - currentSpeed;
        if (diff > maxStep) diff = maxStep;
        else if (diff < -maxStep) diff = -maxStep;

        currentSpeed += diff;
        animateToSpeed(currentSpeed, 50, true); // true for linear easing

        if (now - startTime >= durationMs) {
          clearInterval(interval);
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          // Calculate final mathematically exact average speed
          const totalDuration = (now - startTime) / 1000;
          const totalBytes = Math.max(0, currentBytes - initialBytes);
          const finalAvgSpeed = totalDuration > 0 ? (totalBytes * 8 / totalDuration) / 1000000 : 0;
          resolve(finalAvgSpeed);
        }
      }, 50); // Query stats every 50ms for live sensitivity
    });
  };

  const startTest = async () => {
    isTestingRef.current = true;
    if (isMountedRef.current) {
      setIsTesting(true);
      setDownloadSpeed(null);
      setUploadSpeed(null);
      setStatusText('Testing Download...');
    }
    animateToSpeed(0, 0); // instantly reset needle to 0
    
    const dSpeed = await runNativeSpeedTest('download', 15000); 
    if (!isTestingRef.current || !isMountedRef.current) return;
    
    // Reset needle to 0 smoothly before upload test
    animateToSpeed(0, 400);
    await new Promise(r => setTimeout(r, 500));
    if (!isTestingRef.current || !isMountedRef.current) return;
    
    if (isMountedRef.current) {
      setStatusText('Testing Upload...');
    }
    isTestingRef.current = true; // reset true for next phase
    const uSpeed = await runNativeSpeedTest('upload', 10000);
    if (!isTestingRef.current || !isMountedRef.current) return;
    animateToSpeed(0, 400); // return to 0 smoothly at the end
    
    // Set all results at the very end of the test!
    if (isMountedRef.current) {
      setDownloadSpeed(dSpeed);
      setUploadSpeed(uSpeed);
      setStatusText('Test Complete');
      setIsTesting(false);
      isTestingRef.current = false;
    }
  };

  const startPingTest = async () => {
    if (isMountedRef.current) {
      setPingTesting(true);
      setPingHistory([]);
    }
    pingAbortControllerRef.current = false;

    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let netProvider = 'Wi-Fi';
    try {
      netProvider = await getNetworkProvider();
    } catch(e) {}
    if (isMountedRef.current) {
      setPingTimeText(`${formattedTime}  ${netProvider}:`);
    }

    const targetHost = "8.8.8.8";
    const targetPort = 53;

    // Discard the first 3 trials to warm up JVM and cellular radio channel (bypass cold handshake spike)
    for (let i = 0; i < 3; i++) {
      await measurePingNative(targetHost, targetPort);
      if (pingAbortControllerRef.current) {
        if (isMountedRef.current) {
          setPingTesting(false);
        }
        return;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    const startTime = Date.now();
    const duration = 20000; // 20 seconds
    const intervalMs = 150; // ping every 150ms

    while (Date.now() - startTime < duration && !pingAbortControllerRef.current) {
      const p = await measurePingNative(targetHost, targetPort);
      if (p >= 0 && !pingAbortControllerRef.current && isMountedRef.current) {
        setPingHistory(prev => [...prev, p]);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    if (isMountedRef.current) {
      setPingTesting(false);
    }
  };

  const stopPingTest = () => {
    pingAbortControllerRef.current = true;
    if (isMountedRef.current) {
      setPingTesting(false);
    }
  };

  const getPingStats = () => {
    if (pingHistory.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, jitter: 0 };
    }
    const min = Math.min(...pingHistory);
    const max = Math.max(...pingHistory);
    const avg = pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length;
    
    const sorted = [...pingHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

    let sumDiff = 0;
    for (let i = 1; i < pingHistory.length; i++) {
      sumDiff += Math.abs(pingHistory[i] - pingHistory[i - 1]);
    }
    const jitter = pingHistory.length > 1 ? sumDiff / (pingHistory.length - 1) : 0;

    return { min, max, avg, median, jitter };
  };

  const { min, max, avg, median, jitter } = getPingStats();

  const handleButtonPress = () => {
    if (isTesting) {
      stopTest();
    } else {
      startTest();
    }
  };

  if (!hasPermission && activeTab === 'Overall') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, styles.activeTabButton]} 
            onPress={() => setActiveTab('Overall')}
          >
            <Text style={[styles.tabText, styles.activeTabText]}>Overall</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tabButton} 
            onPress={() => setActiveTab('Speed Test')}
          >
            <Text style={styles.tabText}>Speed Test</Text>
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
            <Speedometer animatedPercent={animatedPercent} animatedNeedlePercent={animatedNeedlePercent} />

            {/* Live testing status indicator */}
            {isTesting && (
              <Text style={styles.runningStatusText}>
                {statusText === 'Testing Download...' ? 'Testing download speed...' : 
                 statusText === 'Testing Upload...' ? 'Testing upload speed...' : 
                 statusText === 'Testing Ping...' ? 'Testing network latency...' : statusText}
              </Text>
            )}

            <View style={styles.actionContainer}>
              <TouchableOpacity 
                style={styles.testButtonWrapper} 
                onPress={handleButtonPress}
                activeOpacity={0.8}
              >
                <View style={[styles.testButton, isTesting && styles.testButtonActive]}>
                  <View style={styles.buttonContent}>
                    {isTesting ? (
                      <Feather name="square" size={20} color="#fff" style={{marginRight: 8}} />
                    ) : (
                      <Feather name="play" size={20} color="#fff" style={{marginRight: 8}} />
                    )}
                    <Text style={styles.testButtonText}>{isTesting ? 'Stop Test' : statusText}</Text>
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
                  <Feather name="arrow-down" size={24} color="#2ecc71" />
                  <Text style={styles.statLabel}>Download</Text>
                  <Text style={styles.statValue}>
                    {downloadSpeed !== null ? `${downloadSpeed.toFixed(2)} Mbps` : '--'}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Feather name="arrow-up" size={24} color="#e74c3c" />
                  <Text style={styles.statLabel}>Upload</Text>
                  <Text style={styles.statValue}>
                    {uploadSpeed !== null ? `${uploadSpeed.toFixed(2)} Mbps` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Spacer */}
            <View style={{ height: 20 }} />

            {/* Ping Diagnostics Card */}
            <View style={styles.metricsCard}>
              <View style={styles.providerRow}>
                <View style={[styles.providerIcon, { backgroundColor: 'rgba(52, 152, 219, 0.1)' }]}>
                  <MaterialIcons name="network-check" size={24} color="#3498db" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerTitle}>Ping Diagnostics</Text>
                  <Text style={styles.providerSubtitle}>Live Latency & Jitter Analysis</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {pingTimeText ? (
                <Text style={styles.pingMetaText}>{pingTimeText}</Text>
              ) : null}

              {/* Statistics row */}
              <View style={styles.pingStatsRow}>
                <View style={styles.pingStatItem}>
                  <Text style={styles.pingStatLabel}>min</Text>
                  <Text style={styles.pingStatValue}>{min > 0 ? `${min.toFixed(0)} ms` : '--'}</Text>
                </View>
                <View style={styles.pingStatItem}>
                  <Text style={styles.pingStatLabel}>avg</Text>
                  <Text style={styles.pingStatValue}>{avg > 0 ? `${avg.toFixed(1)} ms` : '--'}</Text>
                </View>
                <View style={styles.pingStatItem}>
                  <Text style={styles.pingStatLabel}>max</Text>
                  <Text style={styles.pingStatValue}>{max > 0 ? `${max.toFixed(0)} ms` : '--'}</Text>
                </View>
                <View style={[styles.pingStatItem, styles.medianHighlight]}>
                  <Text style={[styles.pingStatLabel, { color: '#fff' }]}>median</Text>
                  <Text style={[styles.pingStatValue, { color: '#fff', fontWeight: 'bold' }]}>{median > 0 ? `${median.toFixed(1)} ms` : '--'}</Text>
                </View>
                <View style={styles.pingStatItem}>
                  <Text style={styles.pingStatLabel}>jitter</Text>
                  <Text style={styles.pingStatValue}>{jitter > 0 ? `${jitter.toFixed(1)} ms` : '--'}</Text>
                </View>
              </View>

              {/* Chart container */}
              <View style={styles.pingChartContainer}>
                <Svg width={graphWidth} height={120}>
                  {/* Grid Lines */}
                  <Line x1={0} y1={30} x2={graphWidth} y2={30} stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1} />
                  <Line x1={0} y1={60} x2={graphWidth} y2={60} stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1} />
                  <Line x1={0} y1={90} x2={graphWidth} y2={90} stroke="rgba(255, 255, 255, 0.05)" strokeWidth={1} />
                  
                  {/* Vertical lines */}
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const x = (idx / 9) * graphWidth;
                    return (
                      <Line key={idx} x1={x} y1={0} x2={x} y2={120} stroke="rgba(255, 255, 255, 0.03)" strokeWidth={1} />
                    );
                  })}

                  {/* Draw Ping Curve */}
                  {pingHistory.length > 0 && (
                    <Path
                      d={(() => {
                        const maxVal = Math.max(100, max * 1.2);
                        return pingHistory.map((val, idx) => {
                          const x = (idx / Math.max(60, pingHistory.length)) * graphWidth;
                          const y = 120 - (val / maxVal) * 110;
                          return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                      })()}
                      fill="none"
                      stroke="#e74c3c"
                      strokeWidth={2}
                    />
                  )}
                </Svg>
              </View>

              {/* Button wrapper */}
              <View style={{ alignItems: 'center', marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.pingTestButton, pingTesting && styles.pingTestButtonActive]}
                  onPress={pingTesting ? stopPingTest : startPingTest}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonContent}>
                    <Feather name={pingTesting ? "square" : "play"} size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.pingButtonText}>
                      {pingTesting ? 'Stop Diagnostic' : 'Start Ping Test'}
                    </Text>
                  </View>
                </TouchableOpacity>
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
    paddingTop: 16,
    paddingBottom: 100,
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
    backgroundColor: '#8e44ad',
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
    bottom: 30,
    alignItems: 'center',
  },
  speedValueText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '300',
    letterSpacing: -1,
  },
  speedUnitText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
  },
  runningStatusText: {
    color: '#8e44ad',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  actionContainer: {
    marginVertical: 24,
    width: '100%',
    alignItems: 'center',
  },
  testButtonWrapper: {
    borderRadius: 30,
    shadowColor: '#8e44ad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  testButton: {
    backgroundColor: '#8e44ad',
    width: 200,
    height: 56,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  testButtonActive: {
    backgroundColor: '#c0392b',
    shadowColor: '#e74c3c',
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
    backgroundColor: 'rgba(142, 68, 173, 0.1)',
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
  pingMetaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  pingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  pingStatItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  medianHighlight: {
    backgroundColor: '#38BCBC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pingStatLabel: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 2,
  },
  pingStatValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pingChartContainer: {
    height: 130,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingTestButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingTestButtonActive: {
    backgroundColor: '#c0392b',
  },
  pingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
