/**
 * components/ThemedTextField.js
 * 60px-tall input with always-visible label above it. Senior-friendly.
 * Usage: <ThemedTextField label="ईमेल" value={v} onChangeText={fn} error={err} />
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, border, sizes, fonts, textStyle } from '../constants/theme';

export default function ThemedTextField({
  label,
  lang = 'en',
  value,
  onChangeText,
  placeholder,
  error,
  iconName,
  isPassword = false,
  multiline = false,
  style,
  inputStyle,
  ...rest
}) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <Text style={[textStyle('label', lang, colors.inkSoft), styles.label]}>{label}</Text>
      <View style={[
        styles.inputRow,
        focused && styles.focused,
        error   && styles.errored,
      ]}>
        {iconName && (
          <Ionicons name={iconName} size={22} color={focused ? colors.primary : colors.inkSoft} style={styles.icon} />
        )}
        <TextInput
          style={[styles.input, multiline && styles.multiline, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || ''}
          placeholderTextColor={colors.inkSoft}
          secureTextEntry={isPassword && !showPass}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn} activeOpacity={0.7}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.inkSoft} />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.dangerText} />
          <Text style={[textStyle('label', lang, colors.dangerText), styles.errorText]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperDeep,
    borderColor: colors.line,
    borderWidth: border.width,
    borderRadius: radius.input,
    minHeight: sizes.input,
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.paper,
  },
  errored: {
    borderColor: colors.dangerText,
    backgroundColor: colors.dangerSoft,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 28,
    paddingVertical: spacing.sm,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  eyeBtn: {
    padding: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.input,
    padding: spacing.sm,
    borderWidth: border.width,
    borderColor: colors.dangerText,
  },
  errorText: {
    flex: 1,
    lineHeight: 22,
  },
});
