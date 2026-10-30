/**
 * components/ScreenHeader.js
 * Standard header: screen title (left, big serif) + SOS pill (right).
 * Used on every main screen.
 * Usage: <ScreenHeader title="होम" lang="hi" />
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../context/LanguageContext';
import {
  colors,
  spacing,
  radius,
  sizes,
  fonts,
  textStyle,
} from '../constants/theme';
import SawtoothEdge from './SawtoothEdge';
import SosModal from './SosModal';

export default function ScreenHeader({ title, showBack = false, onBack }) {
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const lang = language;
  const isHindi = lang === 'hi';

  const [sosVisible, setSosVisible] = useState(false);
  const [sosPressed, setSosPressed] = useState(false);

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.titleRow}>
          {showBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'वापस जाएं' : 'Go back'}
            >
              <Ionicons name="arrow-back" size={sizes.icon} color={colors.onPrimary} />
              <Text style={styles.backLabel}>{isHindi ? 'वापस' : 'Back'}</Text>
            </TouchableOpacity>
          )}
          <Text style={[textStyle('title', lang, colors.onPrimary), styles.title]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* SOS Pill on maroon header: WHITE with red icon and text */}
        <TouchableOpacity
          style={[styles.sosPill, sosPressed && styles.sosPillPressed]}
          onPress={() => setSosVisible(true)}
          onPressIn={() => setSosPressed(true)}
          onPressOut={() => setSosPressed(false)}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'आपातकालीन सहायता' : 'Emergency SOS'}
        >
          <Ionicons name="warning" size={20} color={colors.sos} />
          <Text style={styles.sosLabel}>SOS</Text>
        </TouchableOpacity>
      </View>

      <SawtoothEdge color={colors.primary} />

      {/* Unified SOS Modal with WhatsApp alert & GPS location */}
      <SosModal
        visible={sosVisible}
        onClose={() => setSosVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.sm,
    backgroundColor: colors.heroBg,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  title: {
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
    minHeight: sizes.touchMin,
  },
  backLabel: {
    fontFamily: fonts.bodyStrong,
    fontSize: 18,
    color: colors.onPrimary,
    marginLeft: spacing.xs,
  },
  sosPill: {
    backgroundColor: colors.sosWhite,
    height: sizes.sos,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sosPillPressed: {
    backgroundColor: colors.paperDeep,
  },
  sosLabel: {
    fontFamily: fonts.button,
    fontSize: 18,
    color: colors.sos,
    lineHeight: 22,
  },
});
