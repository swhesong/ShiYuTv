import { useState, useEffect } from 'react';

const getColumnCount = (width: number) => {
  if (width < 640) return 3; // sm
  if (width < 768) return 4; // md
  if (width < 1024) return 5; // lg
  if (width < 1280) return 6; // xl
  if (width < 1536) return 7; // 2xl
  return 8;
};

export const useResponsiveGrid = () => {
  const [columnCount, setColumnCount] = useState(1);
  const [columnWidth, setColumnWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      // Target the main content grid container
      const gridContainer = document.querySelector('.max-w-\\[95\\%\\]');
      if (gridContainer) {
        const containerPadding = 32; // example padding, adjust as needed
        const currentContainerWidth = gridContainer.clientWidth - containerPadding;
        setContainerWidth(currentContainerWidth);
        const newColumnCount = getColumnCount(window.innerWidth);
        setColumnCount(newColumnCount);
        // Calculate column width based on container width and column count
        const gap = 32; // sm:gap-x-8
        const totalGapWidth = (newColumnCount - 1) * gap;
        setColumnWidth((currentContainerWidth - totalGapWidth) / newColumnCount);
      }
    };

    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);
    
    // Use MutationObserver to detect when the container appears
    const observer = new MutationObserver(handleResize);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return { columnCount, columnWidth, containerWidth };
};
