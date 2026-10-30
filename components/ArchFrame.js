/**
 * components/ArchFrame.js
 * Traditional Indian arch photo frame.
 * 3px gold frame, fully rounded top (half width), 10px bottom corners.
 */
import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, border, radius } from '../constants/theme';

export default function ArchFrame({
  uri,
  source,
  width = 120,
  height = 150,
  borderColor = colors.gold,
  borderWidth = border.archWidth, // 3px
  onPress,
  fallbackIcon = 'images-outline',
  style,
}) {
  const topRadius = Math.round(width / 2);
  const bottomRadius = radius.archBottom; // 10px

  const frameStyle = {
    width,
    height,
    borderWidth,
    borderColor,
    borderTopLeftRadius: topRadius,
    borderTopRightRadius: topRadius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };

  const imageSource = source || (uri ? { uri } : null);

  const content = (
    <View style={[styles.container, frameStyle, style]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[styles.image, { width: width - borderWidth * 2, height: height - borderWidth * 2 }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.fallback, { backgroundColor: colors.paperDeep }]}>
          <Ionicons name={fallbackIcon} size={Math.min(48, Math.round(width * 0.35))} color={colors.gold} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.paperDeep,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    borderRadius: 0,
  },
  fallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
