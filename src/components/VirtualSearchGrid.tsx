import React from 'react';
import { FixedSizeGrid as Grid, GridOnItemsRenderedProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { SearchResult } from '@/lib/types';
import VideoCard from './VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

interface ItemData {
  columnCount: number;
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean;
  columnWidth: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
}

const Item = ({
  data,
  columnIndex,
  rowIndex,
  style,
}: {
  data: ItemData;
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
}) => {
  const { columnCount, results, aggregatedResults, hasNextPage, viewMode, searchQuery, computeGroupStats } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (viewMode === 'agg') {
    if (index >= aggregatedResults.length) {
      return hasNextPage ? (
        <div style={style}>
          <DoubanCardSkeleton />
        </div>
      ) : null;
    }

    const [mapKey, group] = aggregatedResults[index];
    const title = group[0]?.title || '';
    const poster = group[0]?.poster || '';
    const year = group[0]?.year || 'unknown';
    const { episodes, source_names, douban_id } = computeGroupStats(group);
    const type = episodes === 1 ? 'movie' : 'tv';

    return (
      <div style={style}>
        <VideoCard
          from='search'
          isAggregate={true}
          title={title}
          poster={poster}
          year={year}
          episodes={episodes}
          source_names={source_names}
          douban_id={douban_id}
          query={searchQuery.trim() !== title ? searchQuery.trim() : ''}
          type={type}
        />
      </div>
    );
  } else {
    if (index >= results.length) {
      return hasNextPage ? (
        <div style={style}>
          <DoubanCardSkeleton />
        </div>
      ) : null;
    }

    const item = results[index];
    return (
      <div style={style}>
        <VideoCard
          id={item.id}
          title={item.title}
          poster={item.poster}
          episodes={item.episodes.length}
          source={item.source}
          source_name={item.source_name}
          douban_id={item.douban_id}
          query={searchQuery.trim() !== item.title ? searchQuery.trim() : ''}
          year={item.year}
          from='search'
          type={item.episodes.length > 1 ? 'tv' : 'movie'}
        />
      </div>
    );
  }
};

interface VirtualSearchGridProps {
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean;
  columnCount: number;
  columnWidth: number;
  containerWidth: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
}

const VirtualSearchGrid = ({
  results,
  aggregatedResults,
  hasNextPage,
  columnCount,
  columnWidth,
  containerWidth,
  viewMode,
  searchQuery,
  computeGroupStats,
}: VirtualSearchGridProps) => {
  const dataSource = viewMode === 'agg' ? aggregatedResults : results;
  const itemCount = hasNextPage ? dataSource.length + columnCount : dataSource.length;
  const rowCount = Math.ceil(itemCount / columnCount);
  const headerHeight = 300; // 估算的搜索页顶部选择器等的高度

  // 搜索页不需要无限滚动，因此 loadMoreItems 是空函数
  return (
    <InfiniteLoader
      isItemLoaded={(index) => index < dataSource.length}
      itemCount={itemCount}
      loadMoreItems={() => {}} 
    >
      {({ onItemsRendered, ref }) => (
        <Grid
          className="hide-scrollbar"
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={window.innerHeight - headerHeight}
          rowCount={rowCount}
          rowHeight={columnWidth * 1.5 + 100}
          width={containerWidth}
          itemData={{ columnCount, results, aggregatedResults, hasNextPage, columnWidth, viewMode, searchQuery, computeGroupStats }}
          onItemsRendered={({
            visibleRowStartIndex,
            visibleRowStopIndex,
            overscanRowStartIndex,
            overscanRowStopIndex,
          }: GridOnItemsRenderedProps) => {
            onItemsRendered({
              overscanStartIndex: overscanRowStartIndex * columnCount,
              overscanStopIndex: overscanRowStopIndex * columnCount,
              visibleStartIndex: visibleRowStartIndex * columnCount,
              visibleStopIndex: visibleRowStopIndex * columnCount,
            });
          }}
          ref={ref}
        >
          {Item}
        </Grid>
      )}
    </InfiniteLoader>
  );
};

export default VirtualSearchGrid;
