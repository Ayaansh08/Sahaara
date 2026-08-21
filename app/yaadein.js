import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function MemoriesGalleryScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoExistenceMap, setPhotoExistenceMap] = useState({});

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  // Load memories whenever screen focuses
  useFocusEffect(
    React.useCallback(() => {
      loadMemories();
    }, [uid])
  );

  const checkPhotoExists = async (photoLocalUri, memoryId) => {
    if (!photoLocalUri) return false;
    try {
      const fileInfo = await FileSystem.getInfoAsync(photoLocalUri);
      return fileInfo.exists;
    } catch (e) {
      console.log(`[Gallery] Photo check error for ${memoryId}:`, e);
      return false;
    }
  };

  const loadMemories = async () => {
    if (!uid || !db) {
      setLoading(false);
      return;
    }

    try {
      const memoriesRef = collection(db, 'users', uid, 'memories');
      const q = query(memoriesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      const loadedMemories = [];
      const existenceMap = {};

      // Load all memories
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        loadedMemories.push({
          id: doc.id,
          ...data,
        });
      });

      // Check all photos in parallel
      const existencePromises = loadedMemories.map(async (memory) => {
        const exists = await checkPhotoExists(memory.photoLocalUri, memory.id);
        existenceMap[memory.id] = exists;
      });

      await Promise.all(existencePromises);

      setMemories(loadedMemories);
      setPhotoExistenceMap(existenceMap);
    } catch (error) {
      console.log('[MemoriesGallery] Error loading memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMemoryCard = ({ item }) => {
    const photoExists = photoExistenceMap[item.id];

    return (
      <TouchableOpacity
        style={styles.memoryCardContainer}
        onPress={() => router.push({ pathname: '/memory-detail', params: { memoryId: item.id } })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Memory: ${item.title}`}
      >
        {/* Photo Thumbnail */}
        {photoExists && item.photoLocalUri ? (
          <Image
            source={{ uri: item.photoLocalUri }}
            style={styles.photoThumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.photoThumbnail, styles.photoPlaceholder]}>
            <Ionicons name="images" size={32} color={COLORS.textLight} />
          </View>
        )}

        {/* Card Content */}
        <View style={styles.cardContent}>
          <Text style={styles.memoryTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.year && (
            <Text style={styles.memoryYear}>{item.year}</Text>
          )}
          <Text style={styles.memoryPreview} numberOfLines={2}>
            {item.story}
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color={COLORS.textLight}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('memory.galleryTitle')}</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('saathi.loading')}</Text>
        </View>
      ) : memories.length === 0 ? (
        // Empty State
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyIconCircle}>
            <Ionicons name="images" size={52} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyStateTitle}>{t('memory.emptyState')}</Text>
          <TouchableOpacity
            style={styles.addButtonLarge}
            onPress={() => router.push('/add-memory')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('memory.addButton')}
          >
            <Ionicons name="add-circle" size={26} color={COLORS.textOnPrimary} />
            <Text style={styles.addButtonTextLarge}>{t('memory.addButton')}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={styles.listContainer}>
          {/* "Add a Memory" Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-memory')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('memory.addButton')}
          >
            <Ionicons name="add-circle" size={22} color={COLORS.textOnPrimary} />
            <Text style={styles.addButtonText}>{t('memory.addButton')}</Text>
          </TouchableOpacity>

          {/* FlatList of Memories */}
          <FlatList
            data={memories}
            keyExtractor={(item) => item.id}
            renderItem={renderMemoryCard}
            scrollEnabled={false}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    padding: 6,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  addButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: SIZES.buttonRadius,
    minHeight: 60,
    marginTop: SPACING.md,
  },
  addButtonTextLarge: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 10,
  },
  listContainer: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: SIZES.buttonRadius,
    minHeight: 54,
  },
  addButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 8,
  },
  flatListContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  memoryCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    marginVertical: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    backgroundColor: COLORS.surfaceSecondary,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  memoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  memoryYear: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
  },
  memoryPreview: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  chevron: {
    marginRight: SPACING.md,
  },
});
