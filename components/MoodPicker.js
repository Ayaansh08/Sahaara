import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';

export default function MoodPicker({ onSelectMood }) {
  const { t } = useTranslation();
  const [selectedMood, setSelectedMood] = useState('happy');

  const MOODS = [
    { id: 'happy', labelKey: 'wellness.mood.happy', icon: 'happy-outline', activeIcon: 'happy' },
    { id: 'content', labelKey: 'wellness.mood.content', icon: 'heart-outline', activeIcon: 'heart' },
    { id: 'neutral', labelKey: 'wellness.mood.neutral', icon: 'ellipse-outline', activeIcon: 'ellipse' },
    { id: 'sad', labelKey: 'wellness.mood.sad', icon: 'sad-outline', activeIcon: 'sad' },
  ];

  const handleSelect = (id) => {
    setSelectedMood(id);
    if (onSelectMood) onSelectMood(id);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.promptText}>
        {t('wellness.moodQuestion')}
      </Text>
      <View style={styles.moodRow}>
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          const label = t(mood.labelKey);
          return (
            <TouchableOpacity
              key={mood.id}
              style={[styles.moodItem, isSelected && styles.moodItemSelected]}
              onPress={() => handleSelect(mood.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
            >
              <View
                style={[
                  styles.iconCircle,
                  isSelected && styles.iconCircleSelected,
                ]}
              >
                <Ionicons
                  name={isSelected ? mood.activeIcon : mood.icon}
                  size={32}
                  color={isSelected ? COLORS.textOnPrimary : COLORS.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.moodLabel,
                  isSelected && styles.moodLabelSelected,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  promptText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  moodItemSelected: {
    backgroundColor: '#F0F5F1',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F3EDE4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconCircleSelected: {
    backgroundColor: COLORS.positive,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  moodLabelSelected: {
    fontWeight: '800',
    color: COLORS.positive,
  },
});
