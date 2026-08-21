import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function MemoryCard() {
  const router = useRouter();
  const { t } = useTranslation();

  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoExists, setPhotoExists] = useState(false);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  useFocusEffect(
    React.useCallback(() => {
      loadMemory();
    }, [uid])
  );

  const loadMemory = async () => {
    if (!uid || !db) {
      setLoading(false);
      return;
    }

    try {
      const memoriesRef = collection(db, 'users', uid, 'memories');
      const q = query(memoriesRef, orderBy('createdAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const memoryData = {
          id: doc.id,
          ...doc.data(),
        };
        setMemory(memoryData);

        // Check if photo file exists
        if (memoryData.photoLocalUri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(memoryData.photoLocalUri);
            setPhotoExists(fileInfo.exists);
          } catch (e) {
            console.log('[MemoryCard] Photo file check error:', e);
            setPhotoExists(false);
          }
        }
      } else {
        setMemory(null);
        setPhotoExists(false);
      }
    } catch (error) {
      console.log('[MemoryCard] Error loading memory:', error);
      setMemory(null);
      setPhotoExists(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = () => {
    Alert.alert(
      t('memory.audioComingSoon'),
      'Audio narration will be available soon!',
      [{ text: 'OK', onPress: () => {} }]
    );
  };

  const handleCardPress = () => {
    if (memory?.id) {
      router.push({
        pathname: '/memory-detail',
        params: { memoryId: memory.id },
      });
    }
  };

  const handleAddMemory = () => {
    router.push('/add-memory');
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!memory) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handleAddMemory}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Add your first memory"
      >
        <View style={styles.emptyContent}>
          <Ionicons name="images-outline" size={36} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>{t('memory.emptyState')}</Text>
          <View style={styles.emptyActionButton}>
            <Ionicons name="add-circle" size={18} color={COLORS.textOnPrimary} />
            <Text style={styles.emptyActionText}>{t('memory.addButton')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleCardPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Memory: ${memory.title}`}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="images-outline" size={24} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('memory.heading')}</Text>
        </View>
        {memory.year && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{memory.year}</Text>
          </View>
        )}
      </View>

      {/* Memory Details with Photo */}
      <View style={styles.contentBox}>
        {photoExists && memory.photoLocalUri ? (
          <Image
            source={{ uri: memory.photoLocalUri }}
            style={styles.thumbnailPhoto}
            resizeMode="cover"
            onError={() => setPhotoExists(false)}
          />
        ) : (
          <View style={[styles.thumbnailPhoto, styles.photoPlaceholder]}>
            <Ionicons name="images" size={32} color={COLORS.textLight} />
          </View>
        )}

        <View style={styles.textContent}>
          <Text style={styles.memoryTitle} numberOfLines={2}>
            {memory.title}
          </Text>
          <Text style={styles.quoteText} numberOfLines={3}>
            "{memory.story}"
          </Text>
        </View>
      </View>

      {/* Audio Playback Controls Bar */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayAudio}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('memory.playButton')}
        >
          <Ionicons name="play" size={22} color={COLORS.textOnPrimary} />
          <Text style={styles.playButtonText}>{t('memory.playButton')}</Text>
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>{t('common.comingSoon')}</Text>
          </View>
        </TouchableOpacity>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SIZES.buttonRadius,
    marginTop: SPACING.md,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    marginLeft: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 8,
  },
  badge: {
    backgroundColor: '#EFE2D3',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  contentBox: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  thumbnailPhoto: {
    width: 90,
    height: 90,
    borderRadius: SIZES.buttonRadius,
    backgroundColor: COLORS.surfaceSecondary,
    marginRight: SPACING.md,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8D8C8',
    paddingTop: 14,
  },
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: SIZES.buttonRadius,
    minHeight: 48,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    marginLeft: 8,
    flex: 1,
  },
  soonBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
});