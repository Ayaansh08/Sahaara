import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../firebase/config';
import { useTranslation } from '../../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import SectionHeading from '../../components/SectionHeading';
import FeatureCard from '../../components/FeatureCard';
import MemoryCard from '../../components/MemoryCard';
import WellnessCard from '../../components/WellnessCard';
import SosButton from '../../components/SosButton';
import LanguageToggle from '../../components/LanguageToggle';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Get current user display name
  const currentUser = auth.currentUser;
  const userName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Ramesh Ji');

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header (Greeting, Language Toggle & Avatar) */}
        <View style={styles.headerRow}>
          {/* Left: Greeting */}
          <View style={styles.headerLeft}>
            <Text style={styles.greetingTitle}>
              {t('home.greeting')}
            </Text>
            <Text style={styles.dateText}>{t('home.datePrefix')}</Text>
            <Text style={styles.subGreeting}>{t('home.subGreeting')}</Text>
          </View>

          {/* Right: Language Toggle + Profile Avatar */}
          <View style={styles.headerRight}>
            <LanguageToggle />
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open Profile"
            >
              <Ionicons name="person" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. SAATHI Hero Card (Dominant Accent Component) */}
        <View style={styles.heroCard}>
          {/* Top Brand Pill */}
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Ionicons
                name="heart-circle"
                size={24}
                color={COLORS.textOnPrimary}
              />
              <Text style={styles.heroBadgeText}>SAATHI</Text>
            </View>
          </View>

          {/* Warm Companion Prompts */}
          <Text style={styles.heroPromptTitle}>
            {t('saathi.prompt')}
          </Text>
          <Text style={styles.heroPromptSub}>
            {t('saathi.subtext')}
          </Text>

          {/* Action Buttons: Baat Karein & Voice Karein */}
          <View style={styles.heroActionRow}>
            <TouchableOpacity
              style={styles.heroBtnPrimary}
              onPress={() => router.push('/saathi-chat')}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t('saathi.chatButton')}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.heroBtnPrimaryText}>
                {t('saathi.chatButton')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroBtnSecondary}
              onPress={() => router.push('/saathi-voice')}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityLabel={t('saathi.voiceButton')}
            >
              <Ionicons
                name="mic"
                size={22}
                color={COLORS.textOnPrimary}
              />
              <Text style={styles.heroBtnSecondaryText}>
                {t('saathi.voiceButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. "For You" Section (2-Column Feature Cards) */}
        <SectionHeading title={t('home.forYou')} iconName="apps-outline" />
        <View style={styles.featureGrid}>
          <View style={styles.gridRow}>
            <FeatureCard
              title={t('feature.family.title')}
              subtitle={t('feature.family.subtitle')}
              iconName="people"
              onPress={() => router.push('/family')}
            />
            <FeatureCard
              title={t('feature.memories.title')}
              subtitle={t('feature.memories.subtitle')}
              iconName="images"
              onPress={() => router.push('/yaadein')}
            />
          </View>

          <View style={styles.gridRow}>
            <FeatureCard
              title={t('feature.bhajan.title')}
              subtitle={t('feature.bhajan.subtitle')}
              iconName="musical-notes"
              onPress={() => router.push('/bhajan')}
            />
            <FeatureCard
              title={t('feature.elderCircle.title')}
              subtitle={t('feature.elderCircle.subtitle')}
              iconName="people-circle"
              onPress={() => router.push('/elder-circle')}
            />
          </View>
        </View>

        {/* 4. "Memory of the Day" Card */}
        <MemoryCard />

        {/* 5. Wellness Section — "Today's Wellbeing" */}
        <WellnessCard />

        {/* 6. SOS Button (Persistent at Bottom) */}
        <SosButton />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md + 2,
    paddingTop: SPACING.xs,
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  greetingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  subGreeting: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: '#E5D5C5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  // 2. SAATHI Hero Card
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.cardRadius + 2,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  heroBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 6,
    letterSpacing: 1,
  },
  heroPromptTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginBottom: 4,
  },
  heroPromptSub: {
    fontSize: 17,
    fontWeight: '500',
    color: '#F8EAE1',
    marginBottom: 20,
  },
  heroActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textOnPrimary,
    minHeight: 54,
    borderRadius: SIZES.buttonRadius,
    marginRight: 6,
    paddingHorizontal: 8,
  },
  heroBtnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 6,
  },
  heroBtnSecondary: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderColor: COLORS.textOnPrimary,
    minHeight: 54,
    borderRadius: SIZES.buttonRadius,
    marginLeft: 6,
    paddingHorizontal: 8,
  },
  heroBtnSecondaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 6,
  },

  // 3. Feature Grid
  featureGrid: {
    marginVertical: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
