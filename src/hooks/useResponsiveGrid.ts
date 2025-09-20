import { useState, useEffect } from 'react';

const getColumnCount = (width: number) => {
  if (width < 640) return 3; // sm - 移动端显示3列
  if (width < 768) return 4; // md
  if (width < 1024) return 5; // lg
  if (width < 1280) return 6; // xl
  if (width < 1536) return 7; // 2xl
  return 8;
};

export const useResponsiveGrid = () => {
  const [columnCount, setColumnCount] = useState(3);
  const [columnWidth, setColumnWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      // 对应页面布局 'max-w-[95%] mx-auto' 和 'px-4 sm:px-10'
      const padding = window.innerWidth < 640 ? 32 : 80;
      const currentContainerWidth = Math.min(window.innerWidth * 0.95, window.innerWidth - padding);
      setContainerWidth(currentContainerWidth);
      
      const newColumnCount = getColumnCount(window.innerWidth);
      setColumnCount(newColumnCount);
      
      // 对应页面布局 'gap-x-2 sm:gap-x-8'
      const gap = window.innerWidth < 640 ? 8 : 32;
      const totalGapWidth = (newColumnCount - 1) * gap;
      setColumnWidth((currentContainerWidth - totalGapWidth) / newColumnCount);
    };

    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { columnCount, columnWidth, containerWidth };
};
