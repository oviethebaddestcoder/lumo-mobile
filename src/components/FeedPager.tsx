import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, RefreshControl, View, type ListViewToken } from 'react-native';
import type { FeedItem } from '@/lib/api/types';
import { useImpressions, useVideoCounts } from '@/lib/hooks';
import { colors } from '@/theme/tokens';
import { FeedVideo } from './FeedVideo';

const PRELOAD_AHEAD = 2;

/**
 * Full-screen vertical pager. One player plays (the visible page); the next
 * two pages and the previous one hold a buffering player; the rest are posters.
 */
export function FeedPager({
  items,
  onEndReached,
  refreshing,
  onRefresh,
  ListEmptyComponent,
}: {
  items: FeedItem[];
  onEndReached: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  ListEmptyComponent?: React.ReactElement;
}) {
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const screenFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const focused = screenFocused && appActive;

  const onWatched = useImpressions();

  // Fetch like/comment counts for the window around the current page in one call.
  const windowIds = useMemo(
    () => items.slice(Math.max(0, index - 1), index + 6).map((i) => i.id),
    [items, index],
  );
  const counts = useVideoCounts(windowIds);
  const countsKey = windowIds.join(',');

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }, []);

  const renderItem = useCallback(
    ({ item, index: i }: { item: FeedItem; index: number }) => (
      <FeedVideo
        item={item}
        height={height}
        active={i === index}
        preload={i >= index - 1 && i <= index + PRELOAD_AHEAD}
        counts={counts.data?.[item.id]}
        countsKey={countsKey}
        onWatched={onWatched}
        focused={focused}
      />
    ),
    [height, index, counts.data, countsKey, onWatched, focused],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))}>
      {height > 0 ? (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          removeClippedSubviews
          onEndReachedThreshold={3}
          onEndReached={onEndReached}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          ListEmptyComponent={ListEmptyComponent}
          extraData={index}
        />
      ) : null}
    </View>
  );
}
