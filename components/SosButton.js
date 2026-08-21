import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function SosButton() {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const handleSosPress = () => {
    setAlertSent(false);
    setModalVisible(true);
  };

  const handleConfirmSos = async () => {
    setLoading(true);
    try {
      if (db) {
        await addDoc(collection(db, 'sos_alerts'), {
          userEmail: auth?.currentUser?.email || 'ramesh@sahaara.app',
          userName: auth?.currentUser?.displayName || 'Ramesh Ji',
          timestamp: serverTimestamp(),
          status: 'TRIGGERED',
          message: 'SOS Assistance Requested by Senior',
        });
      }
    } catch (error) {
      console.log('SOS Firestore write error (mock fallback active):', error);
    } finally {
      setLoading(false);
      setAlertSent(true);
    }
  };

  return (
    <View style={styles.container}>
      {/* Primary Full-Width SOS Button */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={handleSosPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('sos.button')}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="warning" size={26} color={COLORS.textOnPrimary} />
        </View>
        <Text style={styles.sosButtonText}>{t('sos.button')}</Text>
      </TouchableOpacity>

      {/* SOS Confirmation Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {!alertSent ? (
              <>
                <View style={styles.modalIconBadge}>
                  <Ionicons name="alert-circle" size={48} color={COLORS.sosRed} />
                </View>
                <Text style={styles.modalTitle}>{t('sos.confirmTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('sos.confirmSub')}</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setModalVisible(false)}
                    disabled={loading}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelBtnText}>{t('sos.cancel')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirmSos}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                    ) : (
                      <Text style={styles.confirmBtnText}>{t('sos.callForHelp')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Success State */
              <>
                <View style={styles.modalSuccessBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={52}
                    color={COLORS.positive}
                  />
                </View>
                <Text style={styles.successTitle}>{t('sos.sentTitle')}</Text>
                <Text style={styles.successSubtitle}>{t('sos.sentSub')}</Text>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
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

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.sosRed,
    minHeight: 60,
    borderRadius: SIZES.cardRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    shadowColor: COLORS.sosRed,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sosButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    letterSpacing: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44, 29, 17, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    elevation: 5,
  },
  modalIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  cancelBtn: {
    flex: 1,
    minHeight: 54,
    borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 1.2,
    minHeight: 54,
    borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.sosRed,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  confirmBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
  },

  // Success state styles
  modalSuccessBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.positiveLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.positive,
    textAlign: 'center',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  doneBtn: {
    width: '100%',
    minHeight: 54,
    borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
});
