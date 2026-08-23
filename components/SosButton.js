/**
 * SOS Button — Emergency Alert System
 *
 * On confirm:
 *  1. Gets GPS location via expo-location
 *  2. Writes full alert doc to Firebase sos_alerts (caretaker portal reads this)
 *  3. Fires a local push notification on elder's device
 *  4. Shows success screen with location + Google Maps link
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity, Text, View, StyleSheet, Modal,
  ActivityIndicator, Animated, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';
import { SOS_CONFIG } from '../constants/sosConfig';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification handler (safely handle Expo Go limitations)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Notification setup failed (expected in Expo Go)
  console.log('[SOS] Notifications unavailable in Expo Go');
}

export default function SosButton() {
  const { t, language } = useTranslation();
  const isHindi = language === 'hi';

  const [modalVisible, setModalVisible]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [alertSent, setAlertSent]         = useState(false);
  const [locationData, setLocationData]   = useState(null);
  const [locationError, setLocationError] = useState(false);
  const [step, setStep]                   = useState('idle'); // idle | locating | sending | done

  // Pulse animation for the SOS button
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Request notification permission on mount (skip in Expo Go)
  useEffect(() => {
    if (!isExpoGo) {
      Notifications.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  const handleSosPress = () => {
    setAlertSent(false);
    setLocationData(null);
    setLocationError(false);
    setStep('idle');
    setModalVisible(true);
  };

  const handleConfirmSos = async () => {
    setLoading(true);
    setStep('locating');

    let coords  = null;
    let mapsLink = null;
    let address  = null;

    // ── Step 1: Get GPS location ──────────────────────────────────────────────
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {

        // First try last-known (instant, no GPS spin-up)
        const last = await Location.getLastKnownPositionAsync({
          maxAge: 60000, // accept if < 1 min old
          requiredAccuracy: 200,
        }).catch(() => null);

        if (last?.coords) {
          coords = last.coords;
        } else {
          // Fresh GPS with 8s timeout
          const locPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 8000)
          );
          const loc = await Promise.race([locPromise, timeout]);
          coords = loc.coords;
        }

        mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;

        // Reverse geocode → human-readable address
        try {
          const places = await Location.reverseGeocodeAsync({
            latitude:  coords.latitude,
            longitude: coords.longitude,
          });
          if (places?.length > 0) {
            const p = places[0];
            const parts = [p.name, p.street, p.district, p.city, p.region]
              .filter(Boolean)
              .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
            address = parts.slice(0, 3).join(', ');
          }
        } catch (_) {}

        setLocationData({ coords, mapsLink, address });
      } else {
        setLocationError(true);
      }
    } catch (_) {
      setLocationError(true);
    }

    setStep('sending');

    // ── Step 2: Write to Firebase sos_alerts ──────────────────────────────────
    try {
      if (db) {
        await addDoc(collection(db, 'sos_alerts'), {
          // User info
          userId:    auth?.currentUser?.uid    || 'unknown',
          userEmail: auth?.currentUser?.email  || 'unknown@sahaara.app',
          userName:  auth?.currentUser?.displayName || 'Elder',

          // Location
          latitude:   coords?.latitude  ?? null,
          longitude:  coords?.longitude ?? null,
          accuracy:   coords?.accuracy  ?? null,
          mapsLink:   mapsLink,
          locationAvailable: coords !== null,
          address:   address,
          mapsLink:  mapsLink,

          // Alert metadata
          status:    'TRIGGERED',
          message:   SOS_CONFIG.alertMessage,
          timestamp: serverTimestamp(),
          resolvedAt: null,
          resolvedBy: null,

          // Device info
          contacts: SOS_CONFIG.emergencyContacts.map(c => c.name),
        });
      }
    } catch (err) {
      console.log('[SOS] Firebase write error:', err);
      // Still continue — local notification must fire regardless
    }

    // ── Step 3: Local push notification ───────────────────────────────────────
    if (!isExpoGo) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: isHindi ? '🆘 SOS अलर्ट भेजा गया' : '🆘 SOS Alert Sent',
            body: coords
              ? (isHindi
                  ? `आपका स्थान (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}) देखभालकर्ता को भेजा गया।`
                  : `Your location sent to caretaker. Stay calm, help is coming.`)
              : (isHindi ? 'देखभालकर्ता को सूचित किया गया।' : 'Caretaker has been notified.'),
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: null, // fire immediately
        });
      } catch (_) {
        console.log('[SOS] Notification scheduling failed (development/Expo Go limitation)');
      }
    }

    setLoading(false);
    setStep('done');
    setAlertSent(true);
  };

  const openMaps = () => {
    if (locationData?.mapsLink) {
      Linking.openURL(locationData.mapsLink);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={styles.sosButton}
          onPress={handleSosPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('sos.button')}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="warning" size={26} color="#fff" />
          </View>
          <View>
            <Text style={styles.sosButtonText}>{t('sos.button')}</Text>
            <Text style={styles.sosButtonSub}>
              {isHindi ? 'दबाने पर स्थान + अलर्ट भेजा जाएगा' : 'Sends location + alert instantly'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => !loading && setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>

            {/* ── Confirm state ── */}
            {!alertSent ? (
              <>
                <View style={styles.alertBadge}>
                  <Ionicons name="alert-circle" size={48} color="#DC2626" />
                </View>
                <Text style={styles.cardTitle}>{t('sos.confirmTitle')}</Text>
                <Text style={styles.cardSub}>{t('sos.confirmSub')}</Text>

                {/* What will happen */}
                <View style={styles.infoBox}>
                  <InfoRow icon="location" text={isHindi ? 'GPS स्थान कैप्चर होगा' : 'GPS location will be captured'} />
                  <InfoRow icon="shield-checkmark" text={isHindi ? 'देखभालकर्ता को अलर्ट जाएगा' : 'Caretaker portal alerted instantly'} />
                  <InfoRow icon="notifications" text={isHindi ? 'आपके फ़ोन पर सूचना आएगी' : 'Notification sent to your phone'} />
                </View>

                {/* Step indicator while loading */}
                {loading && (
                  <View style={styles.stepBox}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.stepText}>
                      {step === 'locating'
                        ? (isHindi ? 'स्थान खोजा जा रहा है...' : 'Getting your location...')
                        : (isHindi ? 'अलर्ट भेजा जा रहा है...' : 'Sending alert...')}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setModalVisible(false)}
                    disabled={loading}
                  >
                    <Text style={styles.cancelText}>{t('sos.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirmSos}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.confirmText}>{t('sos.callForHelp')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ── Success state ── */
              <>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={52} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>{t('sos.sentTitle')}</Text>
                <Text style={styles.successSub}>{t('sos.sentSub')}</Text>

                {/* Location card */}
                <View style={styles.locationCard}>
                  {locationData ? (
                    <>
                      <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color={COLORS.primary} />
                        <Text style={styles.locationLabel}>
                          {isHindi ? 'स्थान मिला' : 'Location captured'}
                        </Text>
                        <View style={styles.locationFoundBadge}>
                          <Text style={styles.locationFoundText}>✓</Text>
                        </View>
                      </View>
                      {/* Show address if available, else raw coords */}
                      {locationData.address ? (
                        <Text style={styles.addressText}>{locationData.address}</Text>
                      ) : null}
                      <Text style={styles.coordsText}>
                        {locationData.coords.latitude.toFixed(6)}, {locationData.coords.longitude.toFixed(6)}
                        {locationData.coords.accuracy
                          ? `  ±${Math.round(locationData.coords.accuracy)}m`
                          : ''}
                      </Text>
                      <TouchableOpacity style={styles.mapsBtn} onPress={openMaps}>
                        <Ionicons name="map-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.mapsBtnText}>
                          {isHindi ? 'Google Maps में देखें' : 'Open in Google Maps'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={16} color="#9CA3AF" />
                      <Text style={styles.locationMissed}>
                        {isHindi ? 'स्थान उपलब्ध नहीं (अलर्ट फिर भी भेजा गया)' : 'Location unavailable (alert still sent)'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Who was notified */}
                <View style={styles.notifiedBox}>
                  <Text style={styles.notifiedLabel}>
                    {isHindi ? 'सूचित किए गए:' : 'Notified:'}
                  </Text>
                  <View style={styles.notifiedRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#16A34A" />
                    <Text style={styles.notifiedText}>
                      {isHindi ? 'देखभालकर्ता पोर्टल' : 'Caretaker Portal'}
                    </Text>
                  </View>
                  <View style={styles.notifiedRow}>
                    <Ionicons name="notifications" size={14} color="#16A34A" />
                    <Text style={styles.notifiedText}>
                      {isHindi ? 'आपका फ़ोन' : 'Your device'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.doneBtnText}>{t('sos.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoRow({ icon, text }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={`${icon}-outline`} size={15} color={COLORS.primary} />
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { width: '100%', marginTop: SPACING.lg, marginBottom: SPACING.md },

  sosButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#DC2626',
    minHeight: 64, borderRadius: SIZES.cardRadius,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  sosButtonText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sosButtonSub:  { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 28, width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },

  alertBadge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  cardSub:   { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  infoBox: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 14, marginBottom: 20, gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoRowText: { fontSize: 13, color: '#374151', flex: 1 },

  stepBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 16, backgroundColor: COLORS.primaryLight,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
  },
  stepText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  actions: { flexDirection: 'row', width: '100%', gap: 10 },
  cancelBtn: {
    flex: 1, minHeight: 54, borderRadius: SIZES.buttonRadius,
    backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelText:  { fontSize: 17, fontWeight: '700', color: '#6B7280' },
  confirmBtn: {
    flex: 1.2, minHeight: 54, borderRadius: SIZES.buttonRadius,
    backgroundColor: '#DC2626',
    justifyContent: 'center', alignItems: 'center',
  },
  confirmText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  // Success state
  successBadge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#16A34A', marginBottom: 6, textAlign: 'center' },
  successSub:   { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 18 },

  locationCard: {
    width: '100%', backgroundColor: '#F0FDF4', borderRadius: 14,
    padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#BBF7D0',
  },
  locationRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  locationLabel:     { fontSize: 13, fontWeight: '700', color: '#15803D', flex: 1 },
  locationFoundBadge:{ backgroundColor: '#16A34A', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
  locationFoundText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  addressText:       { fontSize: 13, fontWeight: '600', color: '#15803D', marginBottom: 4 },
  coordsText:        { fontSize: 11, color: '#6B7280', fontFamily: 'monospace', marginBottom: 8 },
  mapsBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapsBtnText:       { fontSize: 13, fontWeight: '700', color: COLORS.primary, textDecorationLine: 'underline' },
  locationMissed:    { fontSize: 12, color: '#9CA3AF', flex: 1 },

  notifiedBox: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 14, marginBottom: 20, gap: 8,
  },
  notifiedLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  notifiedRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifiedText:  { fontSize: 13, color: '#374151' },

  doneBtn: {
    width: '100%', minHeight: 52, borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  doneBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
