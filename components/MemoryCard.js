import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

// Seed fallback — shown when Firestore is empty
const SEED_PREVIEW = {
  title: 'Wedding Day in Jaipur',
  titleHi: 'जयपुर में विवाह',
  story: 'Papa had arranged a baraat of 200 people. Amma wore the red Banarasi saree. The shehnai played all night.',
  storyHi: 'पापा ने 200 लोगों की बारात की। अम्मा ने लाल बनारसी साड़ी पहनी। पूरी रात शहनाई बजती रही।',
  year: '1982',
  photo: 'https://picsum.photos/id/1005/200/200',
};

export default function MemoryCard() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const isHindi = language === 'hi';

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  useFocusEffect(
    React.useCallback(() => {
      loadMemory();
    }, [uid])
  );

  const loadMemory = async () => {
    if (!uid || !db) { setLoading(false); return; }
    try {
      const memoriesRef = collection(db, 'users', uid, 'memories');
      const q = query(memoriesRef, orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setMemory({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setMemory(null); // will show seed fallback
      }
    } catch (_) {
      setMemory(null);
    } finally {
      setLoading(false);
    }
  };

  // Resolve display data — Firestore doc OR seed fallback
  const display = memory
    ? {
        title: memory.title,
        story: memory.story || memory.description || '',
        year: memory.year || memory.date || '',
        photo: memory.photoUrl || memory.photoLocalUri || null,
      }
    : {
        title: isHindi ? SEED_PREVIEW.titleHi : SEED_PREVIEW.title,
        story: isHindi ? SEED_PREVIEW.storyHi : SEED_PREVIEW.story,
        year: SEED_PREVIEW.year,
        photo: SEED_PREVIEW.photo,
      };

  const handlePress = () => {
    if (memory?.id) {
      router.push({ pathname: '/memory-detail', params: { memoryId: memory.id } });
    } else {
      router.push('/yaadein');
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={22} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{isHindi ? 'आज की याद' : 'Memory of the Day'}</Text>
        </View>
        {display.year ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{display.year}</Text>
          </View>
        ) : null}
      </View>

      {/* Content */}
      <View style={styles.contentBox}>
        {display.photo ? (
          <Image source={{ uri: display.photo }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="images" size={28} color={COLORS.textLight} />
          </View>
        )}
        <View style={styles.textContent}>
          <Text style={styles.memoryTitle} numberOfLines={2}>{display.title}</Text>
          <Text style={styles.quoteText} numberOfLines={3}>"{display.story}"</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="arrow-forward-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.footerText}>
          {isHindi ? 'सभी यादें देखें' : 'View all memories'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAF4EB',
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#E8D5C4',
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.primary, marginLeft: 8 },
  badge: {
    backgroundColor: '#EFE2D3', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  contentBox: { flexDirection: 'row', marginBottom: 14 },
  thumb: {
    width: 86, height: 86, borderRadius: 14,
    backgroundColor: COLORS.surfaceSecondary, marginRight: SPACING.md,
  },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  textContent: { flex: 1 },
  memoryTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 5 },
  quoteText: { fontSize: 13, fontStyle: 'italic', color: COLORS.textSecondary, lineHeight: 19 },
  footer: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#E8D8C8', paddingTop: 12, gap: 6,
  },
  footerText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});