/**
 * app/(tabs)/family.js
 * Merged Family + Elder Circle tab.
 * Two-option control at the top: Parivaar | Elder Circle.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../context/LanguageContext';
import { colors, spacing, radius, sizes, border, fonts, textStyle } from '../../constants/theme';
import FamilyScreen from '../family';
import ElderCircleScreen from '../elder-circle';

export default function FamilyTabScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  const [activeSection, setActiveSection] = useState('family'); // 'family' | 'circle'

  return (
    <View style={styles.container}>
      {/* Top Segmented Control (56px tall) */}
      <View style={[styles.toggleContainer, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeSection === 'family' && styles.segmentBtnActive]}
            onPress={() => setActiveSection('family')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'परिवार' : 'Family'}
          >
            <Text
              style={[
                textStyle('button', lang, activeSection === 'family' ? colors.onPrimary : colors.primary),
                styles.segmentText,
              ]}
            >
              {isHindi ? 'परिवार' : 'Family'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeSection === 'circle' && styles.segmentBtnActive]}
            onPress={() => setActiveSection('circle')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'एल्डर सर्कल' : 'Elder Circle'}
          >
            <Text
              style={[
                textStyle('button', lang, activeSection === 'circle' ? colors.onPrimary : colors.primary),
                styles.segmentText,
              ]}
            >
              {isHindi ? 'एल्डर सर्कल' : 'Elder Circle'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeSection === 'family' ? (
          <FamilyScreen />
        ) : (
          <ElderCircleScreen />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  toggleContainer: {
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.sm,
    borderBottomWidth: border.width,
    borderBottomColor: colors.line,
  },
  segmentedControl: {
    flexDirection: 'row',
    height: sizes.buttonSmall, // 56px tall
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 18,
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
});
