/**
 * app/wellness.js
 * Stage 2 placeholder — replaced fully in Stage 2 with real data screens.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../context/LanguageContext';
import { colors, spacing, textStyle } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';

export default function WellnessScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isHindi ? 'आज की सेहत' : "Today's Wellness"}
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.body}>
        <Text style={[textStyle('heading', lang, colors.primary), styles.heading]}>
          {isHindi ? 'जल्द आ रहा है' : 'Coming Soon'}
        </Text>
        <Text style={[textStyle('body', lang, colors.inkSoft), styles.sub]}>
          {isHindi
            ? 'पानी, दवाई, सांस, व्यायाम और नींद — सब यहाँ आएंगे।'
            : 'Water, medicine, breathing, exercise and sleep — all coming here.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenX,
    gap: spacing.lg,
  },
  heading: { textAlign: 'center' },
  sub: { textAlign: 'center', fontSize: 20, lineHeight: 30 },
});
