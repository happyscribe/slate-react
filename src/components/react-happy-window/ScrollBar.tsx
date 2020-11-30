import React, { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line import/no-cycle
import { FINISH_SCROLL_TO_INDEX } from './ReactHappyWindow';
import { loadStyles } from './styles';

// export const ScrollBar = ({ startIndex, endIndex, childrenLength }) => {
export const ScrollBar = ({ stateRef, containerRef }) => {
  const scrollbarRef = useRef();
  const lastOffsetParentScrollTop = useRef(0);
  const lastHandledScrollbarScrollTop = useRef(0);
  const jumpToIndexRef = useRef(false);
  const [height, setHeight] = useState();
  const [scrollbarWidth, setScrollbarWidth] = useState(15);

  useEffect(() => {
    const initHeight = () => {
      if (stateRef.current.scrollHeight) {
        setHeight(stateRef.current.scrollHeight);
      } else {
        setTimeout(() => {
          initHeight();
        }, 50);
      }
    };
    initHeight();
    loadStyles();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const { offsetParent } = container;
    const contentScrollHandler = (e) => {
      let deltaY = offsetParent.scrollTop - lastOffsetParentScrollTop.current;
      lastOffsetParentScrollTop.current = offsetParent.scrollTop;

      if (jumpToIndexRef.current === true) {
        jumpToIndexRef.current = false;
        scrollbarRef.current.scrollTop =
          (offsetParent.scrollTop /
            (offsetParent.scrollHeight - offsetParent.offsetHeight)) *
          (scrollbarRef.current.scrollHeight -
            scrollbarRef.current.offsetHeight);
        lastHandledScrollbarScrollTop.current = scrollbarRef.current.scrollTop;
        return;
      }

      if (deltaY === 0) return;
      if ((e.deltaY < 0 && deltaY > 0) || (e.deltaY > 0 && deltaY < 0)) {
        // Scroll triggered by a correction in the estimated height. Skipping the render
        return;
      }
      if (deltaY / e.deltaY > 10) {
        // Huge deltaY because it was a correction. Skipping the render
        deltaY = e.deltaY;
      }
      const scrollingDown = deltaY > 0;

      const scrollbarScrollLeft = scrollingDown
        ? (scrollbarRef.current.scrollHeight -
            scrollbarRef.current.scrollTop -
            scrollbarRef.current.offsetHeight) /
          scrollbarRef.current.scrollHeight
        : scrollbarRef.current.scrollTop / scrollbarRef.current.scrollHeight;

      const contentScrollLeft = scrollingDown
        ? (offsetParent.scrollHeight -
            offsetParent.scrollTop -
            offsetParent.offsetHeight) /
          offsetParent.scrollHeight
        : offsetParent.scrollTop / offsetParent.scrollHeight;

      const ratio = scrollbarScrollLeft / contentScrollLeft;
      let scrollBy = deltaY * ratio;

      if (contentScrollLeft === 0) {
        // console.warn('we should already be at the end');
        scrollBy = scrollingDown ? 1000 : -1000;
      }
      // console.log({ scrollbarScrollLeft, contentScrollLeft, ratio });

      scrollbarRef.current.scrollBy(0, Math.trunc(scrollBy));
      lastHandledScrollbarScrollTop.current = scrollbarRef.current.scrollTop;
    };
    offsetParent.addEventListener('wheel', contentScrollHandler, false);
    return () =>
      offsetParent.removeEventListener('wheel', contentScrollHandler);
  }, []);

  useEffect(() => {
    if (height) {
      setScrollbarWidth(
        scrollbarRef.current.offsetWidth - scrollbarRef.current.clientWidth ||
          20
      );
      window.scrollbarRef = scrollbarRef;
    }
  }, [height]);

  if (stateRef.current.nextLayoutEffect === FINISH_SCROLL_TO_INDEX) {
    jumpToIndexRef.current = true;
  }

  const handleScrollbarScroll = () => {
    if (
      lastHandledScrollbarScrollTop.current === scrollbarRef.current.scrollTop
    ) {
      return;
    }
    const scrollPercentage =
      scrollbarRef.current.scrollTop /
      (scrollbarRef.current.scrollHeight - scrollbarRef.current.offsetHeight);
    const { offsetParent } = containerRef.current;
    const newScrollTop =
      scrollPercentage *
      (offsetParent.scrollHeight - offsetParent.offsetHeight);
    offsetParent.scrollTop = newScrollTop;
    lastOffsetParentScrollTop.current = newScrollTop;
  };

  return (
    <div
      className="only-desktop"
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        width: `${scrollbarWidth}px`,
        height: '100%',
        overflowY: 'scroll',
      }}
      ref={scrollbarRef}
      onScroll={handleScrollbarScroll}
      contentEditable={false}
    >
      <div style={{ height: `${height}px` }} />
    </div>
  );
};