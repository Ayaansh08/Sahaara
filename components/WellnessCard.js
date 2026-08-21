import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';
import MoodPicker from './MoodPicker';

export default function WellnessCard() {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Ionicons name="heart" size={24} color={COLORS.positive} />
        <Text style={styles.headerTitle}>{t('wellness.heading')}</Text>
      </View>

      {/* Mood Picker Row */}
      <MoodPicker />

      {/* Indicators Divider */}
      <View style={styles.divider} />

      {/* Indicator 1: Hydration */}
      <View style={styles.indicatorRow}>
        <View style={styles.indicatorLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="water" size={22} color="#3182CE" />
          </View>
          <View>
            <Text style={styles.indicatorLabel}>{t('wellness.hydration')}</Text>
            <Text style={styles.indicatorDetail}>{t('wellness.hydrationDetail')}</Text>
          </View>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{t('wellness.statusGood')}</Text>
        </View>
      </View>

      {/* Indicator 2: Activity */}
      <View style={styles.indicatorRow}>
        <View style={styles.indicatorLeft}>
          <View style={styles.iconBadge}>
            <Ionicons name="walk" size={22} color={COLORS.positive} />
          </View>
          <View>
            <Text style={styles.indicatorLabel}>{t('wellness.activity')}</Text>
            <Text style={styles.indicatorDetail}>{t('wellness.activityDetail')}</Text>
          </View>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{t('wellness.statusActive')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.cardRadius,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    shadowColor: COLORS.textPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  indicatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F5F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  indicatorLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  indicatorDetail: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: COLORS.positiveLight,
    borderWidth: 1,
    borderColor: COLORS.positiveBorder,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.positive,
  },
});
