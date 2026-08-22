import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES } from '../constants/theme';

export default function LanguageToggle() {
  const { language, setLanguage } = useTranslation();

  const toggleLanguage = () => {
    setLanguage(language === 'hi' ? 'en' : 'hi');
  };

  return (
    <TouchableOpacity
      style={styles.toggleContainer}
      onPress={toggleLanguage}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Switch language. Current language is ${
        language === 'hi' ? 'Hindi' : 'English'
      }`}
    >
      <View
        style={[
          styles.segment,
          language === 'hi' ? styles.segmentActive : styles.segmentInactive,
        ]}
      >
        <Text
          style={[
            styles.label,
            language === 'hi' ? styles.labelActive : styles.labelInactive,
          ]}
        >
          हिं
        </Text>
      </View>

      <View
        style={[
          styles.segment,
          language === 'en' ? styles.segmentActive : styles.segmentInactive,
        ]}
      >
        <Text
          style={[
            styles.label,
            language === 'en' ? styles.labelActive : styles.labelInactive,
          ]}
        >
          EN
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFE5D8',
    borderRadius: 24,
    padding: 3,
    minHeight: 52,
    minWidth: 104,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentInactive: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
  },
  labelActive: {
    color: COLORS.textOnPrimary,
  },
  labelInactive: {
    color: COLORS.textSecondary,
  },
});
