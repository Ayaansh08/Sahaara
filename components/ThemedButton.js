/**
 * components/ThemedButton.js
 * Primary and Secondary button — senior-first, 64px tall, full-width, label + optional icon.
 * Import as: import ThemedButton from '../components/ThemedButton';
 * Usage: <ThemedButton label="बात करें" onPress={fn} />
 *        <ThemedButton label="Cancel" variant="secondary" onPress={fn} />
 */
import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, sizes, border, fonts, motion } from '../constants/theme';

export default function ThemedButton({
  label,
  onPress,
  variant = 'primary',     // 'primary' | 'secondary' | 'danger'
  iconName,                // Ionicons name
  loading = false,
  disabled = false,
  style,
  labelStyle,
}) {
  const animVal = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(animVal, { toValue: 0.97, duration: motion.fast, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.timing(animVal, { toValue: 1, duration: motion.fast, useNativeDriver: true }).start();
  };

  const isPrimary   = variant === 'primary';
  const isDanger    = variant === 'danger';
  const isSecondary = variant === 'secondary';

  const bgColor = isPrimary ? colors.primary
    : isDanger   ? colors.sos
    : 'transparent';

  const pressedBg = isPrimary ? colors.primaryPressed
    : isDanger    ? colors.sosPressed
    : colors.paperDeep;

  const textColor = (isPrimary || isDanger) ? colors.onPrimary : colors.primary;
  const borderStyle = isSecondary ? { borderWidth: border.width, borderColor: colors.primary } : {};

  return (
    <Animated.View style={{ transform: [{ scale: animVal }] }}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: bgColor }, borderStyle, disabled && styles.disabled, style]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            {iconName && (
              <Ionicons name={iconName} size={sizes.icon} color={textColor} style={styles.icon} />
            )}
            <Text style={[styles.label, { color: textColor }, labelStyle]}>{label}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: sizes.button,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    fontFamily: fonts.button,
    fontSize: 22,
    lineHeight: 28,
  },
  icon: {
    marginRight: spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});
