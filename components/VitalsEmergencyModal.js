/**
 * components/VitalsEmergencyModal.js
 * Senior-first, high-contrast emergency countdown & SOS orchestration modal for Vitals.
 * 
 * Safety Features:
 * 1. 10-second visible countdown with prominent "Cancel Alert" button.
 * 2. Explicit disclaimer: Wearable readings can be inaccurate; SAHAARA is not a medical diagnostic device.
 * 3. Clear [DEMO DATA] badge and isolation during simulated testing (zero real messages dispatched).
 * 4. Preserves foreground GPS location capture and Firestore incident logging.
 * 5. Reuses existing SAHAARA SOS workflow and manual WhatsApp fallback cards.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  AppState,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
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
import { sendSOS } from '../services/sos';
import { vitalsConfig } from '../config/vitalsRules';

export default function VitalsEmergencyModal({
  visible,
  onClose,
  criticalEvaluation = null,
  isDemo = false,
  onAlertCancelled = () => {},
  onAlertDispatched = () => {},
}) {
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  // Stages: 'countdown' | 'dispatching' | 'result' | 'cancelled'
  const [stage, setStage] = useState('countdown');
  const [secondsLeft, setSecondsLeft] = useState(vitalsConfig.emergencyCountdownSeconds || 10);
  const [sosResult, setSosResult] = useState(null);
  const [manualStates, setManualStates] = useState({});
  const activeOpenContactRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isDispatchingRef = useRef(false);

  // AppState listener for WhatsApp return detection
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && activeOpenContactRef.current) {
        const targetKey = activeOpenContactRef.current;
        setManualStates((prev) => ({
          ...prev,
          [targetKey]: 'returned',
        }));
        activeOpenContactRef.current = null;
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize countdown when modal becomes visible
  useEffect(() => {
    if (visible && criticalEvaluation) {
      setStage('countdown');
      const startSecs = vitalsConfig.emergencyCountdownSeconds || 10;
      setSecondsLeft(startSecs);
      setSosResult(null);
      setManualStates({});
      isDispatchingRef.current = false;

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      let remaining = startSecs;
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setSecondsLeft(0);
          handleDispatchSOS();
        } else {
          setSecondsLeft(remaining);
        }
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      isDispatchingRef.current = false;
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [visible]);

  // Cancel Handler
  const handleCancel = async () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    isDispatchingRef.current = false;

    setStage('cancelled');

    // Record user cancellation in Firestore for auditability
    try {
      if (db) {
        const user = auth.currentUser;
        await addDoc(collection(db, 'sos_alerts'), {
          userId: user?.uid || 'unknown',
          userEmail: user?.email || 'unknown@sahaara.app',
          userName: user?.displayName || 'Elder',
          status: 'CANCELLED_BY_USER',
          overallStatus: 'CANCELLED_BY_USER',
          isDemo: Boolean(isDemo),
          reason: 'vitals_critical',
          metric: criticalEvaluation?.reading || null,
          message: isDemo
            ? '[DEMO DATA] Simulated vitals alert cancelled by senior during countdown'
            : 'Vitals critical alert cancelled by senior during countdown (User indicated okay)',
          timestamp: serverTimestamp(),
          provider: isDemo ? 'demo_isolated_simulator' : 'whatsgateway',
          sosDispatched: false,
        });
      }
    } catch (err) {
      console.log('[Vitals SOS] Cancellation log note:', err.message);
    }

    onAlertCancelled();
  };

  // Dispatch SOS Workflow (protected against duplicate invocations)
  const handleDispatchSOS = async () => {
    if (isDispatchingRef.current) {
      console.log('[Vitals SOS] Dispatch already in progress. Ignoring duplicate trigger.');
      return;
    }
    isDispatchingRef.current = true;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setStage('dispatching');

    try {
      const reading = criticalEvaluation?.reading;
      const metricInfo = reading
        ? `${reading.metricType}: ${typeof reading.value === 'object' ? `${reading.value.systolic}/${reading.value.diastolic}` : reading.value} ${reading.unit}`
        : null;

      const result = await sendSOS({
        reason: 'vitals_critical',
        isDemo: Boolean(isDemo),
        demoMetric: metricInfo,
        vitalsDetail: metricInfo,
      });

      setSosResult(result);
      setStage('result');
      onAlertDispatched(result);
    } catch (err) {
      console.error('[Vitals SOS] Dispatch error:', err);
      setSosResult({
        ok: false,
        overallStatus: isDemo ? 'DEMO_MESSAGE_FAILED' : 'SOS_MESSAGE_FAILED',
        statusCategory: isDemo ? 'DEMO_MESSAGE_FAILED' : 'SOS_MESSAGE_FAILED',
        error: err.message,
      });
      setStage('result');
    }
  };

  const handleOpenGuardianWhatsApp = (guardian) => {
    if (!guardian?.waLink) return;
    const targetKey = guardian.id || guardian.phone || guardian.name;
    activeOpenContactRef.current = targetKey;
    setManualStates((prev) => ({
      ...prev,
      [targetKey]: 'opened',
    }));
    Linking.openURL(guardian.waLink);
  };

  const reading = criticalEvaluation?.reading || {};
  const isSandboxBlocked = Boolean(
    sosResult?.code === 'SANDBOX_MODE_RESTRICTION' ||
    (sosResult?.error && String(sosResult.error).includes('Sandbox mode'))
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.cardContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Icon & Title */}
            <View style={styles.headerRow}>
              <View style={[styles.alertIconCircle, isDemo && styles.alertIconDemo]}>
                <Ionicons
                  name={isDemo ? 'flask' : 'warning'}
                  size={32}
                  color={colors.onPrimary}
                />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={[textStyle('heading', lang, colors.crimson), styles.title]}>
                  {isDemo
                    ? (isHindi ? 'सिम्युलेटेड आपातकालीन अलर्ट' : 'Simulated Emergency Alert')
                    : (isHindi ? 'गंभीर स्वास्थ्य स्थिति' : 'Critical Health Event Detected')}
                </Text>
                <Text style={[textStyle('label', lang, colors.inkSoft), styles.subtitle]}>
                  {isDemo ? 'DEMO MODE • SYNTHETIC DATA' : 'SAHAARA Vitals Emergency Monitor'}
                </Text>
              </View>
            </View>

            {/* STAGE 1: COUNTDOWN */}
            {stage === 'countdown' && (
              <View style={styles.stageBox}>
                {/* Metric Summary Card */}
                <View style={styles.metricSummaryCard}>
                  <Text style={[textStyle('label', lang, colors.crimson), styles.metricLabel]}>
                    {reading.metricType === 'heartRate'
                      ? (isHindi ? 'हृदय गति' : 'Heart Rate')
                      : reading.metricType === 'spo2'
                      ? (isHindi ? 'रक्त ऑक्सीजन (SpO2)' : 'Blood Oxygen (SpO2)')
                      : (reading.metricType || 'Vitals')}
                  </Text>
                  <Text style={[textStyle('display', lang, colors.crimson), styles.metricValue]}>
                    {typeof reading.value === 'object'
                      ? `${reading.value.systolic}/${reading.value.diastolic}`
                      : reading.value}{' '}
                    <Text style={styles.metricUnit}>{reading.unit}</Text>
                  </Text>
                  <Text style={[textStyle('body', lang, colors.inkSoft), styles.metricSource]}>
                    {criticalEvaluation?.message || 'Abnormal measurement detected.'}
                  </Text>
                </View>

                {/* Countdown Timer Display */}
                <View style={styles.countdownBox}>
                  <View style={styles.countdownBadge}>
                    <Text style={styles.countdownNumber}>{secondsLeft}</Text>
                  </View>
                  <Text style={[textStyle('heading', lang, colors.ink), styles.countdownText]}>
                    {isHindi
                      ? `${secondsLeft} सेकंड में आपातकालीन अलर्ट भेजा जाएगा...`
                      : `Dispatching emergency alert in ${secondsLeft} seconds...`}
                  </Text>
                  <Text style={[textStyle('body', lang, colors.inkSoft), styles.countdownSubtext]}>
                    {isHindi
                      ? 'यदि आप सुरक्षित हैं, तो नीचे दिए गए बटन से तुरंत रद्द करें।'
                      : 'If you are safe and okay, tap Cancel below immediately.'}
                  </Text>
                </View>

                {/* Medical Disclaimer */}
                <View style={styles.disclaimerBox}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.inkSoft} />
                  <Text style={[textStyle('label', lang, colors.inkSoft), styles.disclaimerText]}>
                    {isDemo
                      ? (isHindi
                        ? 'डेमो मोड: वास्तविक संरक्षकों को कोई संदेश नहीं भेजा जाएगा।'
                        : 'Demo Mode: Safe presentation simulator. No real WhatsApp messages are sent.')
                      : (isHindi
                        ? 'स्मार्टवॉच रीडिंग कभी-कभी गलत हो सकती है। सहारा एक चिकित्सीय उपकरण नहीं है।'
                        : 'Wearable readings can be inaccurate. SAHAARA is an informational safety aid, not a diagnostic medical device.')}
                  </Text>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel Alert"
                >
                  <Ionicons name="checkmark-circle" size={24} color={colors.onPrimary} style={{ marginRight: 8 }} />
                  <Text style={[textStyle('button', lang, colors.onPrimary), styles.cancelButtonText]}>
                    {isHindi ? 'मैं ठीक हूँ — अलर्ट रद्द करें' : 'I Am Okay — Cancel Alert'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sendNowButton}
                  onPress={handleDispatchSOS}
                  activeOpacity={0.8}
                >
                  <Text style={[textStyle('label', lang, colors.crimson), styles.sendNowText]}>
                    {isHindi ? 'तुरंत अलर्ट भेजें (प्रतीक्षा न करें)' : 'Send Alert Now (Skip countdown)'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STAGE 2: DISPATCHING */}
            {stage === 'dispatching' && (
              <View style={styles.centerStageBox}>
                <ActivityIndicator size="large" color={colors.crimson} style={{ marginBottom: 16 }} />
                <Text style={[textStyle('heading', lang, colors.ink), styles.centerTitle]}>
                  {isHindi ? 'आपातकालीन सहायता अनुरोध भेजा जा रहा है...' : 'Orchestrating Emergency SOS...'}
                </Text>
                <Text style={[textStyle('body', lang, colors.inkSoft), styles.centerSub]}>
                  {isHindi
                    ? 'स्थान प्राप्त किया जा रहा है और संरक्षकों को अलर्ट किया जा रहा है।'
                    : 'Capturing foreground GPS coordinates and contacting registered guardians.'}
                </Text>
              </View>
            )}

            {/* STAGE 3: CANCELLED */}
            {stage === 'cancelled' && (
              <View style={styles.centerStageBox}>
                <View style={[styles.alertIconCircle, { backgroundColor: colors.forest, marginBottom: 16 }]}>
                  <Ionicons name="checkmark" size={36} color={colors.onPrimary} />
                </View>
                <Text style={[textStyle('heading', lang, colors.forest), styles.centerTitle]}>
                  {isHindi ? 'अलर्ट सफलतापूर्वक रद्द कर दिया गया' : 'Emergency Alert Cancelled'}
                </Text>
                <Text style={[textStyle('body', lang, colors.inkSoft), styles.centerSub]}>
                  {isHindi
                    ? 'कोई बाहरी सूचना नहीं भेजी गई। रद्द करने का विवरण रिकॉर्ड कर लिया गया है।'
                    : 'No external notifications were dispatched. Safe cancellation was logged.'}
                </Text>
                <TouchableOpacity
                  style={[styles.dismissButton, { backgroundColor: colors.paperDeep, borderColor: colors.line }]}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={[textStyle('button', lang, colors.ink), styles.dismissButtonText]}>
                    {isHindi ? 'बंद करें' : 'Close'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STAGE 4: RESULT */}
            {stage === 'result' && (
              <View style={styles.stageBox}>
                {isDemo ? (
                  // DEMO MODE RESULT
                  <View style={styles.demoResultBox}>
                    {sosResult?.overallStatus === 'DEMO_MESSAGE_QUEUED' || sosResult?.statusCategory === 'DEMO_MESSAGE_QUEUED' ? (
                      // 1. DEMO_MESSAGE_QUEUED (Actual demo message queued by WhatsGateway)
                      <>
                        <View style={styles.demoResultHeader}>
                          <Ionicons name="paper-plane" size={28} color={colors.forest} style={{ marginRight: 8 }} />
                          <Text style={[textStyle('heading', lang, colors.forest), styles.resultHeaderTitle]}>
                            {isHindi ? 'डेमो व्हाट्सएप संदेश कतारबद्ध (DEMO_MESSAGE_QUEUED)' : 'Demo WhatsApp Message Queued'}
                          </Text>
                        </View>
                        <Text style={[textStyle('body', lang, colors.inkSoft), styles.resultBodyText]}>
                          {isHindi
                            ? 'परीक्षण सूचना व्हाट्सगेटवे द्वारा स्वीकार कर ली गई है और परीक्षण प्राप्तकर्ताओं के लिए कतारबद्ध है।'
                            : 'Demonstration alert was accepted by WhatsGateway and queued for configured test recipients. This is a controlled test.'}
                        </Text>

                        {/* Location Summary */}
                        {sosResult?.location && (
                          <View style={styles.infoRow}>
                            <Ionicons name="location" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text style={[textStyle('label', lang, colors.ink), styles.infoText]}>
                              {sosResult.location.address || `GPS: ${sosResult.location.lat.toFixed(4)}, ${sosResult.location.lng.toFixed(4)}`}
                            </Text>
                          </View>
                        )}

                        {/* Configured Test Recipients */}
                        <View style={styles.manualGuardiansContainer}>
                          <Text style={[textStyle('label', lang, colors.ink), { fontWeight: '700', marginBottom: 6 }]}>
                            {isHindi ? 'परीक्षण प्राप्तकर्ता (DEMO_TEST_RECIPIENTS):' : 'Configured Test Recipients:'}
                          </Text>
                          {(sosResult?.results || []).map((r, i) => (
                            <View key={i} style={[styles.guardianCard, { paddingVertical: 8 }]}>
                              <View style={styles.guardianInfo}>
                                <Text style={[textStyle('heading', lang, colors.ink), { fontSize: 14 }]}>
                                  {r.name || `Test Recipient ${i + 1}`}
                                </Text>
                                <Text style={[textStyle('label', lang, colors.inkSoft), { fontSize: 12 }]}>
                                  {r.phone || r.rawPhone}
                                </Text>
                              </View>
                              <View style={[styles.stateBadge, styles.stateBadgeOpened]}>
                                <Text style={styles.stateBadgeText}>
                                  {r.status === 'ACCEPTED_BY_GATEWAY' ? 'Queued by Gateway' : (r.status || 'Queued')}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>

                        <View style={styles.safeguardBanner}>
                          <Ionicons name="shield-checkmark" size={16} color={colors.forest} style={{ marginRight: 6 }} />
                          <Text style={[textStyle('label', lang, colors.forest), styles.safeguardText]}>
                            Safe Demo Isolation: Messages were sent exclusively to configured test recipients. Family guardians were not messaged.
                          </Text>
                        </View>
                      </>
                    ) : sosResult?.overallStatus === 'DEMO_MESSAGE_FAILED' || sosResult?.statusCategory === 'DEMO_MESSAGE_FAILED' ? (
                      // 2. DEMO_MESSAGE_FAILED (Actual demo delivery failed)
                      <>
                        <View style={styles.demoResultHeader}>
                          <Ionicons name="alert-circle" size={28} color={colors.crimson} style={{ marginRight: 8 }} />
                          <Text style={[textStyle('heading', lang, colors.crimson), styles.resultHeaderTitle]}>
                            {isHindi ? 'डेमो संदेश प्रेषण विफल (DEMO_MESSAGE_FAILED)' : 'Demo Message Dispatch Failed'}
                          </Text>
                        </View>
                        <Text style={[textStyle('body', lang, colors.crimson), styles.resultBodyText]}>
                          {sosResult?.error || 'Could not dispatch demo WhatsApp notification. Check DEMO_TEST_RECIPIENTS in server/.env or WhatsGateway worker status.'}
                        </Text>
                        <View style={[styles.safeguardBanner, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                          <Ionicons name="information-circle" size={16} color={colors.crimson} style={{ marginRight: 6 }} />
                          <Text style={[textStyle('label', lang, colors.crimson), styles.safeguardText]}>
                            Status: DEMO_MESSAGE_FAILED. Verify WHATSAPP_GATEWAY_API_KEY and DEMO_TEST_RECIPIENTS on the backend.
                          </Text>
                        </View>
                      </>
                    ) : (
                      // 3. DEMO_SIMULATED (Real delivery disabled, safe simulation)
                      <>
                        <View style={styles.demoResultHeader}>
                          <Ionicons name="shield-checkmark" size={28} color={colors.forest} style={{ marginRight: 8 }} />
                          <Text style={[textStyle('heading', lang, colors.forest), styles.resultHeaderTitle]}>
                            {isHindi ? 'डेमो आपातकालीन परीक्षण सफल (DEMO_SIMULATED)' : 'Demo SOS Simulation Complete'}
                          </Text>
                        </View>
                        <Text style={[textStyle('body', lang, colors.inkSoft), styles.resultBodyText]}>
                          {isHindi
                            ? 'सिम्युलेटेड आपातकालीन चक्र सफलतापूर्वक पूरा हुआ। स्थान प्राप्त किया गया और घटना दर्ज की गई।'
                            : 'Simulated SOS orchestration completed successfully. Foreground GPS was captured and incident logged.'}
                        </Text>

                        {/* Location Summary */}
                        <View style={styles.infoRow}>
                          <Ionicons name="location" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                          <Text style={[textStyle('label', lang, colors.ink), styles.infoText]}>
                            {sosResult?.location
                              ? `GPS: ${sosResult.location.lat.toFixed(4)}, ${sosResult.location.lng.toFixed(4)}`
                              : 'GPS: Simulated / Unavailable'}
                          </Text>
                        </View>

                        {/* Safeguards confirmation */}
                        <View style={styles.safeguardBanner}>
                          <Ionicons name="lock-closed" size={16} color={colors.forest} style={{ marginRight: 6 }} />
                          <Text style={[textStyle('label', lang, colors.forest), styles.safeguardText]}>
                            Safe Simulation (DEMO_SIMULATED): Real WhatsApp delivery is disabled (DEMO_ALLOW_REAL_WHATSAPP_SEND=false). Zero external messages dispatched.
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                ) : (
                  // REAL SOS: PRODUCTION OUTCOME
                  <View style={styles.prodOutcomeContainer}>
                    {/* Status Header Box */}
                    <View style={[
                      styles.statusHeaderBox,
                      sosResult?.ok ? styles.boxSuccess : styles.boxFailure,
                    ]}>
                      <View style={styles.statusHeaderRow}>
                        <Ionicons
                          name={sosResult?.ok ? 'checkmark-circle' : 'alert-circle'}
                          size={24}
                          color={sosResult?.ok ? colors.forest : colors.crimson}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={[
                          textStyle('heading', lang, sosResult?.ok ? colors.forest : colors.crimson),
                          styles.statusBoxTitle,
                        ]}>
                          {sosResult?.ok
                            ? (isHindi ? 'आपातकालीन अलर्ट: कतारबद्ध (SOS_MESSAGE_QUEUED)' : 'Emergency Alert: Queued (SOS_MESSAGE_QUEUED)')
                            : isSandboxBlocked
                            ? (isHindi ? 'ट्विलियो सैंडबॉक्स मोड सक्रिय' : 'Twilio Sandbox Mode Active')
                            : (isHindi ? 'आपातकालीन अलर्ट विफल (SOS_MESSAGE_FAILED)' : 'Emergency Alert Failed (SOS_MESSAGE_FAILED)')}
                        </Text>
                      </View>
                      <Text style={[textStyle('body', lang, colors.ink), styles.statusBoxDesc]}>
                        {sosResult?.ok
                          ? (isHindi
                              ? 'आपातकालीन सूचना व्हाट्सगेटवे द्वारा कतारबद्ध कर ली गई है। वास्तविक डिलीवरी नेटवर्क और प्राप्तकर्ता की उपलब्धता पर निर्भर करती है।'
                              : 'Your emergency notification was accepted and queued by WhatsGateway for all registered guardians. Real WhatsApp delivery depends on network and recipient availability.')
                          : isSandboxBlocked
                          ? (isHindi
                              ? 'ट्विलियो सैंडबॉक्स स्वचालित कस्टम आपातकालीन संदेशों को ब्लॉक करता है। वास्तविक आपातकाल के लिए कृपया नीचे दिए गए हरे बटन से व्हाट्सएप खोलें।'
                              : 'Twilio Sandbox blocks automated outbound broadcasts. For this emergency, please send the prefilled alert via WhatsApp below.')
                          : (sosResult?.errorMessage || sosResult?.error || 'Could not complete automated dispatch. Please contact your guardians directly below.')}
                      </Text>
                    </View>

                    {/* Location Summary if available */}
                    {sosResult?.location && (
                      <View style={styles.locationSummaryRow}>
                        <Ionicons name="location" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[textStyle('label', lang, colors.ink), styles.locationText]}>
                          {sosResult.location.address || `GPS: ${sosResult.location.lat.toFixed(4)}, ${sosResult.location.lng.toFixed(4)}`}
                        </Text>
                      </View>
                    )}

                    {/* Manual WhatsApp Fallback / Contact Actions */}
                    <View style={styles.manualGuardiansContainer}>
                      <Text style={[textStyle('heading', lang, colors.ink), styles.manualHeading]}>
                        {isHindi ? 'संरक्षक संपर्क स्थिति और बैकअप' : 'Registered Emergency Guardians:'}
                      </Text>
                      <Text style={[textStyle('label', lang, colors.inkSoft), { fontSize: 11, marginBottom: 8 }]}>
                        {isHindi
                          ? 'यदि आवश्यक हो तो आप नीचे सीधे हरे व्हाट्सएप बटन से भी तुरंत संदेश भेज सकते हैं।'
                          : 'You can also tap the green WhatsApp button below to send the alert directly.'}
                      </Text>

                      {(sosResult?.fallbackGuardians || sosResult?.contacts || []).map((guardian, idx) => {
                        const targetKey = guardian.id || guardian.phone || guardian.name;
                        const status = manualStates[targetKey] || (
                          sosResult?.results?.find(r => r.name === guardian.name || r.phone === guardian.phone)?.status ||
                          (sosResult?.ok ? 'QUEUED' : 'ready')
                        );

                        const isQueued = status === 'QUEUED' || status === 'ACCEPTED_BY_GATEWAY' || status === 'ACCEPTED';
                        const isDelivered = status === 'DELIVERED';
                        const isFailed = status === 'FAILED' || status === 'REJECTED';

                        return (
                          <View key={targetKey || idx} style={styles.guardianCard}>
                            <View style={styles.guardianInfo}>
                              <Text style={[textStyle('heading', lang, colors.ink), styles.guardianName]}>
                                {guardian.name}
                              </Text>
                              <Text style={[textStyle('label', lang, colors.inkSoft), styles.guardianPhone]}>
                                {guardian.phone || guardian.rawPhone} • {guardian.relation || 'Guardian'}
                              </Text>
                              <View style={[
                                styles.stateBadge,
                                isQueued && styles.stateBadgeOpened,
                                isDelivered && styles.safeguardBanner,
                                isFailed && styles.stateBadgeFailed,
                                status === 'opened' && styles.stateBadgeOpened,
                                status === 'returned' && styles.stateBadgeReturned,
                              ]}>
                                <Text style={styles.stateBadgeText}>
                                  {status === 'opened'
                                    ? 'WhatsApp opened'
                                    : status === 'returned'
                                    ? 'Returned • Not confirmed'
                                    : isDelivered
                                    ? 'Delivered to device'
                                    : isQueued
                                    ? 'Enqueued for delivery'
                                    : isFailed
                                    ? 'Failed to queue'
                                    : 'Ready to send'}
                                </Text>
                              </View>
                            </View>
                            {guardian.waLink && (
                              <TouchableOpacity
                                style={styles.waButton}
                                onPress={() => handleOpenGuardianWhatsApp(guardian)}
                                activeOpacity={0.85}
                              >
                                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                                <Text style={styles.waButtonText}>
                                  {status === 'returned' ? 'Open' : 'WhatsApp'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Dismiss Button */}
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={onClose}
                  activeOpacity={0.85}
                >
                  <Text style={[textStyle('button', lang, colors.ink), styles.dismissButtonText]}>
                    {isHindi ? 'पूर्ण — स्क्रीन पर लौटें' : 'Done — Return to Vitals'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 20, 23, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  cardContainer: {
    backgroundColor: colors.paper,
    borderRadius: radius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    borderWidth: border.widthLarge,
    borderColor: colors.crimson,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  alertIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  alertIconDemo: {
    backgroundColor: colors.primary,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  stageBox: {
    marginTop: spacing.xs,
  },
  metricSummaryCard: {
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: spacing.md,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
  },
  metricUnit: {
    fontSize: 18,
    fontWeight: '600',
  },
  metricSource: {
    fontSize: 13,
    lineHeight: 18,
  },
  countdownBox: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.md,
  },
  countdownBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.crimson,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  countdownNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.heading,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  countdownSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginHorizontal: spacing.md,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: spacing.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    marginLeft: 6,
    color: '#92400E',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forest,
    minHeight: 52,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  sendNowButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  sendNowText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  centerStageBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  centerSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  dismissButton: {
    backgroundColor: colors.gold,
    minHeight: 48,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  demoResultBox: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  demoResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  resultHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  resultBodyText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  safeguardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    backgroundColor: '#DCFCE7',
    borderRadius: radius.sm,
  },
  safeguardText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sandboxBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  sandboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sandboxTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sandboxDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  manualGuardiansContainer: {
    marginTop: spacing.xs,
  },
  manualHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  guardianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  guardianInfo: {
    flex: 1,
    marginRight: spacing.xs,
  },
  guardianName: {
    fontSize: 15,
    fontWeight: '700',
  },
  guardianPhone: {
    fontSize: 12,
  },
  stateBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stateBadgeOpened: {
    backgroundColor: '#DBEAFE',
  },
  stateBadgeReturned: {
    backgroundColor: '#FEF3C7',
  },
  stateBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.ink,
  },
  waButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  waButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  prodResultBox: {
    padding: spacing.md,
  },
  prodOutcomeContainer: {
    paddingVertical: spacing.xs,
  },
  statusHeaderBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  boxSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  boxFailure: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  statusBoxDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  locationSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stateBadgeFailed: {
    backgroundColor: '#FEE2E2',
  },
});
