/**
 * app/emergency-contacts.js
 * Emergency Contacts Management Screen for Sahaara.
 * Connects with Meta WhatsApp Business Cloud API backend for instant alerts.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { useTranslation } from '../context/LanguageContext';
import { colors, spacing, radius, sizes, border, fonts, textStyle } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';
import ThemedTextField from '../components/ThemedTextField';
import ThemedButton from '../components/ThemedButton';
import { getApiBaseUrl } from '../services/saathiService';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const lang = language;
  const isHindi = lang === 'hi';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phone, setPhone] = useState('');
  const [callmebotKey, setCallmebotKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Test message state
  const [testStatus, setTestStatus] = useState(null); // 'sending' | 'success' | 'error'
  const [testErrorMsg, setTestErrorMsg] = useState('');

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Wait for Firebase Auth to restore its session from AsyncStorage before
    // attaching the Firestore listener. Using auth.currentUser synchronously
    // here would race against the async session restore and yield null on
    // first mount, causing a spurious "Missing or insufficient permissions" error.
    let firestoreUnsubscribe = null;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      // Tear down any previous Firestore listener (e.g. user signed out)
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
      }

      if (!user || !db) {
        setLoading(false);
        return;
      }

      const contactsRef = collection(db, 'users', user.uid, 'emergencyContacts');
      const q = query(contactsRef, orderBy('createdAt', 'desc'));

      firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          setContacts(list);
          setLoading(false);
        },
        (err) => {
          console.log('[EmergencyContacts] Firestore error:', err.message);
          setLoading(false);
        }
      );
    });

    return () => {
      authUnsubscribe();
      if (firestoreUnsubscribe) firestoreUnsubscribe();
    };
  }, []);

  const openAddModal = () => {
    setEditingContact(null);
    setName('');
    setRelation('');
    setPhone('');
    setCallmebotKey('');
    setFormError('');
    setTestStatus(null);
    setTestErrorMsg('');
    setModalVisible(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setName(contact.name || '');
    setRelation(contact.relation || '');
    setPhone(contact.phone || '');
    setCallmebotKey(contact.callmebotKey || '');
    setFormError('');
    setTestStatus(null);
    setTestErrorMsg('');
    setModalVisible(true);
  };

  const handleSaveContact = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedKey = callmebotKey.trim();
    const trimmedRelation = relation.trim();

    if (!trimmedName) {
      setFormError(isHindi ? 'कृपया नाम लिखें' : 'Please enter a name');
      return;
    }
    if (!trimmedPhone) {
      setFormError(isHindi ? 'कृपया फ़ोन नंबर लिखें' : 'Please enter a phone number');
      return;
    }

    // Phone number validation: must have at least 10 digits
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setFormError(
        isHindi
          ? 'कृपया कम से कम 10 अंकों का मान्य फ़ोन नंबर लिखें'
          : 'Please enter a valid phone number (at least 10 digits)'
      );
      return;
    }

    const user = auth.currentUser;
    if (!user || !db) return;

    setSaving(true);
    setFormError('');

    try {
      if (editingContact) {
        // Update contact
        const docRef = doc(db, 'users', user.uid, 'emergencyContacts', editingContact.id);
        await updateDoc(docRef, {
          name: trimmedName,
          relation: trimmedRelation,
          phone: trimmedPhone,
          callmebotKey: trimmedKey,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Add new contact (max 3 check)
        if (contacts.length >= 3) {
          setFormError(t('contacts.maxLimit'));
          setSaving(false);
          return;
        }
        const colRef = collection(db, 'users', user.uid, 'emergencyContacts');
        await addDoc(colRef, {
          name: trimmedName,
          relation: trimmedRelation,
          phone: trimmedPhone,
          callmebotKey: trimmedKey,
          createdAt: serverTimestamp(),
        });
      }

      setSaving(false);
      setModalVisible(false);
    } catch (err) {
      console.log('[EmergencyContacts] Save error:', err.message);
      setFormError(isHindi ? 'सहेजने में त्रुटि हुई' : 'Failed to save contact');
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId) => {
    const user = auth.currentUser;
    if (!user || !db || !contactId) return;

    setDeleting(true);
    try {
      const docRef = doc(db, 'users', user.uid, 'emergencyContacts', contactId);
      await deleteDoc(docRef);
      setDeleteTarget(null);
    } catch (err) {
      console.log('[EmergencyContacts] Delete error:', err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendTestMessage = async () => {
    const trimmedPhone = phone.trim();

    if (!trimmedPhone) {
      setTestStatus('error');
      setTestErrorMsg(
        isHindi
          ? 'कृपया पहले फ़ोन नंबर दर्ज करें'
          : 'Please enter phone number first'
      );
      return;
    }

    setTestStatus('sending');
    setTestErrorMsg('');

    try {
      const baseUrl = getApiBaseUrl();
      const user = auth.currentUser;
      const elderName = user?.displayName || user?.email?.split('@')[0] || 'Sahaara Member';

      const idToken = user ? await user.getIdToken().catch(() => null) : null;
      const headers = { 'Content-Type': 'application/json' };
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

      const res = await fetch(`${baseUrl}/api/twilio/test-connectivity`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestErrorMsg(data.error || t('contacts.testFailed'));
      }
    } catch (err) {
      console.log('[EmergencyContacts] Test message error:', err.message);
      setTestStatus('error');
      setTestErrorMsg(t('contacts.testFailed'));
    }
  };

  const maskPhone = (num) => {
    if (!num) return '';
    const str = String(num).trim();
    if (str.length <= 4) return str;
    return `•••• ${str.slice(-4)}`;
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={t('contacts.title')}
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[textStyle('body', lang, colors.inkSoft), styles.introSubtitle]}>
          {t('contacts.subtitle')}
        </Text>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={54} color={colors.inkSoft} />
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.emptyText]}>
              {t('contacts.empty')}
            </Text>
          </View>
        ) : (
          <View style={styles.contactsList}>
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactCard}>
                <View style={styles.contactHeaderRow}>
                  <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={26} color={colors.onPrimary} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={[textStyle('heading', lang, colors.ink), styles.contactName]}>
                      {c.name}
                    </Text>
                    {c.relation ? (
                      <Text style={[textStyle('body', lang, colors.inkSoft), styles.contactRelation]}>
                        {c.relation}
                      </Text>
                    ) : null}
                    <Text style={[textStyle('label', lang, colors.primary), styles.contactPhone]}>
                      {maskPhone(c.phone)}
                    </Text>
                  </View>
                </View>

                {/* Edit and Delete Buttons */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnEdit}
                    onPress={() => openEditModal(c)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t('memory.editButton')}
                  >
                    <Ionicons name="pencil" size={20} color={colors.primary} />
                    <Text style={[textStyle('button', lang, colors.primary), styles.actionBtnText]}>
                      {isHindi ? 'बदलें' : 'Edit'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnDelete}
                    onPress={() => setDeleteTarget(c)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t('memory.deleteButton')}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.dangerText} />
                    <Text style={[textStyle('button', lang, colors.dangerText), styles.actionBtnText]}>
                      {isHindi ? 'हटाएं' : 'Delete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Max 3 warning or Add Button */}
        {contacts.length >= 3 ? (
          <View style={styles.limitBanner}>
            <Ionicons name="information-circle-outline" size={24} color={colors.inkSoft} />
            <Text style={[textStyle('label', lang, colors.inkSoft), styles.limitBannerText]}>
              {t('contacts.maxLimit')}
            </Text>
          </View>
        ) : (
          <ThemedButton
            label={t('contacts.addBtn')}
            iconName="person-add"
            onPress={openAddModal}
            style={styles.addContactBtn}
          />
        )}
      </ScrollView>

      {/* Add / Edit Contact Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[textStyle('heading', lang, colors.ink), styles.modalTitle]}>
                {editingContact
                  ? isHindi ? 'संपर्क बदलें' : 'Edit Contact'
                  : t('contacts.addBtn')}
              </Text>

              {formError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={20} color={colors.dangerText} />
                  <Text style={[textStyle('label', lang, colors.dangerText), styles.errorText]}>
                    {formError}
                  </Text>
                </View>
              ) : null}

              {/* Name field */}
              <ThemedTextField
                label={t('contacts.nameLabel')}
                lang={lang}
                value={name}
                onChangeText={setName}
                placeholder={isHindi ? 'उदा. राहुल शर्मा' : 'e.g. Rahul Sharma'}
                iconName="person-outline"
                style={styles.fieldGap}
              />

              {/* Relation field */}
              <ThemedTextField
                label={t('contacts.relationLabel')}
                lang={lang}
                value={relation}
                onChangeText={setRelation}
                placeholder={isHindi ? 'उदा. बेटा, बेटी, पड़ोसी' : 'e.g. Son, Daughter, Neighbor'}
                iconName="heart-outline"
                style={styles.fieldGap}
              />

              {/* Phone field */}
              <ThemedTextField
                label={t('contacts.phoneLabel')}
                lang={lang}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
                iconName="call-outline"
                style={styles.fieldGap}
              />

              {/* Optional CallMeBot Key field (retained for backward compatibility) */}
              <ThemedTextField
                label={`${t('contacts.keyLabel')} (${isHindi ? 'वैकल्पिक' : 'Optional'})`}
                lang={lang}
                value={callmebotKey}
                onChangeText={setCallmebotKey}
                placeholder={isHindi ? 'उदा. 123456 (यदि हो)' : 'e.g. 123456 (if any)'}
                iconName="key-outline"
                style={styles.fieldGap}
              />

              {/* Plain 18px Help Text */}
              <View style={styles.helpBox}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                <Text style={[textStyle('label', lang, colors.inkSoft), styles.helpText]}>
                  {isHindi
                    ? 'आपातकालीन अलर्ट सीधे व्हाट्सएप के माध्यम से आपके पंजीकृत अभिभावकों को भेजे जाते हैं।'
                    : 'Emergency WhatsApp alerts and GPS location are sent directly to your registered contacts.'}
                </Text>
              </View>

              {/* Send Test Message Button */}
              <View style={styles.testSection}>
                <ThemedButton
                  label={
                    testStatus === 'sending'
                      ? t('contacts.testSending')
                      : t('contacts.testBtn')
                  }
                  variant="secondary"
                  iconName="paper-plane-outline"
                  loading={testStatus === 'sending'}
                  disabled={testStatus === 'sending' || !phone}
                  onPress={handleSendTestMessage}
                />

                {testStatus === 'success' && (
                  <View style={styles.testSuccessBox}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.calm} />
                    <Text style={[textStyle('label', lang, colors.calm), styles.testResultText]}>
                      {t('contacts.testSuccess')}
                    </Text>
                  </View>
                )}

                {testStatus === 'error' && (
                  <View style={styles.testErrorBox}>
                    <Ionicons name="close-circle" size={22} color={colors.dangerText} />
                    <Text style={[textStyle('label', lang, colors.dangerText), styles.testResultText]}>
                      {testErrorMsg || t('contacts.testFailed')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <ThemedButton
                label={saving ? (isHindi ? 'सहेज रहे हैं...' : 'Saving...') : t('contacts.save')}
                loading={saving}
                disabled={saving}
                onPress={handleSaveContact}
                style={styles.fieldGap}
              />

              <ThemedButton
                label={t('contacts.cancel')}
                variant="secondary"
                disabled={saving}
                onPress={() => setModalVisible(false)}
                style={{ marginTop: spacing.xs }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!deleteTarget}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.deleteCircle}>
              <Ionicons name="trash" size={38} color={colors.dangerText} />
            </View>

            <Text style={[textStyle('heading', lang, colors.ink), styles.confirmTitle]}>
              {t('contacts.deleteConfirmTitle')}
            </Text>

            <Text style={[textStyle('body', lang, colors.inkSoft), styles.confirmSub]}>
              {deleteTarget?.name} ({deleteTarget?.relation || maskPhone(deleteTarget?.phone)})
              {'\n'}
              {t('contacts.deleteConfirmSub')}
            </Text>

            <View style={styles.confirmActions}>
              <ThemedButton
                label={deleting ? (isHindi ? 'हटा रहे हैं...' : 'Deleting...') : t('contacts.delete')}
                variant="danger"
                loading={deleting}
                disabled={deleting}
                onPress={() => handleDeleteContact(deleteTarget?.id)}
              />

              <ThemedButton
                label={t('contacts.cancel')}
                variant="secondary"
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    padding: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 20,
  },
  introSubtitle: {
    fontSize: 20,
    lineHeight: 28,
    marginBottom: spacing.lg,
  },
  centerLoading: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 20,
    lineHeight: 28,
  },
  contactsList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  contactCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 24,
    lineHeight: 30,
  },
  contactRelation: {
    fontSize: 18,
    lineHeight: 24,
    marginTop: 2,
  },
  contactPhone: {
    fontSize: 18,
    lineHeight: 24,
    marginTop: 4,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  actionBtnEdit: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.paper,
  },
  actionBtnDelete: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.dangerText,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
  },
  actionBtnText: {
    fontSize: 18,
    lineHeight: 24,
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  limitBannerText: {
    fontSize: 18,
    lineHeight: 24,
  },
  addContactBtn: {
    marginTop: spacing.md,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42,20,23,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    maxHeight: '90%',
  },
  modalScroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: 26,
    lineHeight: 34,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  fieldGap: {
    marginBottom: spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.button,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerText,
  },
  errorText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  helpText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  testSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  testSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.calmSoft,
    borderRadius: radius.button,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.calm,
  },
  testErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.button,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.dangerText,
  },
  testResultText: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },

  // Confirm delete modal
  confirmCard: {
    backgroundColor: colors.paper,
    margin: spacing.lg,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.xl,
    alignItems: 'center',
    alignSelf: 'center',
    width: '90%',
  },
  deleteCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  confirmSub: {
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  confirmActions: {
    width: '100%',
  },
});
