/**
 * components/SosModal.js
 * Calm senior-first two-step emergency confirm modal.
 * Integrates WhatsApp emergency alert via Meta WhatsApp Cloud API backend & foreground GPS location.
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
  const isSandboxBlocked = Boolean(
    sosResult?.code === 'SANDBOX_MODE_RESTRICTION' ||
    (sosResult?.error && String(sosResult.error).includes('Sandbox mode'))
  );
  const isAuthError = Boolean(
    sosResult?.authError === true ||
    sosResult?.status === 401 ||
    sosResult?.errorCode === 'UNAUTHORIZED' ||
    sosResult?.errorCode === 'AUTHENTICATION_REQUIRED' ||
    sosResult?.errorCode === 'AUTH_HEADER_MISSING' ||
    sosResult?.errorCode === 'AUTH_HEADER_MALFORMED' ||
    sosResult?.errorCode === 'AUTH_TOKEN_EXPIRED' ||
    sosResult?.errorCode === 'AUTH_TOKEN_REVOKED' ||
    sosResult?.errorCode === 'AUTH_TOKEN_INVALID' ||
    (sosResult?.error && String(sosResult.error).toLowerCase().includes('unauthorized'))
  );

  // Manual WhatsApp sending state per guardian: { [contactKey]: 'ready' | 'opened' | 'returned' }
  const [manualStates, setManualStates] = useState({});
  const activeOpenContactRef = useRef(null);

  // Debouncing & double-click protection ref
  const isTriggeringRef = useRef(false);
  const lastTriggerTimeRef = useRef(0);

  // Track when user returns from opening WhatsApp to update status accurately
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

  useEffect(() => {
    if (visible) {
      setCheckingContacts(true);
      setStep('idle');
      setResultState(null);
      setSosResult(null);
      setManualStates({});
      activeOpenContactRef.current = null;

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
    const now = Date.now();
    // Prevent accidental rapid multiple taps / duplicate submissions
    if (isTriggeringRef.current || (now - lastTriggerTimeRef.current < 8000)) {
      console.log('[SOS Modal] Ignoring rapid duplicate trigger');
      return;
    }
    isTriggeringRef.current = true;
    lastTriggerTimeRef.current = now;

    setLoading(true);
    setStep('locating');

    try {
      // Step feedback: locating -> sending
      setTimeout(() => {
        setStep('sending');
      }, 2000);

      const result = await sendSOS({ reason: 'manual' });
      setSosResult(result);

      // Record full SOS event in Firestore sos_alerts
      try {
        if (db && !result.authError) {
          const user = auth.currentUser;
          const calculatedStatus = result.overallStatus || (result.ok
            ? (result.acceptedAll ? 'ACCEPTED_ALL' : 'PARTIALLY_ACCEPTED')
            : 'FAILED');

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
            status: calculatedStatus,
            overallStatus: calculatedStatus,
            whatsappStatus: calculatedStatus,
            guardianResults: result.results || [],
            message: 'Manual SOS alert triggered via Sahaara app',
            timestamp: serverTimestamp(),
            contacts: contacts.map((c) => c.name),
            provider: result.provider || 'twilio_whatsapp',
          });
        }
      } catch (fbErr) {
        console.log('[SOS Modal] Firebase alert doc write error:', fbErr.message);
      }

      // Local notification feedback on senior's device
      if (!isExpoGo) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: isHindi ? '🆘 SOS अलर्ट स्वीकार हुआ' : '🆘 SOS Alert Accepted',
              body: result.location
                ? isHindi
                  ? 'स्थान सहित अलर्ट अनुरोध स्वीकार कर लिया गया। शांत रहें, मदद आ रही है।'
                  : 'Your emergency alert was accepted by WhatsApp. Help is on the way.'
                : isHindi
                ? 'देखभालकर्ताओं के लिए अलर्ट अनुरोध स्वीकार कर लिया गया।'
                : 'Emergency alert accepted for contacts.',
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
      isTriggeringRef.current = false;
    }
  };

  const openMaps = () => {
    if (sosResult?.location && typeof sosResult.location.lat === 'number') {
      const { lat, lng } = sosResult.location;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
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

  const openFallbackWhatsApp = () => {
    const firstGuardian =
      (sosResult?.fallbackGuardians && sosResult.fallbackGuardians[0]) ||
      (sosResult?.fallbackWaLink ? { id: 'primary', waLink: sosResult.fallbackWaLink } : null);
    if (firstGuardian) {
      handleOpenGuardianWhatsApp(firstGuardian);
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
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardScrollContent}
            showsVerticalScrollIndicator={false}
          >
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
                  ? 'आपके सभी आपातकालीन संपर्कों को तुरंत व्हाट्सएप पर आपका स्थान और संदेश भेजा जाएगा।'
                  : 'All your emergency contacts will be notified immediately via WhatsApp with your location.'}
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
                      : (isHindi ? 'व्हाट्सएप अलर्ट भेज रहे हैं...' : 'Sending WhatsApp alert to contacts...')}
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
                {sosResult?.overallStatus === 'PARTIALLY_ACCEPTED'
                  ? (isHindi ? 'अलर्ट आंशिक रूप से स्वीकार हुआ' : 'Alert Partially Accepted')
                  : (isHindi ? 'आपातकालीन अलर्ट स्वीकार हुआ' : 'Emergency Alert Accepted')}
              </Text>

              <View style={[styles.goldBar, { backgroundColor: colors.calm }]} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {sosResult?.overallStatus === 'PARTIALLY_ACCEPTED'
                  ? (isHindi
                      ? 'व्हाट्सएप ने कुछ संपर्कों के लिए अलर्ट स्वीकार किया है, लेकिन कुछ विफल रहे।'
                      : 'WhatsApp accepted the alert for some contacts, but some requests failed.')
                  : (isHindi
                      ? 'व्हाट्सएप ने आपके सभी संपर्कों के लिए आपातकालीन संदेश स्वीकार कर लिया है।'
                      : 'WhatsApp has accepted the alert request for all your registered contacts.')}
              </Text>

              {/* Reached / Accepted contacts */}
              <View style={styles.reachedBox}>
                <Text style={[textStyle('label', lang, colors.calm), { fontFamily: fonts.bodyStrong }]}>
                  {isHindi ? 'संपर्क स्थिति (मेटा एपीआई):' : 'Contact Status (WhatsApp):'}
                </Text>
                <Text style={[textStyle('body', lang, colors.ink), { marginTop: 4 }]}>
                  {contacts.map((c) => {
                    const match = sosResult?.results?.find(
                      (r) => r.rawPhone === c.phone || r.name === c.name
                    );
                    const isAccepted = match?.accepted;
                    const statusTag = isAccepted
                      ? (isHindi ? '✓ स्वीकृत' : '✓ Accepted')
                      : (isHindi ? '✗ विफल' : '✗ Failed');
                    return `• ${c.name} (${c.relation || 'Contact'}) — ${statusTag}`;
                  }).join('\n')}
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
              ) : (
                <View style={styles.locationBox}>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={20} color={colors.inkSoft} />
                    <Text style={[textStyle('label', lang, colors.inkSoft), { flex: 1, marginLeft: 6 }]}>
                      {isHindi ? 'स्थान उपलब्ध नहीं (अलर्ट संपर्कों को भेजा गया)' : 'Location unavailable (alert was sent to contacts)'}
                    </Text>
                  </View>
                </View>
              )}

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
                {isAuthError
                  ? (isHindi ? 'सत्र सत्यापन विफल' : 'Authentication Required')
                  : isSandboxBlocked
                  ? (isHindi ? 'Twilio सैंडबॉक्स प्रतिबंध' : 'Twilio Sandbox Active')
                  : (isHindi ? 'स्वचालित अलर्ट नहीं भेजा जा सका' : 'Automatic alert failed')}
              </Text>

              <View style={[styles.goldBar, { backgroundColor: colors.dangerText }]} />

              <Text style={[textStyle('body', lang, colors.inkSoft), styles.subText]}>
                {isAuthError
                  ? (isHindi
                      ? 'आपके सत्र की पुष्टि नहीं हो सकी। कृपया SOS शुरू करने से पहले दोबारा साइन इन करें। आपातकाल में आप नीचे दिए गए हरे बटन से सीधे WhatsApp संदेश भेज सकते हैं।'
                      : 'Your session could not be verified. Please sign in again before triggering SOS. In an emergency, you can send directly using the WhatsApp button below.')
                  : isSandboxBlocked
                  ? (isHindi
                      ? 'Twilio सैंडबॉक्स मोड में आपातकालीन संदेश नहीं भेजे जा सकते। लाइव आपातकालीन अलर्ट के लिए प्रोडक्शन WhatsApp सेटअप आवश्यक है। कृपया नीचे दिए गए हरे बटन से स्वयं WhatsApp संदेश भेजें।'
                      : 'Twilio Sandbox mode cannot dispatch live emergency alerts. An approved production WhatsApp template is required. Please send manually using the WhatsApp button below.')
                  : (isHindi
                      ? 'नेटवर्क या सर्वर समस्या के कारण स्वचालित अलर्ट नहीं भेजा जा सका। कृपया नीचे दिए गए WhatsApp बटन से सीधे संदेश भेजें।'
                      : 'Could not send the automatic alert due to a network or server issue. Please send manually using the WhatsApp button below.')}
              </Text>

              {sosResult?.error ? (
                <View style={styles.errorSnippetBox}>
                  <Ionicons name="alert-outline" size={18} color={colors.dangerText} />
                  <Text style={[textStyle('label', lang, colors.dangerText), styles.errorSnippetText]}>
                    {sosResult.error}
                  </Text>
                </View>
              ) : null}

              {/* Manual WhatsApp Fallback Section for registered guardians */}
              {(() => {
                const fallbackGuardians =
                  sosResult?.fallbackGuardians && sosResult.fallbackGuardians.length > 0
                    ? sosResult.fallbackGuardians
                    : sosResult?.fallbackWaLink
                    ? [
                        {
                          id: contacts[0]?.id || 'contact-0',
                          name: contacts[0]?.name || 'Guardian',
                          relation: contacts[0]?.relation || '',
                          phone: contacts[0]?.phone || '',
                          waLink: sosResult.fallbackWaLink,
                        },
                      ]
                    : [];

                if (fallbackGuardians.length === 0) return null;

                return (
                  <View style={{ width: '100%', marginBottom: spacing.md }}>
                    {/* Clear Manual Step Notice */}
                    <View style={styles.manualNoticeBox}>
                      <Ionicons name="information-circle" size={22} color={colors.primary} />
                      <View style={{ flex: 1, marginLeft: spacing.xs }}>
                        <Text style={[textStyle('label', lang, colors.primary), { fontWeight: '700' }]}>
                          {isHindi ? 'WhatsApp पर मैन्युअल रूप से भेजें' : 'Manual Send Required in WhatsApp'}
                        </Text>
                        <Text style={[textStyle('body', lang, colors.inkSoft), { fontSize: 13, lineHeight: 18, marginTop: 2 }]}>
                          {isHindi
                            ? 'WhatsApp आपका आपातकालीन संदेश पहले से भरकर खोलेगा। संदेश भेजने के लिए आपको WhatsApp में हरा "Send" (✈️) बटन दबाना होगा।'
                            : 'WhatsApp will open with your emergency message prefilled. You must tap Send (✈️) in WhatsApp to deliver the message.'}
                        </Text>
                      </View>
                    </View>

                    {/* Individual Guardian Cards */}
                    <View style={styles.guardiansListContainer}>
                      {fallbackGuardians.map((g, idx) => {
                        const contactKey = g.id || g.phone || g.name || String(idx);
                        const currentState = manualStates[contactKey] || 'ready';

                        return (
                          <View key={contactKey} style={styles.guardianFallbackCard}>
                            <View style={styles.guardianFallbackHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={[textStyle('heading', lang, colors.ink), { fontSize: 16, lineHeight: 22 }]}>
                                  {g.name} {g.relation ? `(${g.relation})` : ''}
                                </Text>
                                {g.phone ? (
                                  <Text style={[textStyle('label', lang, colors.inkSoft), { fontSize: 13 }]}>
                                    {g.phone}
                                  </Text>
                                ) : null}
                              </View>

                              {/* State Badge */}
                              <View
                                style={[
                                  styles.statePill,
                                  currentState === 'returned'
                                    ? styles.statePillReturned
                                    : currentState === 'opened'
                                    ? styles.statePillOpened
                                    : styles.statePillReady,
                                ]}
                              >
                                <Ionicons
                                  name={
                                    currentState === 'returned'
                                      ? 'help-circle-outline'
                                      : currentState === 'opened'
                                      ? 'open-outline'
                                      : 'time-outline'
                                  }
                                  size={13}
                                  color={
                                    currentState === 'returned'
                                      ? '#B45309'
                                      : currentState === 'opened'
                                      ? '#D97706'
                                      : colors.inkSoft
                                  }
                                />
                                <Text
                                  style={[
                                    styles.statePillText,
                                    {
                                      color:
                                        currentState === 'returned'
                                          ? '#B45309'
                                          : currentState === 'opened'
                                          ? '#D97706'
                                          : colors.inkSoft,
                                    },
                                  ]}
                                >
                                  {currentState === 'returned'
                                    ? (isHindi ? 'वापस आए • पुष्टि नहीं' : 'Returned • Not confirmed')
                                    : currentState === 'opened'
                                    ? (isHindi ? 'WhatsApp खोला गया' : 'WhatsApp opened')
                                    : (isHindi ? 'भेजने के लिए तैयार' : 'Ready to send')}
                                </Text>
                              </View>
                            </View>

                            {currentState === 'returned' && (
                              <Text style={[textStyle('body', lang, colors.inkSoft), styles.returnedNote]}>
                                {isHindi
                                  ? 'WhatsApp संदेश भेजने की पुष्टि नहीं देता। कृपया सुनिश्चित करें कि आपने WhatsApp में Send दबाया था।'
                                  : 'Delivery cannot be verified automatically. Ensure you tapped Send in WhatsApp.'}
                              </Text>
                            )}

                            <TouchableOpacity
                              style={[styles.confirmBtn, styles.waSendBtn]}
                              onPress={() => handleOpenGuardianWhatsApp(g)}
                              activeOpacity={0.82}
                              accessibilityRole="button"
                            >
                              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
                              <Text style={[textStyle('button', lang, '#FFFFFF'), { fontSize: 16 }]}>
                                {currentState === 'returned'
                                  ? (isHindi ? `${g.name} के लिए फिर से खोलें` : `Open WhatsApp again for ${g.name}`)
                                  : currentState === 'opened'
                                  ? (isHindi ? `${g.name} का WhatsApp खोल रहे हैं...` : `Opening WhatsApp for ${g.name}...`)
                                  : (isHindi ? `${g.name} को WhatsApp से भेजें` : `Send to ${g.name} via WhatsApp`)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

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
          </ScrollView>
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
    maxHeight: '90%',
    alignItems: 'center',
  },
  cardScroll: {
    width: '100%',
  },
  cardScrollContent: {
    alignItems: 'center',
    width: '100%',
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
  errorSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    borderRadius: radius.button,
    marginBottom: spacing.md,
    width: '100%',
  },
  errorSnippetText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  closeBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  guardiansListContainer: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  guardianFallbackCard: {
    width: '100%',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  guardianFallbackHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statePillReady: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statePillOpened: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statePillReturned: {
    backgroundColor: '#FDE68A',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  returnedNote: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  waSendBtn: {
    backgroundColor: '#25D366',
    marginTop: spacing.xs,
    marginBottom: 0,
    minHeight: 48,
  },
});
