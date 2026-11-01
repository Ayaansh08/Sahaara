/**
 * app/(tabs)/_layout.js
 * Tab bar — Home, Saathi, Memories, Family, Profile.
 * "More" tab is hidden (redirects to Profile for deep-link safety).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../context/LanguageContext';
import { colors, fonts, border, sizes } from '../../constants/theme';

function CustomTabBar({ state, descriptors, navigation, isHindi }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const barHeight = sizes.tabBarHeight + bottomPadding;

  const tabConfig = {
    home: {
      title: isHindi ? 'होम' : 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    saathi: {
      title: 'Saathi',
      icon: 'heart-circle-outline',
      activeIcon: 'heart-circle',
    },
    yaadein: {
      title: isHindi ? 'यादें' : 'Memories',
      icon: 'images-outline',
      activeIcon: 'images',
    },
    family: {
      title: isHindi ? 'परिवार' : 'Family',
      icon: 'people-outline',
      activeIcon: 'people',
    },
    profile: {
      title: isHindi ? 'प्रोफ़ाइल' : 'Profile',
      icon: 'person-circle-outline',
      activeIcon: 'person-circle',
    },
  };

  return (
    <View style={[styles.tabBarContainer, { height: barHeight, paddingBottom: bottomPadding }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        // Skip hidden tabs (more redirect, legacy)
        if (options.href === null || !tabConfig[route.name]) {
          return null;
        }

        const isFocused = state.index === index;
        const cfg = tabConfig[route.name];
        const label = options.title || cfg.title;
        const iconName = isFocused ? cfg.activeIcon : cfg.icon;
        const tintColor = isFocused ? colors.tabActive : colors.tabInactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={label}
          >
            {/* 3px Gold Bar above the active tab */}
            <View
              style={[
                styles.topGoldBar,
                { backgroundColor: isFocused ? colors.gold : 'transparent' },
              ]}
            />

            {/* Icon (28px) */}
            <View style={styles.iconBox}>
              <Ionicons name={iconName} size={sizes.tabIcon} color={tintColor} />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.tabLabel,
                { color: tintColor },
                isFocused && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { language } = useTranslation();
  const isHindi = language === 'hi';

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} isHindi={isHindi} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isHindi ? 'होम' : 'Home',
        }}
      />
      <Tabs.Screen
        name="saathi"
        options={{
          title: 'Saathi',
        }}
      />
      <Tabs.Screen
        name="yaadein"
        options={{
          title: isHindi ? 'यादें' : 'Memories',
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: isHindi ? 'परिवार' : 'Family',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isHindi ? 'प्रोफ़ाइल' : 'Profile',
        }}
      />
      {/* Legacy "more" tab — hidden, redirects to profile */}
      <Tabs.Screen
        name="more"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: colors.tabBarBg,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    alignItems: 'stretch',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touchMin,
    paddingTop: 0,
    paddingBottom: 4,
  },
  topGoldBar: {
    height: 3,
    width: '60%',
    borderRadius: 2,
    marginBottom: 4,
  },
  iconBox: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontFamily: fonts.bodyStrong,
    fontSize: sizes.tabLabel,
    lineHeight: 20,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: fonts.button,
  },
});
