import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  loadingText,
  variant = 'primary',
}) {
  const isSecondary = variant === 'secondary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
        styles.button,
        isSecondary ? styles.buttonSecondary : styles.buttonPrimary,
        (disabled || loading) && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={isSecondary ? COLORS.primary : COLORS.textOnPrimary}
          />
          <Text
            style={[
              styles.buttonText,
              isSecondary ? styles.textSecondary : styles.textPrimary,
              styles.loadingText,
            ]}
          >
            {loadingText || 'Logging in...'}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.buttonText,
            isSecondary ? styles.textSecondary : styles.textPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: SIZES.minTouchHeight,
    borderRadius: SIZES.buttonRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    width: '100%',
    marginVertical: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.textOnPrimary,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowOpacity: 0.05,
  },
  buttonDisabled: {
    backgroundColor: COLORS.primaryDisabled,
    borderColor: '#D8C7B7',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  textPrimary: {
    color: COLORS.textOnPrimary,
  },
  textSecondary: {
    color: COLORS.primary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 18,
  },
});
