import React from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { SearchResult } from '@/lib/types';
import VideoCard, { VideoCardHandle } from '@/components/VideoCard';
import DoubanCardSkeleton from './DoubanCardSkeleton';

// ItemData 接口定义了传递给每个网格项的数据结构
interface ItemData {
  columnCount: number;
  results: SearchResult[];
  aggregatedResults: [string, SearchResult[]][];
  hasNextPage: boolean; // 用于在流式加载时显示骨架屏
  columnWidth: number;
  viewMode: 'agg' | 'all';
  searchQuery: string;
  computeGroupStats: (group: SearchResult[]) => {
    douban_id?: number;
    episodes?: number;
    source_names: string[];
  };
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
}

// 单个网格项的渲染组件
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
}: any) => {
  const { columnCount, results, aggregatedResults, hasNextPage, viewMode, searchQuery, computeGroupStats, getGroupRef } = data;
  const index = rowIndex * columnCount + columnIndex;

  // 聚合视图
  if (viewMode === 'agg') {
    if (index >= aggregatedResults.length) {
      // 如果还在加载中（流式搜索），显示骨架屏
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
          ref={getGroupRef(mapKey)}
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
  } 
  
  // 全部视图
  else {
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

// VirtualSearchGrid 组件的 Props 定义
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
  getGroupRef: (key: string) => React.RefObject<VideoCardHandle>;
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
  getGroupRef,
}: VirtualSearchGridProps) => {
  const dataSource = viewMode === 'agg' ? aggregatedResults : results;
  // 如果还在加载中（例如流式搜索未完成），则多渲染一行骨架屏作为占位
  const itemCount = hasNextPage ? dataSource.length + columnCount : dataSource.length;
  const rowCount = Math.ceil(itemCount / columnCount);
  const headerHeight = 300; // 估算的搜索页顶部选择器等的高度

  // 搜索页加载所有数据后进行虚拟滚动，不需要无限加载器
  return (
    <Grid
      className="hide-scrollbar"
      columnCount={columnCount}
      columnWidth={columnWidth}
      height={window.innerHeight - headerHeight}
      rowCount={rowCount}
      rowHeight={columnWidth * 1.5 + 100}
      width={containerWidth}
      itemData={{ 
        columnCount, results, aggregatedResults, hasNextPage, columnWidth, viewMode, searchQuery, computeGroupStats, getGroupRef
      }}
    >
      {Item}
    </Grid>
  );
};

export default VirtualSearchGrid;
