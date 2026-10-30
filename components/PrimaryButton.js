/**
 * components/PrimaryButton.js  (legacy compat wrapper)
 * Wraps ThemedButton with the old prop interface so login/signup keep working.
 */
import React from 'react';
import ThemedButton from './ThemedButton';

export default function PrimaryButton({ title, onPress, loading, loadingText, variant, disabled, style }) {
  return (
    <ThemedButton
      label={title}
      onPress={onPress}
      loading={loading}
      variant={variant === 'secondary' ? 'secondary' : 'primary'}
      disabled={disabled}
      style={style}
    />
  );
}
