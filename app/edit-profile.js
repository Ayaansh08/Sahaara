/**
 * app/edit-profile.js
 * Edit profile — name, phone, city. Writes to users/{uid} in Firestore.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { useTranslation } from '../context/LanguageContext';
import {
  colors, spacing, radius, sizes, border, fonts, textStyle,
} from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';
import ThemedTextField from '../components/ThemedTextField';

export default function EditProfileScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        const d = snap.data() || {};
        setName(d.name || user.displayName || '');
        setPhone(d.phone || '');
        setCity(d.city || '');
      })
      .catch(() => {
        setName(user.displayName || '');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const trimName = name.trim();
    if (!trimName) {
      setError(isHindi ? 'कृपया अपना नाम लिखें' : 'Please enter your name');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setError('');
    try {
      // Update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        name: trimName,
        phone: phone.trim(),
        city: city.trim(),
      });
      // Update Firebase Auth display name
      if (user.displayName !== trimName) {
        await updateProfile(user, { displayName: trimName });
      }
      setSaved(true);
      setTimeout(() => router.back(), 800);
    } catch (err) {
      console.log('[EditProfile] Save error:', err.message);
      setError(isHindi ? 'सहेजने में समस्या हुई। कृपया फिर कोशिश करें।' : 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isHindi ? 'प्रोफ़ाइल बदलें' : 'Edit Profile'}
        showBack
        onBack={() => router.back()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error ? (
              <View style={styles.errorBox}>
                <Text style={[textStyle('label', lang, colors.dangerText)]}>{error}</Text>
              </View>
            ) : null}

            {saved ? (
              <View style={styles.savedBox}>
                <Text style={[textStyle('label', lang, colors.calm)]}>
                  {isHindi ? '✓ प्रोफ़ाइल सहेज लिया गया' : '✓ Profile saved'}
                </Text>
              </View>
            ) : null}

            <ThemedTextField
              label={isHindi ? 'नाम' : 'Name'}
              lang={lang}
              value={name}
              onChangeText={setName}
              placeholder={isHindi ? 'आपका पूरा नाम' : 'Your full name'}
              iconName="person-outline"
              style={styles.field}
            />

            <ThemedTextField
              label={isHindi ? 'फ़ोन नंबर' : 'Phone number'}
              lang={lang}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              iconName="call-outline"
              style={styles.field}
            />

            <ThemedTextField
              label={isHindi ? 'शहर' : 'City'}
              lang={lang}
              value={city}
              onChangeText={setCity}
              placeholder={isHindi ? 'जैसे: जयपुर' : 'e.g. Jaipur'}
              iconName="location-outline"
              style={styles.field}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'सहेजें' : 'Save'}
            >
              {saving
                ? <ActivityIndicator color={colors.onPrimary} size="small" />
                : <Text style={[textStyle('button', lang, colors.onPrimary)]}>
                    {isHindi ? 'सहेजें' : 'Save'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[textStyle('button', lang, colors.primary)]}>
                {isHindi ? 'रद्द करें' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.dangerText,
    padding: spacing.md,
  },
  savedBox: {
    backgroundColor: colors.calmSoft,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.calm,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: colors.primary,
    minHeight: sizes.button,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtn: {
    minHeight: sizes.buttonSmall,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
