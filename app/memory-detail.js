import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import {
  doc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function MemoryDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { memoryId } = useLocalSearchParams();

  const [memory, setMemory] = useState(null);
  const [photoExists, setPhotoExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  useEffect(() => {
    loadMemory();
  }, [memoryId, uid]);

  const loadMemory = async () => {
    if (!uid || !db || !memoryId) {
      setLoading(false);
      return;
    }

    try {
      const memoryRef = doc(db, 'users', uid, 'memories', memoryId);
      const memoryDoc = await getDoc(memoryRef);

      if (memoryDoc.exists()) {
        const data = memoryDoc.data();
        setMemory({
          id: memoryDoc.id,
          ...data,
        });

        // Check if local photo file exists
        if (data.photoLocalUri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(data.photoLocalUri);
            setPhotoExists(fileInfo.exists);
          } catch (e) {
            console.log('[MemoryDetail] Photo file check error:', e);
            setPhotoExists(false);
          }
        }
      }
    } catch (error) {
      console.log('[MemoryDetail] Error loading memory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/edit-memory',
      params: { memoryId },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t('memory.deleteConfirm'),
      undefined,
      [
        {
          text: t('memory.deleteCancel'),
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: t('memory.deleteConfirmBtn'),
          onPress: confirmDelete,
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  const confirmDelete = async () => {
    if (!uid || !db || !memory) return;

    setDeleting(true);

    try {
      // 1. Delete local photo file if it exists
      if (memory.photoLocalUri) {
        try {
          await FileSystem.deleteAsync(memory.photoLocalUri);
        } catch (fsError) {
          console.log('[MemoryDetail] File deletion warning:', fsError);
          // Continue even if file deletion fails
        }
      }

      // 2. Delete Firestore document
      const memoryRef = doc(db, 'users', uid, 'memories', memoryId);
      await deleteDoc(memoryRef);

      // Navigate back to gallery
      router.push('/yaadein');
    } catch (error) {
      console.log('[MemoryDetail] Delete error:', error);
      Alert.alert('Error', 'Failed to delete memory. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePlayAudio = () => {
    Alert.alert(
      t('memory.audioComingSoon'),
      'Audio narration will be available soon!',
      [{ text: 'OK', onPress: () => {} }]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('memory.galleryTitle')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={26} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('memory.galleryTitle')}</Text>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Memory not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {memory.title}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleEdit}
          style={styles.headerIconBtn}
          disabled={deleting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('memory.editButton')}
        >
          <Ionicons name="create-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.headerIconBtn}
          disabled={deleting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('memory.deleteButton')}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Large Photo or Placeholder */}
        {photoExists && memory.photoLocalUri ? (
          <Image
            source={{ uri: memory.photoLocalUri }}
            style={styles.largePhoto}
            resizeMode="cover"
            onError={() => setPhotoExists(false)}
          />
        ) : (
          <View style={[styles.largePhoto, styles.photoPlaceholder]}>
            <Ionicons name="image-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.placeholderText}>{t('memory.photoMissing')}</Text>
          </View>
        )}

        {/* Memory Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View>
              <Text style={styles.detailTitle}>{memory.title}</Text>
              {memory.year && (
                <Text style={styles.detailYear}>{memory.year}</Text>
              )}
            </View>
          </View>

          {/* Play Audio Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayAudio}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('memory.playButton')}
          >
            <Ionicons name="play-circle" size={20} color={COLORS.primary} />
            <Text style={styles.playButtonText}>{t('memory.playButton')}</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          </TouchableOpacity>

          {/* Story Text */}
          <View style={styles.storySection}>
            <Text style={styles.storyText}>{memory.story}</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backBtn: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerIconBtn: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  largePhoto: {
    width: '100%',
    height: 280,
    backgroundColor: COLORS.surfaceSecondary,
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  detailYear: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: SIZES.buttonRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  playButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  storySection: {
    marginTop: SPACING.md,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  storyText: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 26,
  },
});
 
