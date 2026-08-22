import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Modal, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { BHAJANS, CATEGORIES } from '../data/bhajans';
import { STORIES } from '../data/stories';
import { FESTIVALS } from '../data/festivals';
import { AUDIO_SOURCES } from '../data/audioSources';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSec(sec) {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function BhajanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentBhajan, setCurrentBhajan] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);

  // expo-audio — single stable player, replace() swaps tracks
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: true });
  }, []);

  // Auto next when track ends
  useEffect(() => {
    if (status.didJustFinish) handleNext();
  }, [status.didJustFinish]);

  // ── Audio controls ──────────────────────────────────────────────────────────

  const playBhajan = (bhajan) => {
    const source = AUDIO_SOURCES[bhajan.id];
    setCurrentBhajan(bhajan);
    if (!source) {
      Alert.alert(
        isHindi ? 'ऑडियो उपलब्ध नहीं' : 'Audio Not Available',
        isHindi
          ? `कृपया assets/audio/${bhajan.filename} जोड़ें।`
          : `Please add assets/audio/${bhajan.filename}`
      );
      return;
    }
    try { player.replace(source); player.play(); } catch (_) {}
  };

  const togglePlay = () => {
    if (!currentBhajan || !AUDIO_SOURCES[currentBhajan.id]) return;
    status.playing ? player.pause() : player.play();
  };

  const allBhajans = BHAJANS;

  const getFiltered = () => selectedCategory === 'all'
    ? allBhajans
    : allBhajans.filter(b => b.category === selectedCategory);

  const handleNext = () => {
    if (!currentBhajan) return;
    const list = getFiltered();
    const idx = list.findIndex(b => b.id === currentBhajan.id);
    playBhajan(list[(idx + 1) % list.length]);
  };

  const handlePrev = () => {
    if (!currentBhajan) return;
    const list = getFiltered();
    const idx = list.findIndex(b => b.id === currentBhajan.id);
    playBhajan(list[(idx - 1 + list.length) % list.length]);
  };

  const seekTo = (ratio) => {
    if (!AUDIO_SOURCES[currentBhajan?.id] || !status.duration) return;
    player.seekTo(ratio * status.duration);
  };

  // ── Upcoming festivals ──────────────────────────────────────────────────────

  const upcomingFestivals = FESTIVALS
    .filter(f => daysUntil(f.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const tabLabels = isHindi
    ? ['भजन', 'कथाएं', 'त्योहार']
    : ['Bhajans', 'Stories', 'Festivals'];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {isHindi ? 'भक्ति कोना' : 'Devotion Corner'}
          </Text>
          <Text style={styles.headerSub}>
            {isHindi ? 'भजन  •  कथाएं  •  त्योहार' : 'Bhajans  •  Stories  •  Festivals'}
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabLabels.map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && (
          <BhajansTab
            bhajans={getFiltered()}
            categories={CATEGORIES}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onPlay={playBhajan}
            currentBhajan={currentBhajan}
            isPlaying={status.playing}
            isHindi={isHindi}
          />
        )}
        {activeTab === 1 && (
          <StoriesTab stories={STORIES} isHindi={isHindi} onSelect={setSelectedStory} />
        )}
        {activeTab === 2 && (
          <FestivalsTab festivals={upcomingFestivals} isHindi={isHindi} />
        )}
      </View>

      {/* Mini Player */}
      {currentBhajan && (
        <MiniPlayer
          bhajan={currentBhajan}
          isPlaying={status.playing}
          position={status.currentTime}
          duration={status.duration ?? 0}
          isHindi={isHindi}
          onToggle={togglePlay}
          onNext={handleNext}
          onPrev={handlePrev}
          onSeek={seekTo}
          insets={insets}
        />
      )}

      {/* Story Modal */}
      {selectedStory && (
        <StoryModal
          story={selectedStory}
          isHindi={isHindi}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Bhajans Tab ──────────────────────────────────────────────────────────────

function BhajansTab({ bhajans, categories, selectedCategory, onSelectCategory, onPlay, currentBhajan, isPlaying, isHindi }) {
  return (
    <View style={{ flex: 1 }}>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
            onPress={() => onSelectCategory(cat.id)}
          >
            <Text style={[styles.chipText, selectedCategory === cat.id && styles.chipTextActive]}>
              {isHindi ? cat.labelHindi : cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={bhajans}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        renderItem={({ item }) => {
          const isActive = currentBhajan?.id === item.id;
          const hasAudio = !!AUDIO_SOURCES[item.id];
          return (
            <TouchableOpacity
              style={[styles.bhajanCard, isActive && styles.bhajanCardActive]}
              onPress={() => onPlay(item)}
              activeOpacity={0.75}
            >
              {/* Left icon */}
              <View style={[styles.bhajanIconBox, isActive && styles.bhajanIconBoxActive]}>
                <Ionicons
                  name="musical-notes"
                  size={22}
                  color={isActive ? '#fff' : COLORS.primary}
                />
              </View>

              {/* Info */}
              <View style={styles.bhajanInfo}>
                <Text style={[styles.bhajanTitle, isActive && styles.bhajanTitleActive]} numberOfLines={1}>
                  {isHindi ? item.titleHindi : item.title}
                </Text>
                <View style={styles.bhajanMetaRow}>
                  <Text style={styles.bhajanSinger} numberOfLines={1}>
                    {isHindi ? item.singerHindi : item.singer}
                  </Text>
                  {!hasAudio && (
                    <Text style={styles.noAudioTag}>
                      {isHindi ? 'फ़ाइल जोड़ें' : 'Add file'}
                    </Text>
                  )}
                </View>
              </View>

              {/* Duration + play */}
              <View style={styles.bhajanRight}>
                <Text style={styles.bhajanDuration}>{item.duration}</Text>
                <View style={[styles.playCircle, isActive && styles.playCircleActive]}>
                  <Ionicons
                    name={isActive && isPlaying ? 'pause' : 'play'}
                    size={16}
                    color={isActive ? '#fff' : COLORS.primary}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// ─── Stories Tab ──────────────────────────────────────────────────────────────

function StoriesTab({ stories, isHindi, onSelect }) {
  return (
    <FlatList
      data={stories}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.storyCard}
          onPress={() => onSelect(item)}
          activeOpacity={0.75}
        >
          <View style={styles.storyIconBox}>
            <Ionicons name="book-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.storyInfo}>
            <Text style={styles.storyDeity}>
              {isHindi ? item.deityHindi : item.deity}
            </Text>
            <Text style={styles.storyTitle} numberOfLines={2}>
              {isHindi ? item.titleHindi : item.title}
            </Text>
            <Text style={styles.storyLesson} numberOfLines={2}>
              {isHindi ? item.lessonHindi : item.lesson}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      )}
    />
  );
}

// ─── Festivals Tab ────────────────────────────────────────────────────────────

function FestivalsTab({ festivals, isHindi }) {
  if (festivals.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="calendar-outline" size={44} color={COLORS.textLight} />
        <Text style={styles.emptyText}>
          {isHindi ? 'कोई आगामी त्योहार नहीं' : 'No upcoming festivals'}
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={festivals}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const days = daysUntil(item.date);
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
        const isToday = days === 0;
        const isSoon  = days <= 7;

        return (
          <View style={styles.festivalCard}>
            <View style={styles.festivalTop}>
              <View style={styles.festivalIconBox}>
                <Ionicons name="calendar" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.festivalName}>
                  {isHindi ? item.nameHindi : item.name}
                </Text>
                <Text style={styles.festivalDate}>{dateStr}</Text>
              </View>
              <View style={[
                styles.daysBadge,
                isToday && styles.daysBadgeToday,
                isSoon && !isToday && styles.daysBadgeSoon,
              ]}>
                {isToday ? (
                  <Text style={styles.daysBadgeText}>
                    {isHindi ? 'आज' : 'Today'}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.daysBadgeNum}>{days}</Text>
                    <Text style={styles.daysBadgeLabel}>
                      {isHindi ? 'दिन' : 'days'}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <Text style={styles.festivalSig} numberOfLines={3}>
              {isHindi ? item.significanceHindi : item.significance}
            </Text>

            <View style={styles.divider} />

            <View style={styles.activitiesGrid}>
              {(isHindi ? item.activitiesHindi : item.activities).map((act, i) => (
                <View key={i} style={styles.activityRow}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginRight: 6, marginTop: 1 }} />
                  <Text style={styles.activityText}>{act}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      }}
    />
  );
}

// ─── Mini Player ──────────────────────────────────────────────────────────────

function MiniPlayer({ bhajan, isPlaying, position, duration, isHindi, onToggle, onNext, onPrev, onSeek, insets }) {
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const hasAudio = !!AUDIO_SOURCES[bhajan.id];

  return (
    <View style={[styles.miniPlayer, { paddingBottom: insets.bottom || 8 }]}>
      {/* Progress bar */}
      <TouchableOpacity
        activeOpacity={1}
        style={styles.progressTrack}
        onPress={(e) => {
          const ratio = e.nativeEvent.locationX / SCREEN_WIDTH;
          onSeek(Math.max(0, Math.min(1, ratio)));
        }}
      >
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </TouchableOpacity>

      <View style={styles.miniRow}>
        {/* Track info */}
        <View style={styles.miniIconBox}>
          <Ionicons name="musical-notes" size={18} color={COLORS.primary} />
        </View>
        <View style={styles.miniInfo}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {isHindi ? bhajan.titleHindi : bhajan.title}
          </Text>
          <Text style={styles.miniTime}>
            {hasAudio
              ? `${formatSec(position)}  /  ${formatSec(duration)}`
              : (isHindi ? 'फ़ाइल जोड़ें' : 'Add audio file')}
          </Text>
        </View>

        {/* Controls */}
        <TouchableOpacity onPress={onPrev} style={styles.ctrlBtn}>
          <Ionicons name="play-skip-back" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggle}
          style={styles.ctrlPlayBtn}
          disabled={!hasAudio}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color="#fff"
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} style={styles.ctrlBtn}>
          <Ionicons name="play-skip-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Story Modal ──────────────────────────────────────────────────────────────

function StoryModal({ story, isHindi, onClose }) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalDeityLabel}>
            {isHindi ? story.deityHindi : story.deity}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>
            {isHindi ? story.titleHindi : story.title}
          </Text>
          <Text style={styles.modalText}>
            {isHindi ? story.bodyHindi : story.body}
          </Text>
          <View style={styles.lessonBox}>
            <Text style={styles.lessonLabel}>
              {isHindi ? 'सीख' : 'Lesson'}
            </Text>
            <Text style={styles.lessonText}>
              {isHindi ? story.lessonHindi : story.lesson}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 6, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 24 },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1, letterSpacing: 0.3 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: 13, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  // List padding
  listContent: { padding: SPACING.md, paddingBottom: 160 },

  // Category chips
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: '#fff' },

  // Bhajan card
  bhajanCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  bhajanCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  bhajanIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  bhajanIconBoxActive: { backgroundColor: COLORS.primary },
  bhajanInfo: { flex: 1, marginRight: 8 },
  bhajanTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  bhajanTitleActive: { color: COLORS.primary },
  bhajanMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  bhajanSinger: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  noAudioTag: {
    fontSize: 10, color: '#B45309', fontWeight: '700',
    backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  bhajanRight: { alignItems: 'center', gap: 6 },
  bhajanDuration: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
  playCircle: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  playCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },

  // Story card
  storyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  storyIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  storyInfo: { flex: 1, marginRight: 6 },
  storyDeity: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
  },
  storyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 20 },
  storyLesson: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, lineHeight: 17 },

  // Festival card
  festivalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#3E2723', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  festivalTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  festivalIconBox: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  festivalName: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  festivalDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  daysBadge: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', minWidth: 52,
  },
  daysBadgeSoon: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  daysBadgeToday: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  daysBadgeNum: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
  daysBadgeLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  daysBadgeText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  festivalSig: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 10 },
  activitiesGrid: { gap: 5 },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start' },
  activityText: { fontSize: 13, color: COLORS.textPrimary, flex: 1, lineHeight: 19 },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' },

  // Mini player
  miniPlayer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 10,
  },
  progressTrack: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3, backgroundColor: COLORS.primary },
  miniRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  miniIconBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  miniInfo: { flex: 1, marginRight: 8 },
  miniTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  miniTime: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  ctrlBtn: { padding: 8 },
  ctrlPlayBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: 4,
  },

  // Story modal
  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalClose: { padding: 6, marginRight: 10 },
  modalDeityLabel: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  modalTitle: {
    fontSize: 22, fontWeight: '900', color: COLORS.textPrimary,
    lineHeight: 30, marginBottom: SPACING.md,
  },
  modalText: {
    fontSize: 16, color: COLORS.textDark, lineHeight: 26,
    marginBottom: SPACING.xl,
  },
  lessonBox: {
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    paddingLeft: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8, padding: SPACING.md,
  },
  lessonLabel: {
    fontSize: 12, fontWeight: '800', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  lessonText: { fontSize: 15, fontStyle: 'italic', color: COLORS.textSecondary, lineHeight: 22 },
});
