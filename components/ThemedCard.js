/**
 * components/ThemedCard.js
 * A paper-deep card with 2px border and optional gold bar under the title.
 * Usage: <ThemedCard title="शीर्षक" lang="hi">...</ThemedCard>
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, border, fonts, textStyle } from '../constants/theme';

export default function ThemedCard({
  title,
  lang = 'en',
  showGoldBar = true,
  style,
  titleStyle,
  children,
  accent,           // optional override accent color (e.g. colors.calm)
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <>
          <Text style={[textStyle('heading', lang, colors.ink), titleStyle]}>{title}</Text>
          {showGoldBar && <View style={[styles.goldBar, accent ? { backgroundColor: accent } : null]} />}
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperDeep,
    borderColor: colors.line,
    borderWidth: border.width,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  goldBar: {
    height: 4,
    width: 36,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
});
