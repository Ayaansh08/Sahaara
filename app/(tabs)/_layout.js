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
      icon: 'home',
      activeIcon: 'home',
    },
    saathi: {
      title: 'SAATHI',
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
    more: {
      title: isHindi ? 'और' : 'More',
      icon: 'grid-outline',
      activeIcon: 'grid',
    },
  };

  return (
    <View style={[styles.tabBarContainer, { height: barHeight, paddingBottom: bottomPadding }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        // Skip hidden tabs (like profile)
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

            {/* Label (15-16px) */}
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
          title: 'SAATHI',
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
        name="more"
        options={{
          title: isHindi ? 'और' : 'More',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hidden from tab bar; opens from More or direct route
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
    fontSize: sizes.tabLabel, // 16px
    lineHeight: 20,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontFamily: fonts.button,
  },
});
