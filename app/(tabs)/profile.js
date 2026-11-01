/**
 * app/(tabs)/profile.js
 * Profile tab — replaces "More".
 * Hero band (maroon + sawtooth) with arch avatar, then plain rows + colored action rows.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { useTranslation } from '../../context/LanguageContext';
import {
  colors, spacing, radius, sizes, border, fonts, textStyle,
} from '../../constants/theme';
import SawtoothEdge from '../../components/SawtoothEdge';
import ArchFrame from '../../components/ArchFrame';
import LanguageToggle from '../../components/LanguageToggle';

// Derive 1–2 capital initials from a name
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isHindi = language === 'hi';
  const lang = language;

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Confirm sign-out dialog
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        setUserData({ uid: user.uid, ...snap.data() });
      } else {
        setUserData({
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Member',
          email: user.email || '',
        });
      }
    } catch (_) {
      setUserData({
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Member',
        email: user.email || '',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProfile();
    }, [loadProfile])
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      setSignOutConfirm(false);
      router.replace('/login');
    } catch (_) {
      setSigningOut(false);
      setSignOutConfirm(false);
    }
  };

  const displayName = userData?.name || auth.currentUser?.displayName || 'Member';
  const displayEmail = userData?.email || auth.currentUser?.email || '';
  const displayCity = userData?.city || '';
  const displayPhone = userData?.phone || '';
  const initials = getInitials(displayName);

  // Profile info rows (label / value pairs)
  const infoRows = [
    { label: isHindi ? 'नाम' : 'Name', value: displayName },
    { label: isHindi ? 'ईमेल' : 'Email', value: displayEmail },
    displayPhone ? { label: isHindi ? 'फ़ोन' : 'Phone', value: displayPhone } : null,
    displayCity ? { label: isHindi ? 'शहर' : 'City', value: displayCity } : null,
  ].filter(Boolean);

  return (
    <View style={styles.screen}>
      {/* ── MAROON HERO ── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.heroInner}>
          {/* Avatar arch frame — initials on paper-deep when no photo */}
          <View style={styles.avatarWrap}>
            <ArchFrame
              width={96}
              height={116}
              borderColor={colors.gold}
              fallbackIcon={null}
              fallbackInitials={initials}
            />
          </View>

          {/* Name + sub-label */}
          <Text style={[styles.heroName]} numberOfLines={1} adjustsFontSizeToFit>
            {displayName}
          </Text>
          {displayEmail ? (
            <Text style={styles.heroEmail} numberOfLines={1}>
              {displayEmail}
            </Text>
          ) : null}
        </View>

        {/* 18px padding below content, then sawtooth is placed immediately */}
        <View style={{ height: spacing.md }} />
      </View>

      {/* Sawtooth — reads as part of hero */}
      <SawtoothEdge color={colors.primary} />

      {/* ── BODY ── */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── INFO ROWS (name, email, phone, city) ── */}
          <View style={styles.infoSection}>
            {infoRows.map((row, idx) => (
              <View
                key={row.label}
                style={[
                  styles.infoRow,
                  idx < infoRows.length - 1 && styles.infoRowDivider,
                ]}
              >
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* ── EDIT PROFILE BUTTON ── */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'प्रोफ़ाइल बदलें' : 'Edit Profile'}
          >
            <Ionicons name="pencil" size={24} color={colors.onPrimary} style={{ marginRight: spacing.sm }} />
            <Text style={[textStyle('button', lang, colors.onPrimary)]}>
              {isHindi ? 'प्रोफ़ाइल बदलें' : 'Edit Profile'}
            </Text>
          </TouchableOpacity>

          {/* ── COLORED ACTION ROWS ── */}
          <View style={styles.actionRows}>

            {/* Wellness row — bottle green */}
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.calm }]}
              onPress={() => router.push('/wellness')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'आज की सेहत' : 'Today\'s Wellness'}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="heart" size={28} color={colors.onPrimary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[textStyle('bodyStrong', lang, colors.onPrimary), styles.actionTitle]}>
                  {isHindi ? 'आज की सेहत' : "Today's Wellness"}
                </Text>
                <Text style={[textStyle('label', lang, colors.calmSoft), styles.actionDesc]}>
                  {isHindi ? 'पानी, दवाई, सांस, नींद' : 'Water, medicine, breathing, sleep'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.onPrimary} />
            </TouchableOpacity>

            {/* Emergency Contacts row — gold */}
            <TouchableOpacity
              style={[styles.actionRow, { backgroundColor: colors.gold }]}
              onPress={() => router.push('/emergency-contacts')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={isHindi ? 'आपातकालीन संपर्क' : 'Emergency Contacts'}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(42,20,23,0.18)' }]}>
                <Ionicons name="shield-checkmark" size={28} color={colors.ink} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[textStyle('bodyStrong', lang, colors.ink), styles.actionTitle]}>
                  {isHindi ? 'आपातकालीन संपर्क' : 'Emergency Contacts'}
                </Text>
                <Text style={[textStyle('label', lang, colors.inkSoft), styles.actionDesc]}>
                  {isHindi ? 'मुसीबत में व्हाट्सएप अलर्ट' : 'WhatsApp alert in emergency'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.ink} />
            </TouchableOpacity>

            {/* Language row — paper-deep with border */}
            <View style={[styles.actionRow, styles.langRow]}>
              <View style={[styles.actionIconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="language" size={28} color={colors.primary} />
              </View>
              <View style={styles.actionTextCol}>
                <Text style={[textStyle('bodyStrong', lang, colors.ink), styles.actionTitle]}>
                  {isHindi ? 'भाषा / Language' : 'Language / भाषा'}
                </Text>
              </View>
              {/* Inline two-option toggle */}
              <LanguageToggle />
            </View>

          </View>

          {/* ── SIGN OUT ── */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => setSignOutConfirm(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isHindi ? 'बाहर निकलें' : 'Sign Out'}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.dangerText} style={{ marginRight: spacing.sm }} />
            <Text style={[textStyle('button', lang, colors.dangerText)]}>
              {isHindi ? 'बाहर निकलें (Sign Out)' : 'Sign Out'}
            </Text>
          </TouchableOpacity>

          {/* App version — long press reveals demo tools hint */}
          <TouchableOpacity
            activeOpacity={0.6}
            onLongPress={() => router.push('/emergency-contacts')}
            accessibilityLabel="App version"
          >
            <Text style={styles.versionText}>Sahaara v1.0 · Hackathon Demo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── SIGN OUT CONFIRM DIALOG ── */}
      <Modal
        visible={signOutConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => !signingOut && setSignOutConfirm(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconCircle}>
              <Ionicons name="log-out" size={36} color={colors.dangerText} />
            </View>

            <Text style={[textStyle('heading', lang, colors.ink), styles.dialogTitle]}>
              {isHindi ? 'बाहर निकलें?' : 'Sign Out?'}
            </Text>
            <Text style={[textStyle('body', lang, colors.inkSoft), styles.dialogSub]}>
              {isHindi
                ? 'क्या आप सच में बाहर निकलना चाहते हैं?'
                : 'Are you sure you want to sign out?'}
            </Text>

            <TouchableOpacity
              style={styles.dialogYesBtn}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {signingOut
                ? <ActivityIndicator color={colors.onSos} size="small" />
                : <Text style={[textStyle('button', lang, colors.onSos)]}>
                    {isHindi ? 'हाँ, बाहर निकलें' : 'Yes, sign out'}
                  </Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dialogNoBtn}
              onPress={() => setSignOutConfirm(false)}
              disabled={signingOut}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[textStyle('button', lang, colors.primary)]}>
                {isHindi ? 'नहीं, रहने दें' : 'No, cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  /* Hero */
  hero: {
    backgroundColor: colors.heroBg,
    paddingHorizontal: spacing.screenX,
  },
  heroInner: {
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  avatarWrap: {
    marginBottom: spacing.md,
  },
  heroName: {
    fontFamily: fonts.en.heading,
    fontSize: 32,
    lineHeight: 40,
    color: colors.onPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  heroEmail: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 24,
    color: colors.goldLight,
    textAlign: 'center',
    marginTop: 4,
  },

  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Body */
  body: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },

  /* Info rows */
  infoSection: {
    borderTopWidth: border.width,
    borderColor: colors.line,
  },
  infoRow: {
    minHeight: 72,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  infoRowDivider: {
    borderBottomWidth: border.width,
    borderBottomColor: colors.line,
  },
  infoLabel: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 24,
    color: colors.inkSoft,
  },
  infoValue: {
    fontFamily: fonts.bodyStrong,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
    marginTop: 2,
  },

  /* Edit button */
  editBtn: {
    backgroundColor: colors.primary,
    minHeight: sizes.button,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },

  /* Action rows */
  actionRows: {
    gap: spacing.md,
  },
  actionRow: {
    minHeight: 72,
    borderRadius: radius.row,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  langRow: {
    backgroundColor: colors.paperDeep,
    borderWidth: border.width,
    borderColor: colors.line,
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  actionDesc: {
    fontSize: 18,
    lineHeight: 24,
    marginTop: 2,
  },

  /* Sign Out */
  signOutBtn: {
    minHeight: sizes.buttonSmall,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.dangerText,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  versionText: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.inkSoft,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  /* Sign-out dialog */
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42,20,23,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  dialogCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: border.width,
    borderColor: colors.line,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  dialogIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dialogTitle: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  dialogSub: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  dialogYesBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    backgroundColor: colors.dangerText,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dialogNoBtn: {
    width: '100%',
    minHeight: sizes.button,
    borderRadius: radius.button,
    borderWidth: border.width,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
