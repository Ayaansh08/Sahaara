import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import SahaaraLogo from '../components/SahaaraLogo';
import { COLORS } from '../constants/theme';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(false);
      if (user) {
        // Authenticated -> Home Tab
        router.replace('/(tabs)/home');
      } else {
        // Unauthenticated -> Login
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <View style={styles.container}>
      <SahaaraLogo showTagline={true} />
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>नमस्ते... (Namaste)</Text>
        <Text style={styles.subText}>सहारा आरंभ हो रहा है...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingBox: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  subText: {
    fontSize: 17,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 6,
  },
});
