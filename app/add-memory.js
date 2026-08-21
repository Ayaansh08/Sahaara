import React, { useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function AddMemoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [year, setYear] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('common.comingSoon'), 'We need permission to access your photos.');
        return;
      }

     const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
});

      if (!result.canceled) {
        setPhotoUri(result.assets[0].uri);
        setValidationError('');
      }
    } catch (error) {
      console.log('[AddMemory] Image picker error:', error);
      Alert.alert('Error', 'Failed to open photo picker');
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      setValidationError(t('memory.validationTitle'));
      return false;
    }
    if (!photoUri) {
      setValidationError(t('memory.validationPhoto'));
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!uid || !db) return;

    setLoading(true);

    try {
      // 1. Copy photo to persistent local storage
      // Note: photoLocalUri is a stopgap using local device storage.
      // When migrating to Firebase Storage or another cloud provider,
      // only the save/load logic here needs to change, not the rest of the app.
      const memoryId = Date.now().toString();
      const memoriesDir = `${FileSystem.documentDirectory}memories/`;
      
      // Ensure memories directory exists
      const dirInfo = await FileSystem.getInfoAsync(memoriesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(memoriesDir, { intermediates: true });
      }

      const localPhotoUri = `${memoriesDir}${memoryId}.jpg`;
      await FileSystem.copyAsync({
        from: photoUri,
        to: localPhotoUri,
      });

      // 2. Save memory metadata to Firestore
      const memoriesRef = collection(db, 'users', uid, 'memories');
      await addDoc(memoriesRef, {
        title: title.trim(),
        story: story.trim(),
        year: year.trim() || null,
        photoLocalUri: localPhotoUri, // Store the local file path
        createdAt: serverTimestamp(),
      });

      // Navigate back to gallery
      router.push('/yaadein');
    } catch (error) {
      console.log('[AddMemory] Save error:', error);
      Alert.alert('Error', 'Failed to save memory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={60}
      >
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
          <Text style={styles.headerTitle}>{t('memory.addButton')}</Text>
        </View>

        {/* Form Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('memory.choosePhoto')}</Text>
            <TouchableOpacity
              style={styles.photoPickerArea}
              onPress={pickImage}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('memory.choosePhoto')}
            >
              {photoUri ? (
                <>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    resizeMode="cover"
                  />
                  <View style={styles.changePhotoOverlay}>
                    <Ionicons name="create" size={24} color={COLORS.textOnPrimary} />
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPickerPlaceholder}>
                  <Ionicons name="image-outline" size={40} color={COLORS.primary} />
                  <Text style={styles.photoPickerText}>{t('memory.choosePhoto')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>{t('memory.titleLabel')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('memory.titlePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={title}
              onChangeText={setTitle}
              editable={!loading}
              maxLength={100}
            />
          </View>

          {/* Story Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>{t('memory.storyLabel')}</Text>
            <TextInput
              style={[styles.textInput, styles.storyInput]}
              placeholder={t('memory.storyPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={story}
              onChangeText={setStory}
              multiline
              editable={!loading}
              maxLength={1000}
            />
          </View>

          {/* Year Input */}
          <View style={styles.section}>
            <Text style={styles.inputLabel}>{t('memory.yearLabel')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('memory.yearPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
              editable={!loading}
              maxLength={4}
            />
          </View>

          {/* Validation Error */}
          {validationError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              (loading || !title.trim() || !photoUri) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading || !title.trim() || !photoUri}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('memory.saveButton')}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.textOnPrimary} />
                <Text style={styles.saveButtonText}>{t('memory.saveButton')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  photoPickerArea: {
    width: '100%',
    minHeight: 200,
    borderRadius: SIZES.cardRadius,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 2,
    borderColor: COLORS.borderInput,
    overflow: 'hidden',
  },
  photoPickerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  photoPickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  photoPreview: {
    width: '100%',
    height: 200,
  },
  changePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(200, 90, 50, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.borderInput,
    borderRadius: SIZES.inputRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.textDark,
    minHeight: 52,
  },
  storyInput: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    borderWidth: 1.5,
    borderColor: COLORS.errorBorder,
    borderRadius: SIZES.buttonRadius,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.error,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: SIZES.buttonRadius,
    minHeight: 60,
    marginTop: SPACING.lg,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.surfaceMuted,
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    marginLeft: 10,
  },
});
