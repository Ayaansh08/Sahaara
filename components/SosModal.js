/**
 * components/SosModal.js
 * Calm senior-first two-step emergency confirm modal.
 * Integrates WhatsApp emergency alert via CallMeBot backend & GPS location.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
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
import { sendSOS, getEmergencyContacts } from '../services/sos';

const isExpoGo = Constants.appOwnership === 'expo';

export default function SosModal({ visible, onClose }) {
  const router = useRouter();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  const [contacts, setContacts] = useState([]);
  const [checkingContacts, setCheckingContacts] = useState(true);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle' | 'locating' | 'sending' | 'result'
  const [resultState, setResultState] = useState(null); // 'success' | 'failure'
  const [sosResult, setSosResult] = useState(null);

  useEffect(() => {
    if (visible) {
      setCheckingContacts(true);
      setStep('idle');
      setResultState(null);
      setSosResult(null);

      getEmergencyContacts()
        .then((list) => {
          setContacts(list || []);
        })
        .catch(() => {
          setContacts([]);
        })
        .finally(() => {
          setCheckingContacts(false);
        });
    }
  }, [visible]);

  const handleClose = () => {
    if (loading) return;
    setStep('idle');
    setResultState(null);
    setSosResult(null);
    onClose();
  };

  const handleGoToContacts = () => {
    handleClose();
    router.push('/emergency-contacts');
  };

  const handleConfirmSos = async () => {
    setLoading(true);
    setStep('locating');

    try {
      // Step: sending
      setTimeout(() => {
        setStep('sending');
      }, 2500);

      const result = await sendSOS({ reason: 'manual' });
      setSosResult(result);

      // Caretaker portal backwards compatibility in Firestore
      try {
        if (db) {
          const user = auth.currentUser;
          await addDoc(collection(db, 'sos_alerts'), {
            userId: user?.uid || 'unknown',
            userEmail: user?.email || 'unknown@sahaara.app',
            userName: user?.displayName || 'Elder',
            latitude: result.location?.lat ?? null,
            longitude: result.location?.lng ?? null,
            accuracy: result.location?.accuracy ?? null,
            mapsLink: result.location
              ? `https://www.google.com/maps/search/?api=1&query=${result.location.lat},${result.location.lng}`
              : null,
            locationAvailable: !!result.location,
            address: result.location?.address ?? null,
            status: 'TRIGGERED',
            message: 'Manual SOS alert triggered via Sahaara app',
            timestamp: serverTimestamp(),
            contacts: contacts.map((c) => c.name),
            deliverySuccess: result.ok,
          });
        }
      } catch (fbErr) {
        console.log('[SOS Modal] Firebase alert doc write error:', fbErr.message);
      }

      // Local notification feedback
      if (!isExpoGo) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: isHindi ? '🆘 SOS अलर्ट भेजा गया' : '🆘 SOS Alert Sent',
              body: result.location
                ? isHindi
                  ? 'स्थान देखभालकर्ताओं को भेजा गया। शांत रहें, मदद आ रही है।'
                  : 'Your location sent to emergency contacts. Help is on the way.'
                : isHindi
                ? 'देखभालकर्ताओं को सूचित किया गया।'
                : 'Emergency contacts have been notified.',
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
          });
        } catch (_) {}
      }

      setResultState(result.ok ? 'success' : 'failure');
      setStep('result');
    } catch (err) {
      console.log('[SOS Modal] Error confirming SOS:', err.message);
      setResultState('failure');
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = () => {
    if (sosResult?.location && typeof sosResult.location.lat === 'number') {
      const { lat, lng } = sosResult.location;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    }
  };

  const openFallbackWhatsApp = () => {
    if (sosResult?.fallbackWaLink) {
      Linking.openURL(sosResult.fallbackWaLink);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {checkingContacts ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[textStyle('body', lang, colors.inkSoft), { marginTop: spacing.md }]}>
                {isHindi ? 'जांच रहे हैं...' : 'Checking contacts...'}
              </Text>
            </View>
          ) : contacts.length === 0 ? (
            /* No contacts configured */
            <>
              <View style={styles.badgeAlert}>
                <Ionicons name="people-circle-outline" size={54} color={colors.sos} />
              </View>

              <Text style={[textStyle('heading', lang, colors.ink), styles.title]}>
                {isHindi ? 'पहले आपातकालीन संपर्क जोड़ें' : 'Add Emergency Contacts First'}
              </Text>

              <View style={styles.goldBar} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {isHindi
                  ? 'आपातकाल में व्हाट्सएप पर संदेश और स्थान भेजने के लिए कम से कम एक संपर्क जोड़ना जरूरी है।'
                  : 'Please add at least one contact so they can receive your emergency WhatsApp alert and location.'}
              </Text>

              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={handleGoToContacts}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Ionicons name="person-add" size={24} color={colors.onSos} style={{ marginRight: spacing.sm }} />
                  <Text style={[textStyle('button', lang, colors.onSos)]}>
                    {isHindi ? 'संपर्क जोड़ें' : 'Add Contacts'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleClose}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Text style={[textStyle('button', lang, colors.primary)]}>
                    {isHindi ? 'नहीं, वापस जाएं' : 'No, go back'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : step !== 'result' ? (
            /* 2-Step Confirm Screen */
            <>
              <View style={styles.badgeAlert}>
                <Ionicons name="warning" size={44} color={colors.sos} />
              </View>

              <Text style={[textStyle('heading', lang, colors.ink), styles.title]}>
                {isHindi ? 'क्या आपको सच में मदद चाहिए?' : 'Do you need emergency help?'}
              </Text>

              <View style={styles.goldBar} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {isHindi
                  ? 'आपके आपातकालीन संपर्कों को तुरंत व्हाट्सएप पर आपका स्थान और संदेश भेजा जाएगा।'
                  : 'Your emergency contacts will be notified immediately via WhatsApp with your location.'}
              </Text>

              {/* Contacts preview */}
              <View style={styles.contactsPreviewBox}>
                <Ionicons name="shield-checkmark" size={22} color={colors.calm} />
                <Text style={[textStyle('label', lang, colors.calm), styles.contactsPreviewText]}>
                  {isHindi ? 'अलर्ट प्राप्तकर्ता: ' : 'Recipients: '}
                  {contacts.map((c) => c.name).join(', ')}
                </Text>
              </View>

              {loading && (
                <View style={styles.stepBox}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={[textStyle('label', lang, colors.primary), styles.stepText]}>
                    {step === 'locating'
                      ? (isHindi ? 'स्थान खोज रहे हैं...' : 'Getting your location...')
                      : (isHindi ? 'अलर्ट भेज रहे हैं...' : 'Sending WhatsApp alert...')}
                  </Text>
                </View>
              )}

              {/* Big two-step confirm actions */}
              <View style={styles.actionsColumn}>
                <TouchableOpacity
                  style={[styles.confirmBtn, loading && styles.btnDisabled]}
                  onPress={handleConfirmSos}
                  disabled={loading}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Ionicons name="call" size={24} color={colors.onSos} style={{ marginRight: spacing.sm }} />
                  <Text style={[textStyle('button', lang, colors.onSos)]}>
                    {isHindi ? 'हाँ, मदद भेजें' : 'Yes, send help'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleClose}
                  disabled={loading}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Text style={[textStyle('button', lang, colors.primary)]}>
                    {isHindi ? 'नहीं, वापस जाएं' : 'No, go back'}
                  </Text>
                </TouchableOpacity>

                {/* Link to view/edit emergency contacts */}
                <TouchableOpacity
                  style={styles.manageLinkBtn}
                  onPress={handleGoToContacts}
                  disabled={loading}
                >
                  <Ionicons name="pencil" size={18} color={colors.primary} />
                  <Text style={[textStyle('label', lang, colors.primary), styles.manageLinkText]}>
                    {isHindi ? 'आपातकालीन संपर्क बदलें' : 'Edit emergency contacts'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : resultState === 'success' ? (
            /* Success Screen */
            <>
              <View style={styles.badgeSuccess}>
                <Ionicons name="checkmark-circle" size={54} color={colors.calm} />
              </View>

              <Text style={[textStyle('heading', lang, colors.calm), styles.title]}>
                {isHindi ? 'मदद का संदेश भेज दिया गया' : 'Help alert sent'}
              </Text>

              <View style={[styles.goldBar, { backgroundColor: colors.calm }]} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {isHindi
                  ? 'आपके संपर्कों को व्हाट्सएप पर संदेश और स्थान भेज दिया गया है।'
                  : 'Your emergency contacts have been notified via WhatsApp with your location.'}
              </Text>

              {/* Reached contacts */}
              <View style={styles.reachedBox}>
                <Text style={[textStyle('label', lang, colors.calm), { fontFamily: fonts.bodyStrong }]}>
                  {isHindi ? 'संदेश भेजा गया:' : 'Contacts reached:'}
                </Text>
                <Text style={[textStyle('body', lang, colors.ink), { marginTop: 4 }]}>
                  {contacts.map((c) => `• ${c.name} (${c.relation || 'Contact'})`).join('\n')}
                </Text>
              </View>

              {/* Location info */}
              {sosResult?.location ? (
                <View style={styles.locationBox}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={20} color={colors.calm} />
                    <Text style={[textStyle('label', lang, colors.calm), { flex: 1, marginLeft: 6 }]}>
                      {isHindi ? 'स्थान सुरक्षित किया गया' : 'Location captured'}
                    </Text>
                  </View>
                  {sosResult.location.address ? (
                    <Text style={[textStyle('body', lang, colors.ink), { marginTop: 4 }]}>
                      {sosResult.location.address}
                    </Text>
                  ) : null}
                  <TouchableOpacity style={styles.mapLinkBtn} onPress={openMaps}>
                    <Ionicons name="map-outline" size={18} color={colors.calm} />
                    <Text style={[textStyle('label', lang, colors.calm), styles.mapLinkText]}>
                      {isHindi ? 'मैप पर देखें (Google Maps)' : 'Open in Google Maps'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={[textStyle('button', lang, colors.onPrimary)]}>
                  {isHindi ? 'ठीक है, बंद करें' : 'OK, Close'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Failure Screen with manual WhatsApp fallback button */
            <>
              <View style={styles.badgeAlert}>
                <Ionicons name="alert-circle" size={54} color={colors.dangerText} />
              </View>

              <Text style={[textStyle('heading', lang, colors.dangerText), styles.title]}>
                {isHindi ? 'स्वचालित अलर्ट नहीं भेजा जा सका' : 'Automatic alert failed'}
              </Text>

              <View style={[styles.goldBar, { backgroundColor: colors.dangerText }]} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {isHindi
                  ? 'नेटवर्क की समस्या के कारण स्वचालित अलर्ट नहीं भेजा जा सका। कृपया नीचे दिए गए बटन से सीधे व्हाट्सएप खोलकर संदेश भेजें।'
                  : 'Could not send the automatic alert due to network issue. Please send manually using the WhatsApp button below.'}
              </Text>

              {sosResult?.fallbackWaLink ? (
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#25D366', marginBottom: spacing.md }]}
                  onPress={openFallbackWhatsApp}
                  activeOpacity={0.82}
                  accessibilityRole="button"
                >
                  <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" style={{ marginRight: spacing.sm }} />
                  <Text style={[textStyle('button', lang, '#FFFFFF')]}>
                    {isHindi ? 'व्हाट्सएप से खुद भेजें' : 'Send via WhatsApp yourself'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                activeOpacity={0.82}
                accessibilityRole="button"
              >
                <Text style={[textStyle('button', lang, colors.primary)]}>
                  {isHindi ? 'बंद करें' : 'Close'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 20, 23, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenX,
  },
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  badgeAlert: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  badgeSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.calmSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  goldBar: {
    height: 4,
    width: 44,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginBottom: spacing.md,
  },
  subText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  contactsPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.calmSoft,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    gap: spacing.xs,
  },
  contactsPreviewText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.row,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  stepText: {
    marginLeft: spacing.sm,
  },
  actionsColumn: {
    width: '100%',
    gap: spacing.sm,
  },
  confirmBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    backgroundColor: colors.sos,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  manageLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  manageLinkText: {
    textDecorationLine: 'underline',
    fontSize: 18,
    lineHeight: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  reachedBox: {
    width: '100%',
    backgroundColor: colors.calmSoft,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.calm,
  },
  locationBox: {
    width: '100%',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: border.width,
    borderColor: colors.line,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  mapLinkText: {
    textDecorationLine: 'underline',
    fontSize: 18,
    lineHeight: 24,
  },
  closeBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
