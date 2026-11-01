/**
 * app/(tabs)/more.js
 * "More" tab — big list rows for Bhajan, Wellness, Profile, and Language.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useTranslation } from '../../context/LanguageContext';
import { colors, spacing, radius, sizes, border, fonts, textStyle } from '../../constants/theme';
import ScreenHeader from '../../components/ScreenHeader';
import LanguageToggle from '../../components/LanguageToggle';

export default function MoreTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (_) {}
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={isHindi ? 'और सुविधाएं' : 'More Features'} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Row 1: Bhajan */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.calm }]}
          onPress={() => router.push('/bhajan')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'भजन और कथाएं' : 'Bhajans & Stories'}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="musical-notes" size={30} color={colors.onPrimary} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[textStyle('heading', lang, colors.onPrimary), styles.rowTitle]}>
              {isHindi ? 'भजन और कथाएं' : 'Bhajans & Stories'}
            </Text>
            <Text style={[textStyle('body', lang, colors.calmSoft), styles.rowDesc]}>
              {isHindi ? 'आज के भजन, आरतियां और प्रेरक कथाएं' : 'Daily hymns, prayers & stories'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color={colors.onPrimary} />
        </TouchableOpacity>

        {/* Row 2: Wellness */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.gold }]}
          onPress={() => router.push('/home')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'दैनिक स्वास्थ्य और हाल' : 'Daily Wellbeing'}
        >
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(42,20,23,0.15)' }]}>
            <Ionicons name="heart" size={30} color={colors.ink} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[textStyle('heading', lang, colors.ink), styles.rowTitle]}>
              {isHindi ? 'दैनिक स्वास्थ्य' : 'Daily Wellbeing'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.rowDesc]}>
              {isHindi ? 'पानी, हल्की सैर और आज का हाल' : 'Hydration, walks & mood check'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color={colors.ink} />
        </TouchableOpacity>

        {/* Row 2B: Smartwatch Vitals */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.paperDeep, borderWidth: border.width, borderColor: colors.line }]}
          onPress={() => router.push('/vitals')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'स्मार्टवॉच वाइटल्स' : 'Smartwatch Vitals'}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="pulse" size={28} color={colors.primary} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[textStyle('heading', lang, colors.primary), styles.rowTitle]}>
              {isHindi ? 'स्मार्टवॉच वाइटल्स' : 'Smartwatch Vitals'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.rowDesc]}>
              {isHindi ? 'हृदय गति, ऑक्सीजन व आपातकालीन निगरानी' : 'Heart rate, SpO2 & emergency detection'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>

        {/* Row 3: Profile */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.paperDeep, borderWidth: border.width, borderColor: colors.line }]}
          onPress={() => router.push('/profile')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'मेरी प्रोफाइल' : 'My Profile'}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[textStyle('heading', lang, colors.primary), styles.rowTitle]}>
              {isHindi ? 'मेरी प्रोफाइल' : 'My Profile'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.rowDesc]}>
              {isHindi ? 'व्यक्तिगत जानकारी और खाता सेटिंग्स' : 'Account details & settings'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>

        {/* Row 4: Emergency Contacts */}
        <TouchableOpacity
          style={[styles.rowCard, { backgroundColor: colors.paperDeep, borderWidth: border.width, borderColor: colors.line }]}
          onPress={() => router.push('/emergency-contacts')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'आपातकालीन संपर्क' : 'Emergency Contacts'}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.sos + '20' }]}>
            <Ionicons name="shield-checkmark" size={28} color={colors.sos} />
          </View>
          <View style={styles.rowTextCol}>
            <Text style={[textStyle('heading', lang, colors.ink), styles.rowTitle]}>
              {isHindi ? 'आपातकालीन संपर्क' : 'Emergency Contacts'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.rowDesc]}>
              {isHindi ? 'मुसीबत के समय व्हाट्सएप अलर्ट पाने वाले लोग' : 'WhatsApp alerts in an emergency'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={26} color={colors.primary} />
        </TouchableOpacity>

        {/* Row 4: Language Switcher Card */}
        <View style={styles.langCard}>
          <View style={styles.langHeader}>
            <Ionicons name="language" size={28} color={colors.primary} />
            <Text style={[textStyle('heading', lang, colors.primary), { marginLeft: spacing.sm }]}>
              {isHindi ? 'भाषा चुनें / Language' : 'Choose Language / भाषा'}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <LanguageToggle />
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isHindi ? 'साइन आउट' : 'Sign Out'}
        >
          <Ionicons name="log-out-outline" size={24} color={colors.dangerText} style={{ marginRight: spacing.sm }} />
          <Text style={[textStyle('button', lang, colors.dangerText)]}>
            {isHindi ? 'साइन आउट (बाहर निकलें)' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    gap: spacing.md,
  },
  rowCard: {
    minHeight: 76,
    borderRadius: radius.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  rowDesc: {
    fontSize: 18,
    lineHeight: 24,
    marginTop: 2,
  },
  langCard: {
    backgroundColor: colors.paperDeep,
    borderRadius: radius.row,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutBtn: {
    minHeight: sizes.button,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
