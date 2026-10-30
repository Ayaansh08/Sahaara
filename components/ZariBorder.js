/**
 * components/ZariBorder.js
 * Kanjeevaram silk zari motif — 14px tall gold repeating pattern.
 * Placed at the bottom edge of maroon blocks.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Polygon, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';

export default function ZariBorder({ color = colors.gold, height = 14, style }) {
  // Pattern unit dimensions: 16px wide, 14px high
  return (
    <View style={[styles.container, { height }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="zariPattern" width="16" height={height} patternUnits="userSpaceOnUse">
            {/* Center diamond */}
            <Polygon points="8,1 15,7 8,13 1,7" fill={color} />
            {/* Corner diamond halves to connect seamlessly */}
            <Polygon points="0,1 1,1 0,3" fill={color} />
            <Polygon points="16,1 15,1 16,3" fill={color} />
            <Polygon points="0,13 1,13 0,11" fill={color} />
            <Polygon points="16,13 15,13 16,11" fill={color} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill="url(#zariPattern)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
});
