/**
 * components/SawtoothEdge.js
 * Sawtooth (ticket / torn receipt) bottom edge.
 * Downward-pointing triangles filled with color, perfectly fitting screen width.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../constants/theme';

export default function SawtoothEdge({ color = colors.primary, height = 14, style }) {
  const { width } = useWindowDimensions();

  // Target tooth width ~17px, perfectly divided so no half-teeth at either edge
  const count = Math.max(1, Math.round(width / 17));
  const toothWidth = width / count;

  // Path: Start at top-left (0,0), draw top line to (width, 0),
  // then zigzag leftwards back to (0,0) with downward points to height (14)
  let d = `M 0 0 L ${width} 0`;
  for (let i = count - 1; i >= 0; i--) {
    const peakX = (i + 0.5) * toothWidth;
    const endX = i * toothWidth;
    d += ` L ${peakX.toFixed(2)} ${height} L ${endX.toFixed(2)} 0`;
  }
  d += ' Z';

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={d} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    marginTop: -0.5, // Prevents any sub-pixel gap/seam on high-DPI screens
  },
});
