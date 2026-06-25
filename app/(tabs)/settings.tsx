import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Switch, Text, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StorageService, UserSettings, DEFAULT_SETTINGS } from '@/services/storage';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await StorageService.getSettings();
    setSettings(s);
  };

  const saveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    await StorageService.saveSettings(newSettings);
  };

  const handleClearData = async () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to delete all battery history data?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: async () => {
            await StorageService.clearLogs();
            Alert.alert("Success", "History cleared.");
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Battery Alarm</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Enable Charge Alarm</Text>
            <Switch
              value={settings.alarmEnabled}
              onValueChange={(val) => saveSettings({ ...settings, alarmEnabled: val })}
            />
          </View>
          
          <View style={[styles.row, { opacity: settings.alarmEnabled ? 1 : 0.5 }]}>
            <Text style={styles.label}>Target Level (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={settings.alarmLevel.toString()}
              editable={settings.alarmEnabled}
              onChangeText={(text) => {
                const val = parseInt(text);
                if (!isNaN(val) && val >= 0 && val <= 100) {
                  saveSettings({ ...settings, alarmLevel: val });
                }
              }}
            />
          </View>
          <Text style={styles.hint}>Receive a notification when battery reaches this level.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temperature Warning</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Enable Temp Warning</Text>
            <Switch
              value={settings.tempWarningEnabled}
              onValueChange={(val) => saveSettings({ ...settings, tempWarningEnabled: val })}
            />
          </View>
          
          <View style={[styles.row, { opacity: settings.tempWarningEnabled ? 1 : 0.5 }]}>
            <Text style={styles.label}>Threshold (°C)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={settings.tempWarningThreshold.toString()}
              editable={settings.tempWarningEnabled}
              onChangeText={(text) => {
                const val = parseInt(text);
                if (!isNaN(val) && val >= 0 && val <= 100) {
                  saveSettings({ ...settings, tempWarningThreshold: val });
                }
              }}
            />
          </View>
          <Text style={styles.hint}>Receive a notification if battery gets too hot.</Text>
        </View>

        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <Text style={[styles.hint, { marginBottom: 16 }]}>
            Clear all logged history data (charts will be reset).
          </Text>
          <View style={styles.button} onTouchEnd={handleClearData}>
            <Text style={styles.buttonText}>Clear History Data</Text>
          </View>
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
    paddingVertical: 48,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#ccc',
    fontSize: 16,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    width: 60,
    textAlign: 'center',
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
