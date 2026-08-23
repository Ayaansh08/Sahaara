import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase/config';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '../../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import SectionHeading from '../../components/SectionHeading';
import FeatureCard from '../../components/FeatureCard';
import MemoryCard from '../../components/MemoryCard';
import WellnessCard from '../../components/WellnessCard';
import SosButton from '../../components/SosButton';
import LanguageToggle from '../../components/LanguageToggle';
import SahaaraLogo from '../../components/SahaaraLogo';
import { transliterateName } from '../../services/saathiService';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const [now, setNow] = useState(new Date());
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [savingCity, setSavingCity] = useState(false);

  // Update clock every minute so date/greeting stays current
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Reactively track current user so name stays when language toggles
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check if we already showed the city prompt to this user (skip memory)
        const promptKey = `@sahaara_city_prompted_${user.uid}`;
        const alreadyPrompted = await AsyncStorage.getItem(promptKey);
        if (alreadyPrompted) return; // never show again

        try {
          const ref = doc(db, 'users', user.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, {
              uid: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'Member',
              email: user.email || '',
              city: '',
              language: 'hi',
              isVisible: true,
              joinedAt: serverTimestamp(),
            });
            setShowCityPrompt(true);
          } else if (!snap.data()?.city) {
            setShowCityPrompt(true);
          }
        } catch (_) { /* non-blocking */ }
      }
    });
    return () => unsubscribe();
  }, []);

  const rawUserName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '');

  // Determine language mode early so it can be used below
  const isHindi = language === 'hi';

  // Hindi transliterated name (fetched from AI, cached in AsyncStorage)
  const [hindiName, setHindiName] = useState(rawUserName);
  useEffect(() => {
    if (rawUserName) {
      transliterateName(rawUserName).then((translated) => {
        setHindiName(translated);
      });
    }
  }, [rawUserName]);

  // Time-based greeting
  const userName = isHindi ? hindiName : rawUserName;
  const hour = now.getHours();
  let greetingWord;
  if (hour < 12) {
    greetingWord = isHindi ? 'शुभ प्रभात' : 'Good Morning';
  } else if (hour < 14) {
    greetingWord = isHindi ? 'शुभ दोपहर' : 'Good Afternoon';
  } else if (hour < 18) {
    greetingWord = isHindi ? 'नमस्ते' : 'Good Afternoon';
  } else {
    greetingWord = isHindi ? 'शुभ संध्या' : 'Good Evening';
  }

  const jiSuffix = isHindi ? 'जी' : 'Ji';
  const greeting = userName ? `${greetingWord}, ${userName} ${jiSuffix}` : greetingWord;

  // Real-time date formatted for Hindi or English
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const locale = isHindi ? 'hi-IN' : 'en-IN';
  const formattedDate = now.toLocaleDateString(locale, dateOptions);

  // ── Save city for old/new users ───────────────────────────────────────────
  const saveCity = async () => {
    const trimmed = cityInput.trim();
    const user = auth.currentUser;
    const promptKey = user ? `@sahaara_city_prompted_${user.uid}` : null;
    if (!trimmed) {
      // Treat empty submit same as skip
      if (promptKey) await AsyncStorage.setItem(promptKey, 'skipped');
      setShowCityPrompt(false);
      return;
    }
    setSavingCity(true);
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { city: trimmed });
        if (promptKey) await AsyncStorage.setItem(promptKey, 'saved');
      }
    } catch (_) {}
    setSavingCity(false);
    setShowCityPrompt(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* City Prompt Modal for users with no city */}
      <Modal
        visible={showCityPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityPrompt(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.cityModal}>
            <View style={styles.cityModalIcon}>
              <Ionicons name="location-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.cityModalTitle}>
              {isHindi ? 'आप कहाँ रहते हैं?' : 'Where do you live?'}
            </Text>
            <Text style={styles.cityModalSub}>
              {isHindi
                ? 'एल्डर सर्कल में अपना शहर दिखाएं ताकि पास के लोग आपसे जुड़ सकें।'
                : 'Show your city in Elder Circle so nearby members can connect with you.'}
            </Text>
            <TextInput
              style={styles.cityInput}
              placeholder={isHindi ? 'जैसे: दिल्ली, मुंबई, जयपुर' : 'e.g. Delhi, Mumbai, Jaipur'}
              placeholderTextColor={COLORS.textLight}
              value={cityInput}
              onChangeText={setCityInput}
              autoCapitalize="words"
              autoFocus
            />
            <View style={styles.cityModalBtns}>
              <TouchableOpacity
                style={styles.citySkipBtn}
                onPress={async () => {
                  // Remember that user chose to skip — never ask again
                  const user = auth.currentUser;
                  if (user) {
                    await AsyncStorage.setItem(`@sahaara_city_prompted_${user.uid}`, 'skipped');
                  }
                  setShowCityPrompt(false);
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
                <Text style={styles.citySkipText}>
                  {isHindi ? 'अभी नहीं' : 'Skip'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.citySaveBtn}
                onPress={saveCity}
                disabled={savingCity}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.citySaveText}>
                  {savingCity
                    ? (isHindi ? 'सहेज रहे हैं...' : 'Saving...')
                    : (isHindi ? 'सहेजें' : 'Save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header (Logo, Greeting, Language Toggle & Avatar) */}
        <View style={styles.headerRow}>
          <View style={styles.headerTopRow}>
            <SahaaraLogo showTagline={false} size={58} compact />
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

          <View style={styles.headerGreeting}>
            <Text style={styles.greetingTitle}>
              {greeting}
            </Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <Text style={styles.subGreeting}>{t('home.subGreeting')}</Text>
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
    marginBottom: SPACING.md,
    paddingHorizontal: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    paddingRight: SPACING.sm,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0,
    marginTop: SPACING.xs,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: '#E5D5C5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
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
    marginBottom: SPACING.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
  },
  heroBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 6,
    letterSpacing: 0,
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

  // City Prompt Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  cityModal: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.cardRadius,
    padding: SPACING.lg, width: '100%',
    shadowColor: COLORS.textPrimary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cityModalIcon: { alignItems: 'center', marginBottom: SPACING.sm + 2 },
  cityModalTitle: {
    fontSize: 20, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: SPACING.sm,
  },
  cityModalSub: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.md + 2,
  },
  cityInput: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: SIZES.inputRadius, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    fontSize: 16, color: COLORS.textPrimary,
    backgroundColor: COLORS.background, marginBottom: SPACING.md + 2,
  },
  cityModalBtns: { flexDirection: 'row', gap: SPACING.sm },
  citySkipBtn: {
    flex: 1, minHeight: SIZES.minTouchHeight, borderRadius: SIZES.buttonRadius,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  citySkipText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  citySaveBtn: {
    flex: 1, minHeight: SIZES.minTouchHeight, borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  citySaveText: { fontSize: 15, fontWeight: '700', color: COLORS.textOnPrimary },
});
