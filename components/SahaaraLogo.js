import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const logoSource = require('../assets/images/sahaara-logo.png');

export default function SahaaraLogo({ showTagline = true, size = 96, compact = false }) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Image
        source={logoSource}
        style={[
          styles.logoImage,
          { width: size, height: size },
          compact && styles.logoImageCompact,
        ]}
        resizeMode="contain"
        accessibilityLabel="Sahaara logo"
      />

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
    marginVertical: SPACING.xs,
  },
  containerCompact: {
    marginVertical: 0,
  },
  logoImage: {
    marginBottom: SPACING.xs,
  },
  logoImageCompact: {
    marginBottom: 0,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.xs,
    letterSpacing: 0,
  },
});
