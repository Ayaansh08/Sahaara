/**
 * components/LanguageToggle.js
 * Large two-option language switcher — Hindi / English.
 * Senior-friendly: each option at least 44px tall, clear active state.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '../context/LanguageContext';
import { colors, spacing, radius, border, sizes, fonts } from '../constants/theme';

export default function LanguageToggle({ compact = false }) {
  const { language, setLanguage } = useTranslation();

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <TouchableOpacity
        style={[styles.option, language === 'hi' && styles.optionActive]}
        onPress={() => setLanguage('hi')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="हिन्दी"
        accessibilityState={{ selected: language === 'hi' }}
      >
        <Text style={[styles.label, language === 'hi' && styles.labelActive]}>हिं</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={[styles.option, language === 'en' && styles.optionActive]}
        onPress={() => setLanguage('en')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="English"
        accessibilityState={{ selected: language === 'en' }}
      >
        <Text style={[styles.label, language === 'en' && styles.labelActive]}>EN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperDeep,
    borderRadius: radius.pill,
    borderWidth: border.width,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  containerCompact: {},
  option: {
    minHeight: sizes.touchMin,
    minWidth: 56,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  optionActive: {
    backgroundColor: colors.primary,
  },
  divider: {
    width: border.width,
    height: 32,
    backgroundColor: colors.line,
  },
  label: {
    fontFamily: fonts.button,
    fontSize: 18,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  labelActive: {
    color: colors.onPrimary,
  },
});
