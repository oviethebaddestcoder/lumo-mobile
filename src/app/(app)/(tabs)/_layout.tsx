import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/ui';
import { fonts, makeStyles, ThemeScope, useTheme } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  live: { label: 'Live', icon: 'live' },
  create: { label: '', icon: 'plus' },
  watch: { label: 'Watch', icon: 'play' },
  me: { label: 'Me', icon: 'user' },
};

// Home (full-bleed video) and Create (camera) keep a black bar in either theme.
function TabBar(props: BottomTabBarProps) {
  const { scheme } = useTheme();
  const route = props.state.routes[props.state.index]?.name;
  const onVideo = route === 'index' || route === 'create';
  return (
    <ThemeScope scheme={onVideo ? 'dark' : scheme}>
      <TabBarInner {...props} onVideo={onVideo} />
    </ThemeScope>
  );
}

function TabBarInner({ state, navigateToTab, onVideo }: BottomTabBarProps & { onVideo: boolean }) {
  const { colors } = useTheme();
  const st = useSt();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.bar, { paddingBottom: insets.bottom || 8, backgroundColor: onVideo ? '#000' : colors.bg }]}>
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const onPress = () => {
          if (!focused) navigateToTab(route.key);
        };
        if (route.name === 'create') {
          return (
            <Pressable key={route.key} onPress={onPress} style={st.item} accessibilityRole="button" accessibilityLabel="Create">
              <View style={st.create}>
                <Icon name="plus" size={22} strokeWidth={3} color={colors.onLive} />
              </View>
            </Pressable>
          );
        }
        const color = focused ? colors.text : colors.inactive;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={st.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
          >
            <Icon name={tab.icon} size={24} color={color} />
            <Text style={[st.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="live" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="watch" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}

const useSt = makeStyles((colors) => ({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 44 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10 },
  create: {
    width: 46,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
