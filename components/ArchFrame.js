/**
 * components/ArchFrame.js
 * Traditional Indian arch photo frame.
 * 3px gold frame, fully rounded top (half width), 10px bottom corners.
 * Supports: image uri, initials text, or icon fallback.
 */
import React from 'react';
import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, border, radius, fonts } from '../constants/theme';

export default function ArchFrame({
  uri,
  source,
  width = 120,
  height = 150,
  borderColor = colors.gold,
  borderWidth = border.archWidth, // 3px
  onPress,
  fallbackIcon = 'images-outline',
  fallbackInitials = null,   // e.g. "RG" — shows initials when no image & no icon wanted
  fallbackLabel = null,      // plain text line under icon (e.g. "Photo nahin hai")
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

  // Initials font size — scales with frame width
  const initialsFontSize = Math.round(width * 0.28);

  const content = (
    <View style={[styles.container, frameStyle, style]}>
      {imageSource ? (
        <Image
          source={imageSource}
          style={[styles.image, { width: width - borderWidth * 2, height: height - borderWidth * 2 }]}
          resizeMode="cover"
        />
      ) : fallbackInitials ? (
        /* Initials avatar — used on Profile tab */
        <View style={[styles.fallback, { backgroundColor: colors.paperDeep }]}>
          <Text style={[styles.initials, { fontSize: initialsFontSize }]}>
            {fallbackInitials}
          </Text>
        </View>
      ) : (
        /* Icon fallback — used on memory card / add-memory */
        <View style={[styles.fallback, { backgroundColor: colors.paperDeep }]}>
          {fallbackIcon ? (
            <Ionicons
              name={fallbackIcon}
              size={Math.min(48, Math.round(width * 0.35))}
              color={colors.gold}
            />
          ) : null}
          {fallbackLabel ? (
            <Text style={styles.fallbackLabel} numberOfLines={2}>{fallbackLabel}</Text>
          ) : null}
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
    gap: 8,
    paddingHorizontal: 8,
  },
  initials: {
    fontFamily: fonts.en.heading,
    color: colors.primary,
    lineHeight: undefined, // let native compute
    textAlign: 'center',
  },
  fallbackLabel: {
    fontFamily: fonts.bodyStrong,
    fontSize: 14,
    lineHeight: 18,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
  },
});
