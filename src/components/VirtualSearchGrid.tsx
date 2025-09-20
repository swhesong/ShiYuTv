import React from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import { SearchResult } from '@/lib/types';
import DoubanCardSkeleton from './DoubanCardSkeleton';
import VideoCard from './VideoCard';

interface ItemData {
  columnCount: number;
  results: SearchResult[];
  columnWidth: number;
  searchQuery: string;
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
  const { columnCount, results, searchQuery } = data;
  const index = rowIndex * columnCount + columnIndex;

  if (index >= results.length) {
    return null; // No infinite loading on search, so no skeleton here
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
};

interface VirtualSearchGridProps {
  results: SearchResult[];
  columnCount: number;
  columnWidth: number;
  containerWidth: number;
  searchQuery: string;
}

const VirtualSearchGrid = ({
  results,
  columnCount,
  columnWidth,
  containerWidth,
  searchQuery,
}: VirtualSearchGridProps) => {
  const rowCount = Math.ceil(results.length / columnCount);
  const rowHeight = columnWidth * 1.5 + 80;

  return (
    <Grid
      className='hide-scrollbar'
      columnCount={columnCount}
      columnWidth={columnWidth}
      height={window.innerHeight - 250} // Adjust height
      rowCount={rowCount}
      rowHeight={rowHeight}
      width={containerWidth}
      itemData={{ columnCount, results, columnWidth, searchQuery }}
    >
      {Item}
    </Grid>
  );
};

export default VirtualSearchGrid;
