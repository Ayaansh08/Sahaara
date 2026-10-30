/**
 * components/ListRow.js
 * A big tappable row with icon, label, optional subtitle, and a chevron.
 * At least 56px tall. Used for navigation shortcuts, family members, etc.
 * Usage: <ListRow icon="images" label="यादें" subtitle="पुराने पलों को जिएं" onPress={fn} />
 */
import React, { useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, border, sizes, fonts, motion, textStyle } from '../constants/theme';

export default function ListRow({
  icon,
  label,
  lang = 'en',
  subtitle,
  onPress,
  accent = colors.primary,
  showChevron = true,
  leftElement,   // custom left element instead of icon
  rightElement,  // custom right element instead of chevron
  style,
}) {
  const animVal = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.timing(animVal, { toValue: 0.98, duration: motion.fast, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(animVal, { toValue: 1,    duration: motion.fast, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: animVal }] }}>
      <TouchableOpacity
        style={[styles.row, style]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {/* Left: icon or custom element */}
        {leftElement ? leftElement : icon ? (
          <View style={[styles.iconBox, { backgroundColor: accent + '18' }]}>
            <Ionicons name={icon} size={sizes.icon} color={accent} />
          </View>
        ) : null}

        {/* Text */}
        <View style={styles.textBox}>
          <Text style={[textStyle('bodyStrong', lang, colors.ink)]}>{label}</Text>
          {subtitle ? (
            <Text style={[textStyle('label', lang, colors.inkSoft), { marginTop: 2 }]}>{subtitle}</Text>
          ) : null}
        </View>

        {/* Right: custom or chevron */}
        {rightElement ? rightElement : showChevron ? (
          <Ionicons name="chevron-forward" size={22} color={colors.inkSoft} />
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchMin,
    backgroundColor: colors.paperDeep,
    borderColor: colors.line,
    borderWidth: border.width,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textBox: {
    flex: 1,
  },
});
