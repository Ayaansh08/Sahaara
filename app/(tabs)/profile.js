import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../../constants/theme';
import PrimaryButton from '../../components/PrimaryButton';

export default function ProfileTabScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;
  const userName = currentUser?.displayName || 'Ramesh Ji';

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (err) {
      console.log('Sign out error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={48} color={COLORS.primary} />
        </View>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.userEmail}>
          {currentUser?.email || 'ramesh@sahaara.app'}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Elder Companion Status</Text>
          <Text style={styles.cardSubtitle}>Connected & Protected with Sahaara</Text>
        </View>

        <PrimaryButton
          title="Sign Out / बाहर निकलें"
          onPress={handleSignOut}
          variant="secondary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E8D5C4',
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  cardSubtitle: { fontSize: 15, color: COLORS.positive, marginTop: 4 },
});
