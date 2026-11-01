/**
 * app/(tabs)/home.js
 * Sahaara Home Screen — Kanjeevaram Color-Block Design.
 * Senior-first, silk-and-gold warmth, high contrast, zero generic cards.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTranslation } from '../../context/LanguageContext';
import {
  colors, fonts, radius, sizes, border, spacing, textStyle,
} from '../../constants/theme';
import SawtoothEdge from '../../components/SawtoothEdge';
import ArchFrame from '../../components/ArchFrame';
import SosModal from '../../components/SosModal';
import { transliterateName } from '../../services/saathiService';

// Seed fallback memory for when Firestore has no memories yet
const SEED_MEMORY = {
  id: 'seed-1',
  title: 'Shimla Family Trip',
  titleHi: 'शिमला परिवार यात्रा',
  year: '1995',
  date: '1995',
  story: 'First family vacation to the hills. Snow everywhere, children laughing, and hot chai at every stop.',
  storyHi: 'पहाड़ों पर पहली पारिवारिक छुट्टी। हर जगह बर्फ, बच्चों की हँसी और हर मोड़ पर गरम चाय।',
  photoUrl: 'https://picsum.photos/id/167/600/600',
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  // Clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auth & City prompt state
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [savingCity, setSavingCity] = useState(false);

  // SOS Modal
  const [showSosModal, setShowSosModal] = useState(false);

  // Mood State
  const [selectedMood, setSelectedMood] = useState(null);
  const [isMoodCollapsed, setIsMoodCollapsed] = useState(false);

  // Memory of the Day
  const [memoryOfTheDay, setMemoryOfTheDay] = useState(null);
  const [memoryLoading, setMemoryLoading] = useState(true);

  // Auth state & City check
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        const promptKey = `@sahaara_city_prompted_${user.uid}`;
        const alreadyPrompted = await AsyncStorage.getItem(promptKey);
        if (alreadyPrompted) return;

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
        } catch (_) {}
      }
    });
    return () => unsubscribe();
  }, []);

  // Load saved mood
  useEffect(() => {
    const todayKey = `@sahaara_today_mood_${new Date().toISOString().slice(0, 10)}`;
    AsyncStorage.getItem(todayKey).then((saved) => {
      if (saved) {
        setSelectedMood(saved);
        setIsMoodCollapsed(true);
      }
    });
  }, []);

  // Fetch memory of the day
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadMemory = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid || !db) {
          if (isMounted) {
            setMemoryOfTheDay(SEED_MEMORY);
            setMemoryLoading(false);
          }
          return;
        }
        try {
          const memoriesRef = collection(db, 'users', uid, 'memories');
          const q = query(memoriesRef, orderBy('createdAt', 'desc'), limit(1));
          const snap = await getDocs(q);
          if (isMounted) {
            if (!snap.empty) {
              setMemoryOfTheDay({ id: snap.docs[0].id, ...snap.docs[0].data() });
            } else {
              setMemoryOfTheDay(SEED_MEMORY);
            }
          }
        } catch (_) {
          if (isMounted) setMemoryOfTheDay(SEED_MEMORY);
        } finally {
          if (isMounted) setMemoryLoading(false);
        }
      };
      loadMemory();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  // User name transliteration
  const rawUserName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : '');

  const [hindiName, setHindiName] = useState(rawUserName);
  useEffect(() => {
    if (rawUserName) {
      transliterateName(rawUserName).then((translated) => {
        setHindiName(translated);
      });
    }
  }, [rawUserName]);

  // Greeting
  const userName = isHindi ? hindiName : rawUserName;
  const greeting = isHindi
    ? (userName ? `नमस्ते, ${userName} जी` : 'नमस्ते जी')
    : (userName ? `Namaste, ${userName} ji` : 'Namaste');

  // Formatted Date
  const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  const locale = isHindi ? 'hi-IN' : 'en-IN';
  const formattedDate = now.toLocaleDateString(locale, dateOptions);

  // Save city prompt
  const saveCity = async () => {
    const trimmed = cityInput.trim();
    const user = auth.currentUser;
    const promptKey = user ? `@sahaara_city_prompted_${user.uid}` : null;
    if (!trimmed) {
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

  // Handle Mood selection
  const handleMoodSelect = async (moodId) => {
    setSelectedMood(moodId);
    setIsMoodCollapsed(true);
    const todayKey = `@sahaara_today_mood_${new Date().toISOString().slice(0, 10)}`;
    try {
      await AsyncStorage.setItem(todayKey, moodId);
    } catch (_) {}
  };

  // Mood Config
  const MOODS = [
    { id: 'happy', labelHi: 'अच्छा', labelEn: 'Great', icon: 'happy' },
    { id: 'content', labelHi: 'ठीक', labelEn: 'Good', icon: 'sunny' },
    { id: 'neutral', labelHi: 'ऐसा-वैसा', labelEn: 'Okay', icon: 'partly-sunny' },
    { id: 'sad', labelHi: 'दुखी', labelEn: 'Low', icon: 'cloud' },
  ];

  const currentMoodObj = MOODS.find((m) => m.id === selectedMood);

  // Resolve memory details
  const displayMemoryTitle = memoryOfTheDay
    ? (isHindi && memoryOfTheDay.titleHi ? memoryOfTheDay.titleHi : memoryOfTheDay.title)
    : (isHindi ? 'कोई याद नहीं' : 'No memories yet');

  const displayMemoryYear = memoryOfTheDay
    ? (memoryOfTheDay.year || memoryOfTheDay.date || '')
    : '';

  const displayMemoryStory = memoryOfTheDay
    ? (isHindi && memoryOfTheDay.storyHi ? memoryOfTheDay.storyHi : (memoryOfTheDay.story || memoryOfTheDay.description || ''))
    : (isHindi ? 'अपनी पुरानी यादों और तस्वीरों को यहाँ सहेजें।' : 'Save your precious family photos and stories here.');

  const displayMemoryPhoto = memoryOfTheDay
    ? (memoryOfTheDay.photoUrl || memoryOfTheDay.photoLocalUri || (memoryOfTheDay.photos && memoryOfTheDay.photos[0]) || null)
    : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.heroBg} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* 1. HERO BLOCK: Full-bleed solid maroon, extending under status bar */}
        {/* ================================================================= */}
        <View style={[styles.heroBlock, { paddingTop: insets.top + spacing.sm }]}>
          {/* Header Row: Gold Logo Mark + "Sahaara" (left) | White SOS Pill (right) */}
          <View style={styles.heroHeaderRow}>
            <View style={styles.logoMarkRow}>
              <View style={styles.goldLogoMark}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <Text style={styles.brandTitle}>Sahaara</Text>
            </View>

            {/* SOS Pill: 56px tall, WHITE with RED icon and text */}
            <TouchableOpacity
              style={styles.heroSosPill}
              onPress={() => setShowSosModal(true)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'एसओएस आपातकालीन सहायता' : 'SOS Emergency Help'}
            >
              <Ionicons name="warning" size={22} color={colors.sos} />
              <Text style={styles.heroSosText}>SOS</Text>
            </TouchableOpacity>
          </View>

          {/* Greeting: 32px serif in cream */}
          <Text style={[textStyle('greeting', lang, colors.onPrimary), styles.greetingText]}>
            {greeting}
          </Text>

          {/* Date: 18px in light gold */}
          <Text style={styles.heroDateText}>{formattedDate}</Text>

          {/* Button 1 (Main Action): Full-width 64px cream button with maroon text & big mic icon */}
          <TouchableOpacity
            style={styles.heroMainBtn}
            onPress={() => router.push('/saathi-voice')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'साथी से बात करें' : 'Talk to Saathi'}
          >
            <Ionicons name="mic" size={28} color={colors.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.heroMainBtnText}>
              {isHindi ? 'साथी से बात करें' : 'Talk to Saathi'}
            </Text>
          </TouchableOpacity>

          {/* Button 2: Full-width outlined button (2px cream border, cream text) */}
          <TouchableOpacity
            style={styles.heroSecondaryBtn}
            onPress={() => router.push('/saathi-chat')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'लिख कर बात करें' : 'Chat with Saathi'}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.onPrimary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.heroSecondaryBtnText}>
              {isHindi ? 'लिख कर बात करें' : 'Chat with Saathi'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SAW-TOOTH BOTTOM EDGE: torn receipt / ticket downward-pointing triangles */}
        <SawtoothEdge color={colors.primary} />

        {/* ================================================================= */}
        {/* BODY: Sits directly on cream (#FAF3E3) with NO boxed card around it */}
        {/* ================================================================= */}
        <View style={styles.bodyContent}>
          {/* 2. LANGUAGE TOGGLE: Full-width 56px two-option control, 2px maroon border */}
          <View style={styles.languageControlContainer}>
            <TouchableOpacity
              style={[
                styles.langOption,
                isHindi ? styles.langOptionActive : styles.langOptionInactive,
              ]}
              onPress={() => setLanguage('hi')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="हिंदी"
              accessibilityState={{ selected: isHindi }}
            >
              <Text
                style={[
                  styles.langOptionText,
                  isHindi ? styles.langOptionTextActive : styles.langOptionTextInactive,
                ]}
              >
                हिंदी
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.langOption,
                !isHindi ? styles.langOptionActive : styles.langOptionInactive,
              ]}
              onPress={() => setLanguage('en')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="English"
              accessibilityState={{ selected: !isHindi }}
            >
              <Text
                style={[
                  styles.langOptionText,
                  !isHindi ? styles.langOptionTextActive : styles.langOptionTextInactive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
          </View>

          {/* 3. MOOD SECTION ("Aaj kaisa lag raha hai?") */}
          <View style={styles.sectionBlock}>
            <Text style={[textStyle('sectionHeading', lang, colors.ink), styles.sectionHeading]}>
              {isHindi ? 'आज कैसा लग रहा है?' : 'How are you feeling today?'}
            </Text>

            {!isMoodCollapsed ? (
              /* Four round 64px circle buttons, NO card around them */
              <View style={styles.moodCirclesRow}>
                {MOODS.map((m) => {
                  const isSelected = selectedMood === m.id;
                  const label = isHindi ? m.labelHi : m.labelEn;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.moodCol}
                      onPress={() => handleMoodSelect(m.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View
                        style={[
                          styles.moodCircle,
                          isSelected ? styles.moodCircleSelected : styles.moodCircleUnselected,
                        ]}
                      >
                        <Ionicons
                          name={m.icon}
                          size={30}
                          color={isSelected ? colors.onPrimary : colors.ink}
                        />
                      </View>
                      <Text style={[textStyle('label', lang, colors.ink), styles.moodLabel]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              /* Collapsed one-line state with a change button */
              <View style={styles.moodCollapsedRow}>
                <View style={styles.moodCollapsedLeft}>
                  <View style={styles.moodCollapsedIconBadge}>
                    <Ionicons
                      name={currentMoodObj ? currentMoodObj.icon : 'happy'}
                      size={24}
                      color={colors.onPrimary}
                    />
                  </View>
                  <Text style={[textStyle('bodyStrong', lang, colors.ink), styles.moodCollapsedText]}>
                    {isHindi ? 'आज आपने बताया:' : 'Today you shared:'}{' '}
                    <Text style={{ color: colors.calm }}>
                      {currentMoodObj ? (isHindi ? currentMoodObj.labelHi : currentMoodObj.labelEn) : ''}
                    </Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.moodChangeBtn}
                  onPress={() => setIsMoodCollapsed(false)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={isHindi ? 'हाल बदलें' : 'Change mood'}
                >
                  <Text style={[textStyle('button', lang, colors.primary), styles.moodChangeText]}>
                    {isHindi ? 'बदलें' : 'Change'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 4. AAJ KI YAAD (Memory of the Day) */}
          <View style={styles.sectionBlock}>
            <Text style={[textStyle('sectionHeading', lang, colors.ink), styles.sectionHeading]}>
              {isHindi ? 'आज की याद' : "Today's Memory"}
            </Text>

            {memoryLoading ? (
              <View style={styles.memoryLoadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : memoryOfTheDay ? (
              <TouchableOpacity
                style={styles.memoryRowLayout}
                onPress={() => router.push('/yaadein')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={displayMemoryTitle}
              >
                {/* Left: ArchFrame Photo (120x150, 3px gold frame) */}
                <ArchFrame
                  uri={displayMemoryPhoto}
                  width={120}
                  height={150}
                  fallbackIcon="images-outline"
                  fallbackLabel={!displayMemoryPhoto ? (isHindi ? 'फ़ोटो नहीं है' : 'No photo') : null}
                />

                {/* Right: Year, Title/Place (22px serif), Story 2 lines (18px) */}
                <View style={styles.memoryTextContent}>
                  {displayMemoryYear ? (
                    <Text style={styles.memoryYearText}>{displayMemoryYear}</Text>
                  ) : null}
                  <Text
                    style={[textStyle('sectionHeading', lang, colors.ink), styles.memoryTitleText]}
                    numberOfLines={1}
                  >
                    {displayMemoryTitle}
                  </Text>
                  <Text
                    style={[textStyle('label', lang, colors.inkSoft), styles.memoryStoryText]}
                    numberOfLines={2}
                  >
                    {displayMemoryStory}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              /* No memories: arch with invitation + add button */
              <View style={styles.memoryRowLayout}>
                <ArchFrame width={120} height={150} fallbackIcon="add-outline" />
                <View style={styles.memoryTextContent}>
                  <Text style={[textStyle('sectionHeading', lang, colors.ink), styles.memoryTitleText]}>
                    {isHindi ? 'कोई याद नहीं है' : 'No memories yet'}
                  </Text>
                  <Text style={[textStyle('label', lang, colors.inkSoft), styles.memoryStoryText]} numberOfLines={2}>
                    {isHindi ? 'अपनी पहली पारिवारिक याद जोड़ें।' : 'Add your first family memory.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.addMemoryBtn}
                    onPress={() => router.push('/add-memory')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Text style={[textStyle('button', lang, colors.primary), { fontSize: 18 }]}>
                      {isHindi ? 'नई याद जोड़ें' : 'Add Memory'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* 5. TWO COLOR-BLOCK ROWS (Bhajan & Wellness) */}
          <View style={styles.colorBlockRowsContainer}>
            {/* Bhajan Row: Solid Bottle Green (#1F5C4D), cream text, 72px+ tall, 16px radius */}
            <TouchableOpacity
              style={[styles.colorBlockRow, { backgroundColor: colors.calm }]}
              onPress={() => router.push('/bhajan')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'भजन' : 'Bhajans'}
            >
              <View style={styles.colorBlockIconBox}>
                <Ionicons name="musical-notes" size={32} color={colors.onPrimary} />
              </View>
              <View style={styles.colorBlockTextCol}>
                <Text style={styles.colorBlockTitleGreen}>
                  {isHindi ? 'भजन' : 'Bhajans'}
                </Text>
                <Text style={styles.colorBlockDescGreen}>
                  {isHindi ? 'आज कुछ सुनते हैं' : 'Listen to daily bhajans & stories'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={26} color={colors.onPrimary} />
            </TouchableOpacity>

            {/* Wellness Row: Solid Gold (#C9962B), ink text, 72px+ tall, 16px radius */}
            <TouchableOpacity
              style={[styles.colorBlockRow, { backgroundColor: colors.gold }]}
              onPress={() => router.push('/wellness')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'दैनिक स्वास्थ्य' : 'Daily Wellness'}
            >
              <View style={[styles.colorBlockIconBox, { backgroundColor: 'rgba(42, 20, 23, 0.15)' }]}>
                <Ionicons name="heart" size={32} color={colors.ink} />
              </View>
              <View style={styles.colorBlockTextCol}>
                <Text style={styles.colorBlockTitleGold}>
                  {isHindi ? 'दैनिक स्वास्थ्य' : 'Daily Wellness'}
                </Text>
                <Text style={styles.colorBlockDescGold}>
                  {isHindi ? 'पानी और हल्की सैर का ध्यान' : 'Hydration & gentle activity'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={26} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* SOS Confirm Modal */}
      <SosModal
        visible={showSosModal}
        onClose={() => setShowSosModal(false)}
      />

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
              <Ionicons name="location-outline" size={36} color={colors.primary} />
            </View>
            <Text style={[textStyle('heading', lang, colors.ink), { textAlign: 'center', marginBottom: spacing.xs }]}>
              {isHindi ? 'आप कहाँ रहते हैं?' : 'Where do you live?'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), { textAlign: 'center', marginBottom: spacing.md }]}>
              {isHindi
                ? 'एल्डर सर्कल में अपना शहर दिखाएं ताकि पास के लोग आपसे जुड़ सकें।'
                : 'Show your city in Elder Circle so nearby members can connect with you.'}
            </Text>
            <TextInput
              style={styles.cityInput}
              placeholder={isHindi ? 'जैसे: दिल्ली, मुंबई, जयपुर' : 'e.g. Delhi, Mumbai, Jaipur'}
              placeholderTextColor={colors.inkSoft}
              value={cityInput}
              onChangeText={setCityInput}
              autoCapitalize="words"
              autoFocus
            />
            <View style={styles.cityModalBtns}>
              <TouchableOpacity
                style={styles.citySkipBtn}
                onPress={async () => {
                  const user = auth.currentUser;
                  if (user) {
                    await AsyncStorage.setItem(`@sahaara_city_prompted_${user.uid}`, 'skipped');
                  }
                  setShowCityPrompt(false);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={[textStyle('button', lang, colors.inkSoft), { fontSize: 18 }]}>
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
                <Text style={[textStyle('button', lang, colors.onPrimary), { fontSize: 18 }]}>
                  {savingCity
                    ? (isHindi ? 'सहेज रहे हैं...' : 'Saving...')
                    : (isHindi ? 'सहेजें' : 'Save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    flexGrow: 1,
  },

  // 1. HERO BLOCK
  heroBlock: {
    backgroundColor: colors.heroBg,
    width: '100%',
    paddingHorizontal: spacing.screenX,
    paddingBottom: 18, // 18px of maroon padding under the last button, above the teeth
    // Square sides, no radius
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoMarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goldLogoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  brandTitle: {
    fontFamily: fonts.en.heading,
    fontSize: 26,
    color: colors.onPrimary,
    lineHeight: 32,
  },
  heroSosPill: {
    backgroundColor: colors.sosWhite, // White pill
    height: sizes.sosHero,             // 56px tall
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroSosText: {
    fontFamily: fonts.button,
    fontSize: 18,
    color: colors.sos,                 // Red text
    lineHeight: 22,
  },
  greetingText: {
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  heroDateText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 18,
    lineHeight: 24,
    color: colors.goldLight,           // Light gold (#E8CF8E)
    marginBottom: spacing.lg,
  },
  heroMainBtn: {
    backgroundColor: colors.paper,     // Cream button
    minHeight: sizes.button,           // 64px tall
    borderRadius: radius.button,       // 16px radius
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroMainBtnText: {
    fontFamily: fonts.button,
    fontSize: 22,
    color: colors.primary,             // Maroon text
    lineHeight: 28,
  },
  heroSecondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: border.width,         // 2px cream border
    borderColor: colors.paper,
    minHeight: sizes.button,           // 64px tall
    borderRadius: radius.button,       // 16px radius
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  heroSecondaryBtnText: {
    fontFamily: fonts.button,
    fontSize: 22,
    color: colors.onPrimary,           // Cream text
    lineHeight: 28,
  },

  // BODY CONTENT
  bodyContent: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
  },

  // 2. LANGUAGE CONTROL (56px tall, 2px maroon border, 16px radius)
  languageControlContainer: {
    flexDirection: 'row',
    height: sizes.buttonSmall,         // 56px
    borderRadius: radius.button,       // 16px
    borderWidth: border.width,         // 2px
    borderColor: colors.primary,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    marginBottom: spacing.xl,
  },
  langOption: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionActive: {
    backgroundColor: colors.primary,   // Filled maroon
  },
  langOptionInactive: {
    backgroundColor: 'transparent',
  },
  langOptionText: {
    fontFamily: fonts.button,
    fontSize: 18,
    lineHeight: 24,
  },
  langOptionTextActive: {
    color: colors.onPrimary,           // Cream text
  },
  langOptionTextInactive: {
    color: colors.primary,             // Maroon text
  },

  // 3. SECTIONS
  sectionBlock: {
    marginBottom: spacing.xl,
  },
  sectionHeading: {
    fontSize: 22,
    marginBottom: spacing.md,
    textAlign: 'left',
  },

  // Mood Picker
  moodCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  moodCol: {
    alignItems: 'center',
    width: '23%',
  },
  moodCircle: {
    width: sizes.moodCircle,           // 64px circle
    height: sizes.moodCircle,
    borderRadius: sizes.moodCircle / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  moodCircleSelected: {
    backgroundColor: colors.calm,      // Bottle green (#1F5C4D)
  },
  moodCircleUnselected: {
    backgroundColor: colors.paperDeep, // Paper deep (#F0E3C6)
  },
  moodLabel: {
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
  },
  moodCollapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touchMin,
    paddingVertical: spacing.xs,
  },
  moodCollapsedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moodCollapsedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.calm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  moodCollapsedText: {
    fontSize: 18,
    lineHeight: 26,
    flex: 1,
  },
  moodChangeBtn: {
    minHeight: sizes.touchMin,
    minWidth: sizes.touchMin,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  moodChangeText: {
    textDecorationLine: 'underline',
  },

  // 4. Memory of the Day
  memoryLoadingRow: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memoryRowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 150,
    gap: spacing.md,
  },
  memoryTextContent: {
    flex: 1,
    justifyContent: 'center',
  },
  memoryYearText: {
    fontFamily: fonts.bodyStrong,
    fontSize: 18,
    color: colors.goldText,
    marginBottom: 2,
  },
  memoryTitleText: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 4,
  },
  memoryStoryText: {
    fontSize: 18,
    lineHeight: 24,
  },
  addMemoryBtn: {
    marginTop: spacing.sm,
    minHeight: sizes.buttonSmall,
    justifyContent: 'center',
  },

  // 5. COLOR-BLOCK ROWS (72px+ tall, 16px radius, 32px icon, 20px bold label, 16px desc)
  colorBlockRowsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  colorBlockRow: {
    minHeight: 76,
    borderRadius: radius.row,          // 16px radius
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colorBlockIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorBlockTextCol: {
    flex: 1,
  },
  colorBlockTitleGreen: {
    fontFamily: fonts.bodyStrong,
    fontSize: 20,
    lineHeight: 26,
    color: colors.onPrimary,
  },
  colorBlockDescGreen: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.calmSoft,
    marginTop: 2,
  },
  colorBlockTitleGold: {
    fontFamily: fonts.bodyStrong,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
  },
  colorBlockDescGold: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: colors.inkSoft,
    marginTop: 2,
  },

  // City Prompt Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 20, 23, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  cityModal: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.xl,
    width: '100%',
  },
  cityModalIcon: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cityInput: {
    borderWidth: border.width,
    borderColor: colors.line,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    minHeight: sizes.input,
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.paperDeep,
    marginBottom: spacing.lg,
  },
  cityModalBtns: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  citySkipBtn: {
    flex: 1,
    minHeight: sizes.buttonSmall,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  citySaveBtn: {
    flex: 1,
    minHeight: sizes.buttonSmall,
    borderRadius: radius.button,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
