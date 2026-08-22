import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../context/LanguageContext';
import { COLORS } from '../../constants/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const tabPaddingBottom = Math.max(insets.bottom, 10);
  const tabBarHeight = 58 + tabPaddingBottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1.5,
          height: tabBarHeight,
          paddingBottom: tabPaddingBottom,
          paddingTop: 8,
          elevation: 4,
          shadowColor: COLORS.textPrimary,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saathi"
        options={{
          title: t('tabs.saathi'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart-circle" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="yaadein"
        options={{
          title: t('tabs.memories'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="images" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
