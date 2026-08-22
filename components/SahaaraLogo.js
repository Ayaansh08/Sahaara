import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function SahaaraLogo({ showTagline = true }) {
  return (
    <View style={styles.container}>
      {/* Compact Elegant Logo Badge */}
      <View style={styles.iconCircle}>
        <Ionicons name="heart" size={26} color={COLORS.primary} />
        <View style={styles.overlayBadge}>
          <Ionicons name="people" size={13} color={COLORS.textOnPrimary} />
        </View>
      </View>

      {/* Brand Name */}
      <Text style={styles.brandName}>SAHAARA</Text>

      {/* Hindi Tagline in Terracotta Accent */}
      {showTagline && (
        <Text style={styles.tagline}>साथ हैं, हर कदम पर</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: '#E8D9C9',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  overlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 2.5,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
    letterSpacing: 0.4,
  },
});
