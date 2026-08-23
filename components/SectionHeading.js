import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function SectionHeading({ title, iconName, iconColor }) {
  return (
    <View style={styles.container}>
      {iconName && (
        <Ionicons
          name={iconName}
          size={SIZES.iconNormal}
          color={iconColor || COLORS.primary}
          style={styles.icon}
        />
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0,
  },
});
