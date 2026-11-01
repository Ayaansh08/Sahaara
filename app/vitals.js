/**
 * app/vitals.js
 * Sahaara Vitals Screen — Smartwatch Health Monitoring & Emergency Event Detection.
 * 
 * Features:
 * 1. Android Health Connect synchronization for smartwatch metrics (Heart Rate, SpO2, BP, Respiratory Rate).
 * 2. Real-time data freshness, measurement timestamps vs sync timestamps.
 * 3. Critical Event Detection engine evaluation.
 * 4. Hackathon Demo Mode for simulating normal and critical sensor events with zero real WhatsApp dispatch.
 * 5. Automatic SOS emergency countdown modal integration.
 * 6. Senior-first, Kanjeevaram silk-and-gold warmth, high contrast typography.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from '../context/LanguageContext';
import {
  colors,
  spacing,
  radius,
  sizes,
  border,
  fonts,
  textStyle,
} from '../constants/theme';
import {
  checkHealthConnectAvailability,
  getGrantedVitalsPermissions,
  requestVitalsPermissions,
  openHealthConnectSettings,
  fetchLatestVitals,
  fetchVitalsTrends,
  VITALS_PERMISSIONS,
} from '../services/healthConnectService';
import {
  evaluateVitalsSnapshot,
  evaluateReading,
  normalizeReading,
  VITALS_STATUS,
  FRESHNESS_STATUS,
  calculateFreshness,
} from '../services/vitalsEngine';
import VitalsEmergencyModal from '../components/VitalsEmergencyModal';
import { vitalsConfig } from '../config/vitalsRules';

const STORAGE_KEY_OPT_IN = '@sahaara_vitals_auto_sos_opt_in';

export default function VitalsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  // Health Connect status
  const [hcAvailability, setHcAvailability] = useState(null);
  const [grantedPermissions, setGrantedPermissions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [detectedSources, setDetectedSources] = useState([]);

  // Vitals readings map: { [metricType]: normalizedReading }
  const [vitalsMap, setVitalsMap] = useState({});
  const [evaluationSummary, setEvaluationSummary] = useState(null);

  // Automatic SOS Opt-in
  const [autoSosEnabled, setAutoSosEnabled] = useState(true);

  // Trends filter: 'today' | '7days' | '30days'
  const [trendFilter, setTrendFilter] = useState('today');
  const [heartTrends, setHeartTrends] = useState([]);
  const [spo2Trends, setSpo2Trends] = useState([]);

  // Emergency Modal State
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [criticalEvent, setCriticalEvent] = useState(null);
  const [isDemoEmergency, setIsDemoEmergency] = useState(false);

  // Demo Mode State
  const [isDemoModeActive, setIsDemoModeActive] = useState(false);

  // Double trigger protection & history cache across sync cycles
  const lastAutoSosTimeRef = useRef(0);
  const vitalsHistoryRef = useRef({});

  // Load preferences
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_OPT_IN);
        if (stored !== null) {
          setAutoSosEnabled(stored === 'true');
        }
      } catch (_) {}
    })();
  }, []);

  const handleToggleAutoSos = async (val) => {
    setAutoSosEnabled(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_OPT_IN, String(val));
    } catch (_) {}
  };

  // Sync / Refresh function
  const synchronizeVitals = useCallback(async () => {
    if (isDemoModeActive) return; // Keep demo data intact while demo mode is active

    setIsRefreshing(true);
    try {
      const avail = await checkHealthConnectAvailability();
      setHcAvailability(avail);

      if (avail.isAvailable) {
        const granted = await getGrantedVitalsPermissions();
        setGrantedPermissions(granted);

        const data = await fetchLatestVitals({ lookbackHours: 24 });
        setVitalsMap(data.vitals || {});
        setDetectedSources(data.sources || []);
        setLastSyncTime(data.lastSyncTime || Date.now());

        // Merge newly fetched history with in-memory history buffer within emergencyMaxAgeMs
        const now = Date.now();
        const cutoff = now - vitalsConfig.emergencyMaxAgeMs;
        const mergedHistory = {};

        const metricKeys = ['heartRate', 'spo2', 'bloodPressure', 'respiratoryRate', 'restingHeartRate'];
        for (const metric of metricKeys) {
          const fromService = (data.history && data.history[metric]) || [];
          const fromRef = vitalsHistoryRef.current[metric] || [];
          const combined = [...fromService, ...fromRef].filter(r => r && r.timestamp >= cutoff);
          const seen = new Set();
          const unique = [];
          for (const item of combined) {
            if (!seen.has(item.timestamp)) {
              seen.add(item.timestamp);
              unique.push(item);
            }
          }
          unique.sort((a, b) => b.timestamp - a.timestamp);
          mergedHistory[metric] = unique;
        }

        // Evaluate snapshot with complete history
        const summary = evaluateVitalsSnapshot(data.vitals || {}, mergedHistory, {
          userOptedIn: autoSosEnabled,
        });
        setEvaluationSummary(summary);

        // Update history cache for subsequent sync cycles
        for (const [metric, reading] of Object.entries(data.vitals || {})) {
          if (reading && reading.timestamp >= cutoff) {
            const list = mergedHistory[metric] || [];
            if (!list.some(r => r.timestamp === reading.timestamp)) {
              mergedHistory[metric] = [reading, ...list].sort((a, b) => b.timestamp - a.timestamp);
            }
          }
        }
        vitalsHistoryRef.current = mergedHistory;

        // Fetch real trends
        const hrTrend = await fetchVitalsTrends('heartRate', trendFilter);
        const o2Trend = await fetchVitalsTrends('spo2', trendFilter);
        setHeartTrends(hrTrend);
        setSpo2Trends(o2Trend);

        // Check if genuine critical event detected (with cooldown protection)
        if (summary.canTriggerSos && !summary.isDemo) {
          const nowTime = Date.now();
          if (nowTime - lastAutoSosTimeRef.current > vitalsConfig.emergencyCooldownMs) {
            lastAutoSosTimeRef.current = nowTime;
            setCriticalEvent(summary.criticalCandidate);
            setIsDemoEmergency(false);
            setEmergencyModalVisible(true);
          }
        }
      } else {
        setVitalsMap({});
        setEvaluationSummary(null);
      }
    } catch (err) {
      console.warn('[VitalsScreen] Sync error:', err.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [isDemoModeActive, autoSosEnabled, trendFilter]);

  // Initial mount & AppState listener & periodic poll (sync while user is active on screen)
  useEffect(() => {
    synchronizeVitals();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        synchronizeVitals();
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && !isDemoModeActive) {
        synchronizeVitals();
      }
    }, 30000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [synchronizeVitals, isDemoModeActive]);

  // Handle permission request
  const handleRequestPermissions = async () => {
    const result = await requestVitalsPermissions();
    if (result.success) {
      synchronizeVitals();
    } else {
      Alert.alert(
        isHindi ? 'अनुमति सूचना' : 'Permissions',
        isHindi
          ? 'हेल्थ कनेक्ट में अनुमतियां प्रबंधित करने के लिए सेटिंग्स खोलें।'
          : 'Please open Health Connect settings to enable health permissions.'
      );
    }
  };

  // --- DEMO MODE HANDLERS ---

  const handleSimulateNormal = () => {
    setIsDemoModeActive(true);
    const now = Date.now();
    const demoVitals = {
      heartRate: normalizeReading({
        metricType: 'heartRate',
        value: 74,
        unit: 'BPM',
        timestamp: now - 2 * 60 * 1000,
        source: 'Smartwatch (Simulator)',
        isDemo: true,
      }),
      spo2: normalizeReading({
        metricType: 'spo2',
        value: 98,
        unit: '%',
        timestamp: now - 3 * 60 * 1000,
        source: 'Smartwatch (Simulator)',
        isDemo: true,
      }),
      bloodPressure: normalizeReading({
        metricType: 'bloodPressure',
        value: { systolic: 118, diastolic: 76 },
        unit: 'mmHg',
        timestamp: now - 5 * 60 * 1000,
        source: 'Smartwatch (Simulator)',
        isDemo: true,
      }),
      respiratoryRate: normalizeReading({
        metricType: 'respiratoryRate',
        value: 16,
        unit: 'breaths/min',
        timestamp: now - 10 * 60 * 1000,
        source: 'Smartwatch (Simulator)',
        isDemo: true,
      }),
    };

    setVitalsMap(demoVitals);
    setDetectedSources(['Demo Smartwatch']);
    setLastSyncTime(now);

    const summary = evaluateVitalsSnapshot(demoVitals, {}, { userOptedIn: autoSosEnabled });
    setEvaluationSummary(summary);
  };

  const handleSimulateCriticalHeartRate = () => {
    setIsDemoModeActive(true);
    const now = Date.now();
    const reading = normalizeReading({
      metricType: 'heartRate',
      value: 152,
      unit: 'BPM',
      timestamp: now,
      source: 'Smartwatch (Simulator)',
      isDemo: true,
    });

    const demoVitals = {
      ...vitalsMap,
      heartRate: reading,
    };

    setVitalsMap(demoVitals);
    setDetectedSources(['Demo Smartwatch']);
    setLastSyncTime(now);

    const evaluation = evaluateReading(reading, [], { userOptedIn: autoSosEnabled });
    setCriticalEvent(evaluation);
    setIsDemoEmergency(true);
    setEmergencyModalVisible(true);
  };

  const handleSimulateCriticalSpO2 = () => {
    setIsDemoModeActive(true);
    const now = Date.now();
    const reading = normalizeReading({
      metricType: 'spo2',
      value: 86,
      unit: '%',
      timestamp: now,
      source: 'Smartwatch (Simulator)',
      isDemo: true,
    });

    const demoVitals = {
      ...vitalsMap,
      spo2: reading,
    };

    setVitalsMap(demoVitals);
    setDetectedSources(['Demo Smartwatch']);
    setLastSyncTime(now);

    const evaluation = evaluateReading(reading, [], { userOptedIn: autoSosEnabled });
    setCriticalEvent(evaluation);
    setIsDemoEmergency(true);
    setEmergencyModalVisible(true);
  };

  const handleResetDemo = () => {
    setIsDemoModeActive(false);
    setVitalsMap({});
    setEvaluationSummary(null);
    setDetectedSources([]);
    synchronizeVitals();
  };

  // Helper to format time relative or clock
  const formatTimeAgo = (ts) => {
    if (!ts) return 'Never';
    const ageSec = Math.round((Date.now() - ts) / 1000);
    if (ageSec < 60) return `${ageSec}s ago`;
    if (ageSec < 3600) return `${Math.round(ageSec / 60)}m ago`;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasAnyVitals = Object.keys(vitalsMap).length > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={isHindi ? 'स्वास्थ्य और वाइटल्स' : 'Vitals'}
        showBack={true}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SUBHEADER: DESCRIPTION & SYNC STATUS */}
        <View style={styles.subHeaderBox}>
          <Text style={[textStyle('body', lang, colors.inkSoft), styles.subHeaderDesc]}>
            {isHindi
              ? 'अपनी कनेक्टेड स्मार्टवॉच से हृदय गति और स्वास्थ्य माप की निगरानी करें।'
              : 'Monitor health readings from your connected smartwatch and health ecosystem.'}
          </Text>
          <View style={styles.syncRow}>
            <View style={[
              styles.connectionDot,
              hcAvailability?.isAvailable ? styles.dotGreen : styles.dotAmber,
              isDemoModeActive && styles.dotBlue,
            ]} />
            <Text style={[textStyle('label', lang, colors.inkSoft), styles.syncTimeText]}>
              {isDemoModeActive
                ? '[DEMO MODE ACTIVE]'
                : lastSyncTime
                ? `Last synced: ${formatTimeAgo(lastSyncTime)}`
                : 'Not synced yet'}
            </Text>
          </View>
        </View>

        {/* CONNECTED DEVICE / HEALTH CONNECT CARD */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceCardHeader}>
            <Ionicons
              name={hcAvailability?.isAvailable ? 'watch' : 'hardware-chip-outline'}
              size={26}
              color={colors.primary}
            />
            <Text style={[textStyle('heading', lang, colors.primary), styles.deviceCardTitle]}>
              {isHindi ? 'कनेक्टेड डिवाइस और स्रोत' : 'Connected Device & Source'}
            </Text>
          </View>

          <View style={styles.deviceDetailRow}>
            <Text style={[textStyle('label', lang, colors.inkSoft), styles.detailKey]}>
              {isHindi ? 'सिंक सेवा:' : 'Integration Layer:'}
            </Text>
            <Text style={[textStyle('label', lang, colors.ink), styles.detailVal]}>
              Android Health Connect
            </Text>
          </View>

          <View style={styles.deviceDetailRow}>
            <Text style={[textStyle('label', lang, colors.inkSoft), styles.detailKey]}>
              {isHindi ? 'डेटा स्रोत:' : 'Data Source:'}
            </Text>
            <Text style={[textStyle('label', lang, colors.ink), styles.detailVal]}>
              {detectedSources.length > 0
                ? detectedSources.join(', ')
                : (isHindi ? 'कोई कनेक्टेड स्रोत नहीं मिला' : 'No watch companion synced')}
            </Text>
          </View>

          <View style={styles.deviceDetailRow}>
            <Text style={[textStyle('label', lang, colors.inkSoft), styles.detailKey]}>
              {isHindi ? 'स्थिति:' : 'Status:'}
            </Text>
            <Text style={[
              textStyle('label', lang, colors.ink),
              styles.detailVal,
              hcAvailability?.isAvailable ? styles.statusGreen : styles.statusAmber,
            ]}>
              {isDemoModeActive
                ? 'Simulated Mode'
                : hcAvailability?.isAvailable
                ? 'Health Connect Ready'
                : (hcAvailability?.message || 'Checking...')}
            </Text>
          </View>

          {/* Action Row */}
          <View style={styles.deviceBtnRow}>
            <TouchableOpacity
              style={[styles.btnAction, { backgroundColor: colors.primary }]}
              onPress={synchronizeVitals}
              activeOpacity={0.85}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                  <Text style={[textStyle('button', lang, colors.onPrimary), styles.btnActionText]}>
                    {isHindi ? 'रिफ्रेश' : 'Refresh'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnAction, { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line }]}
              onPress={handleRequestPermissions}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-outline" size={18} color={colors.ink} style={{ marginRight: 6 }} />
              <Text style={[textStyle('button', lang, colors.ink), styles.btnActionText]}>
                {isHindi ? 'अनुमतियां' : 'Permissions'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* VITALS OVERVIEW SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[textStyle('heading', lang, colors.ink), styles.sectionTitle]}>
            {isHindi ? 'स्वास्थ्य माप' : 'Current Vitals'}
          </Text>
          {evaluationSummary && (
            <View style={[
              styles.overallBadge,
              evaluationSummary.overallStatus === VITALS_STATUS.NORMAL && styles.badgeGreen,
              evaluationSummary.overallStatus === VITALS_STATUS.ATTENTION && styles.badgeAmber,
              evaluationSummary.overallStatus === VITALS_STATUS.CRITICAL && styles.badgeRed,
            ]}>
              <Text style={styles.overallBadgeText}>
                {evaluationSummary.overallStatus}
              </Text>
            </View>
          )}
        </View>

        {!hasAnyVitals ? (
          <View style={styles.emptyCard}>
            <Ionicons name="fitness-outline" size={36} color={colors.inkSoft} style={{ marginBottom: 8 }} />
            <Text style={[textStyle('heading', lang, colors.ink), styles.emptyTitle]}>
              {isHindi ? 'कोई सक्रिय स्वास्थ्य माप उपलब्ध नहीं' : 'No Vitals Measurements Synced'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.emptySub]}>
              {isHindi
                ? 'सुनिश्चित करें कि आपकी स्मार्टवॉच का ऐप (जैसे Samsung Health या Google Fit) हेल्थ कनेक्ट के साथ सिंक कर रहा है। या नीचे डेमो मोड आज़माएं।'
                : 'Connect your watch companion app (e.g. Samsung Health, Pixel Watch) to Health Connect, or use the Demo Simulator below.'}
            </Text>
          </View>
        ) : (
          <View style={styles.vitalsGrid}>
            {/* 1. HEART RATE CARD */}
            {vitalsMap.heartRate ? (
              <VitalsMetricCard
                title={isHindi ? 'हृदय गति' : 'Heart Rate'}
                icon="heart"
                value={`${vitalsMap.heartRate.value}`}
                unit={vitalsMap.heartRate.unit}
                reading={vitalsMap.heartRate}
                evaluation={evaluationSummary?.evaluations?.heartRate}
                lang={lang}
              />
            ) : null}

            {/* 2. BLOOD OXYGEN (SpO2) CARD */}
            {vitalsMap.spo2 ? (
              <VitalsMetricCard
                title={isHindi ? 'रक्त ऑक्सीजन' : 'Blood Oxygen (SpO2)'}
                icon="water"
                value={`${vitalsMap.spo2.value}`}
                unit={vitalsMap.spo2.unit}
                reading={vitalsMap.spo2}
                evaluation={evaluationSummary?.evaluations?.spo2}
                lang={lang}
              />
            ) : null}

            {/* 3. BLOOD PRESSURE CARD */}
            {vitalsMap.bloodPressure ? (
              <VitalsMetricCard
                title={isHindi ? 'रक्तचाप' : 'Blood Pressure'}
                icon="pulse"
                value={`${vitalsMap.bloodPressure.value?.systolic}/${vitalsMap.bloodPressure.value?.diastolic}`}
                unit={vitalsMap.bloodPressure.unit}
                reading={vitalsMap.bloodPressure}
                evaluation={evaluationSummary?.evaluations?.bloodPressure}
                lang={lang}
              />
            ) : null}

            {/* 4. RESPIRATORY RATE CARD */}
            {vitalsMap.respiratoryRate ? (
              <VitalsMetricCard
                title={isHindi ? 'श्वास दर' : 'Respiratory Rate'}
                icon="leaf"
                value={`${vitalsMap.respiratoryRate.value}`}
                unit={vitalsMap.respiratoryRate.unit}
                reading={vitalsMap.respiratoryRate}
                evaluation={evaluationSummary?.evaluations?.respiratoryRate}
                lang={lang}
              />
            ) : null}

            {/* 5. RESTING HEART RATE CARD */}
            {vitalsMap.restingHeartRate ? (
              <VitalsMetricCard
                title={isHindi ? 'विश्राम हृदय गति' : 'Resting Heart Rate'}
                icon="bed"
                value={`${vitalsMap.restingHeartRate.value}`}
                unit={vitalsMap.restingHeartRate.unit}
                reading={vitalsMap.restingHeartRate}
                evaluation={evaluationSummary?.evaluations?.restingHeartRate}
                lang={lang}
              />
            ) : null}
          </View>
        )}

        {/* TRENDS SECTION */}
        <View style={styles.trendsContainer}>
          <View style={styles.trendsHeaderRow}>
            <Text style={[textStyle('heading', lang, colors.ink), styles.sectionTitle]}>
              {isHindi ? 'स्वास्थ्य रुझान' : 'Vitals Trends'}
            </Text>
            <View style={styles.filterPillsRow}>
              {['today', '7days', '30days'].map((filterKey) => (
                <TouchableOpacity
                  key={filterKey}
                  style={[
                    styles.filterPill,
                    trendFilter === filterKey && styles.filterPillActive,
                  ]}
                  onPress={() => setTrendFilter(filterKey)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.filterPillText,
                    trendFilter === filterKey && styles.filterPillTextActive,
                  ]}>
                    {filterKey === 'today' ? 'Today' : filterKey === '7days' ? '7 Days' : '30 Days'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {heartTrends.length === 0 && spo2Trends.length === 0 ? (
            <View style={styles.trendsNoticeBox}>
              <Ionicons name="bar-chart-outline" size={24} color={colors.inkSoft} style={{ marginRight: 8 }} />
              <Text style={[textStyle('body', lang, colors.inkSoft), styles.trendsNoticeText]}>
                {isHindi
                  ? 'रुझान चार्ट के लिए अभी पर्याप्त ऐतिहासिक डेटा नहीं है। समय के साथ रीडिंग यहाँ दिखाई देंगी।'
                  : 'Insufficient historical readings for trend visualization. Readings will accumulate as your watch syncs over time.'}
              </Text>
            </View>
          ) : (
            <View style={styles.trendsDataBox}>
              <Text style={[textStyle('label', lang, colors.ink), { fontWeight: '700' }]}>
                Heart Rate Points: {heartTrends.length} | SpO2 Points: {spo2Trends.length}
              </Text>
            </View>
          )}
        </View>

        {/* AUTOMATIC SOS OPT-IN PREFERENCE */}
        <View style={styles.preferenceCard}>
          <View style={styles.prefTextCol}>
            <Text style={[textStyle('heading', lang, colors.ink), styles.prefTitle]}>
              {isHindi ? 'स्वचालित आपातकालीन अलर्ट' : 'Automatic Emergency Alerts'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.prefSub]}>
              {isHindi
                ? 'स्मार्टवॉच से गंभीर रीडिंग पाए जाने पर संरक्षकों को अलर्ट करें।'
                : 'Trigger emergency SOS sequence when consecutive critical vitals are detected.'}
            </Text>
          </View>
          <Switch
            value={autoSosEnabled}
            onValueChange={handleToggleAutoSos}
            trackColor={{ false: colors.paper, true: colors.calm }}
            thumbColor={autoSosEnabled ? colors.primary : colors.line}
          />
        </View>

        {/* HACKATHON DEMO SIMULATOR SECTION */}
        <View style={styles.demoSection}>
          <View style={styles.demoHeaderRow}>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>HACKATHON DEMO SIMULATOR</Text>
            </View>
          </View>
          <Text style={[textStyle('body', lang, colors.inkSoft), styles.demoDesc]}>
            Test smartwatch integration, critical-event evaluation, and automatic SOS dispatch with synthetic sensor data. Zero real WhatsApp messages are sent.
          </Text>

          <View style={styles.demoButtonsGrid}>
            <TouchableOpacity
              style={[styles.demoBtn, { backgroundColor: colors.paperDeep, borderColor: colors.line }]}
              onPress={handleSimulateNormal}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-done" size={20} color={colors.forest} style={{ marginRight: 6 }} />
              <Text style={[textStyle('button', lang, colors.ink), styles.demoBtnText]}>
                Simulate Normal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
              onPress={handleSimulateCriticalHeartRate}
              activeOpacity={0.85}
            >
              <Ionicons name="pulse" size={20} color={colors.crimson} style={{ marginRight: 6 }} />
              <Text style={[textStyle('button', lang, colors.crimson), styles.demoBtnText]}>
                Simulate Critical HR (152 BPM)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
              onPress={handleSimulateCriticalSpO2}
              activeOpacity={0.85}
            >
              <Ionicons name="water" size={20} color={colors.crimson} style={{ marginRight: 6 }} />
              <Text style={[textStyle('button', lang, colors.crimson), styles.demoBtnText]}>
                Simulate Critical SpO2 (86%)
              </Text>
            </TouchableOpacity>

            {isDemoModeActive && (
              <TouchableOpacity
                style={[styles.demoBtn, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}
                onPress={handleResetDemo}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-undo" size={20} color={colors.ink} style={{ marginRight: 6 }} />
                <Text style={[textStyle('button', lang, colors.ink), styles.demoBtnText]}>
                  Reset Demo Data
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* CLINICAL DISCLAIMER */}
        <View style={styles.disclaimerContainer}>
          <Text style={[textStyle('label', lang, colors.inkSoft), styles.disclaimer]}>
            ⚠️ {isHindi
              ? 'सहारा एक चिकित्सीय निदान उपकरण नहीं है। पहनने योग्य उपकरणों की माप में त्रुटि संभव है। किसी भी स्वास्थ्य निर्णय के लिए चिकित्सक से परामर्श लें।'
              : 'SAHAARA is an informational safety companion, not a medical diagnostic device. Wearable measurements may contain sensor inaccuracies. Consult a healthcare professional for clinical advice.'}
          </Text>
        </View>
      </ScrollView>

      {/* EMERGENCY COUNTDOWN & SOS MODAL */}
      <VitalsEmergencyModal
        visible={emergencyModalVisible}
        onClose={() => setEmergencyModalVisible(false)}
        criticalEvaluation={criticalEvent}
        isDemo={isDemoEmergency}
        onAlertCancelled={() => {
          Alert.alert(
            isHindi ? 'अलर्ट रद्द' : 'Alert Cancelled',
            isHindi
              ? 'आपातकालीन अलर्ट रद्द कर दिया गया। कोई संदेश नहीं भेजा गया।'
              : 'Emergency alert was cancelled. No messages were dispatched.'
          );
        }}
        onAlertDispatched={(res) => {
          console.log('[VitalsScreen] SOS dispatch finished:', res?.overallStatus);
        }}
      />
    </View>
  );
}

/**
 * Reusable Metric Card
 */
function VitalsMetricCard({ title, icon, value, unit, reading, evaluation, lang }) {
  const isHindi = lang === 'hi';
  const status = evaluation?.status || VITALS_STATUS.NORMAL;
  const freshness = reading?.freshness || calculateFreshness(reading?.timestamp);

  return (
    <View style={[
      styles.metricCard,
      status === VITALS_STATUS.ATTENTION && styles.cardAttention,
      status === VITALS_STATUS.CRITICAL && styles.cardCritical,
    ]}>
      <View style={styles.metricCardHeader}>
        <View style={styles.metricIconWrap}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <Text style={[textStyle('heading', lang, colors.ink), styles.metricTitle]}>
          {title}
        </Text>
        {reading?.isDemo && (
          <View style={styles.demoPill}>
            <Text style={styles.demoPillText}>DEMO</Text>
          </View>
        )}
      </View>

      <View style={styles.metricValueRow}>
        <Text style={[textStyle('display', lang, colors.ink), styles.metricNum]}>
          {value}
        </Text>
        <Text style={[textStyle('body', lang, colors.inkSoft), styles.metricUnitText]}>
          {unit}
        </Text>
      </View>

      <View style={styles.metricFooterRow}>
        <Text style={[textStyle('label', lang, colors.inkSoft), styles.metricTimeText]}>
          {freshness.label} • {new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <View style={[
          styles.metricStatusPill,
          status === VITALS_STATUS.NORMAL && styles.pillGreen,
          status === VITALS_STATUS.ATTENTION && styles.pillAmber,
          status === VITALS_STATUS.CRITICAL && styles.pillRed,
        ]}>
          <Text style={styles.metricStatusPillText}>{status}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    padding: spacing.md,
  },
  subHeaderBox: {
    marginBottom: spacing.md,
  },
  subHeaderDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotGreen: { backgroundColor: colors.forest },
  dotAmber: { backgroundColor: colors.gold },
  dotBlue: { backgroundColor: '#3B82F6' },
  syncTimeText: {
    fontSize: 12,
  },
  deviceCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  deviceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailKey: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusGreen: { color: colors.forest },
  statusAmber: { color: '#B45309' },
  deviceBtnRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.pill,
  },
  btnActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  overallBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeGreen: { backgroundColor: '#DCFCE7' },
  badgeAmber: { backgroundColor: '#FEF3C7' },
  badgeRed: { backgroundColor: '#FEE2E2' },
  overallBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  vitalsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metricCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardAttention: {
    borderColor: colors.gold,
    backgroundColor: '#FFFBEB',
  },
  cardCritical: {
    borderColor: colors.crimson,
    backgroundColor: '#FEF2F2',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  metricTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  demoPill: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3730A3',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing.xs,
  },
  metricNum: {
    fontSize: 32,
    fontWeight: '800',
    marginRight: 6,
  },
  metricUnitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  metricTimeText: {
    fontSize: 11,
  },
  metricStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillGreen: { backgroundColor: '#DCFCE7' },
  pillAmber: { backgroundColor: '#FEF3C7' },
  pillRed: { backgroundColor: '#FEE2E2' },
  metricStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  trendsContainer: {
    marginBottom: spacing.lg,
  },
  trendsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.paperDeep,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.ink,
  },
  filterPillTextActive: {
    color: colors.onPrimary,
  },
  trendsNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trendsNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  trendsDataBox: {
    padding: spacing.md,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  preferenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  prefTextCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  prefSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  demoSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: spacing.lg,
  },
  demoHeaderRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  demoBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  demoBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  demoDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  demoButtonsGrid: {
    gap: spacing.xs,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  disclaimerContainer: {
    paddingVertical: spacing.md,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
