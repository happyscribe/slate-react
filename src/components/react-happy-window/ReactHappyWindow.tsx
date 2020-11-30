/* eslint-disable no-lonely-if */
/* eslint-disable no-param-reassign */
/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useRef, useEffect, useLayoutEffect, useReducer } from 'react';
// eslint-disable-next-line import/no-cycle
import { ScrollBar } from './ScrollBar';

const NUM_ELEMENTS_INITIAL = 20;
const EXTRA_WINDOW_SPACE = 500;
const SAFE_WINDOW_SPACE = EXTRA_WINDOW_SPACE / 2;
const FIX_POSITION_AFTER_SCROLL_DOWN = 'FIX_POSITION_AFTER_SCROLL_DOWN';
const FIX_POSITION_AFTER_SCROLL_UP = 'FIX_POSITION_AFTER_SCROLL_UP';
const SCROLL_TO_BOTTOM = 'SCROLL_TO_BOTTOM';
export const FINISH_SCROLL_TO_INDEX = 'FINISH_SCROLL_TO_INDEX';

export const ReactHappyWindow = ({
  itemCount,
  renderElement,
  paddingTopPx = 0, // High paddings can break some assumptions?
  paddingBottomPx = 0, // High paddings can break some assumptions?
  scrollToIndexObject,
}) => {
  const {
    startIndex,
    numElements,
    containerRef,
    containerStyles,
    stateRef,
    onScroll,
  } = useVirtualization({
    itemCount,
    paddingTopPx,
    paddingBottomPx,
    scrollToIndexObject,
  });

  useEffect(() => {
    // For debugging
    window.container = containerRef.current;
    window.offsetParent = containerRef.current.offsetParent;
  }, []);

  const children = [];
  for (let i = startIndex; i < startIndex + numElements; i += 1) {
    children.push(renderElement(i));
  }

  // console.log({ startIndex, numElements, containerStyles });

  return (
    <div style={{ position: 'relative', display: 'flex', height: '100%' }}>
      <div
        className="hidden-scrollbar"
        style={offsetParentStyles}
        onScroll={onScroll}
      >
        <div
          ref={containerRef}
          style={{ ...containerDefaultStyles, ...containerStyles }}
        >
          {children}
        </div>
        {/* The next div sets the scroll height of the parent */}
        <div contentEditable={false} />
      </div>
      <ScrollBar stateRef={stateRef} containerRef={containerRef} />
    </div>
  );
};

const offsetParentStyles = {
  position: 'relative',
  minWidth: '100px',
  minHeight: '100px',
  width: '100%',
  height: '100%',
  overflowY: 'scroll',
};

const containerDefaultStyles = {
  // If changing anything here it has to be changed from applyStles too
  position: 'absolute',
  width: '100%',
  // background: 'beige',
};

const useVirtualization = ({
  itemCount,
  paddingTopPx = 0,
  paddingBottomPx = 0,
  scrollToIndexObject,
}) => {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const stateRef = useRef({
    containerStyles: {
      ...containerDefaultStyles,
      paddingTop: `${paddingTopPx}px`,
      paddingBottom: `${paddingBottomPx}px`,
    },
    indexes: capIndexes({
      startIndex: scrollToIndexObject ? scrollToIndexObject.value : 0,
      numElements: NUM_ELEMENTS_INITIAL,
      itemCount,
    }),
    isMounted: false,
    itemCount,
    nextLayoutEffect: null,
    scrollHeight: 0,
    totalElementsHeight: 0,
    paddingTopPx,
    paddingBottomPx,
  });
  const containerRef = useRef();

  const updateIndexes = ({
    startIndex,
    numElements,
    nextLayoutEffect = null,
    forceStateUpdate,
  }) => {
    const newIndexes = capIndexes({
      startIndex,
      numElements,
      itemCount: stateRef.current.itemCount,
    });
    if (
      haveIndexesChanged(stateRef.current.indexes, newIndexes) ||
      forceStateUpdate
    ) {
      stateRef.current.nextLayoutEffect = nextLayoutEffect;
      stateRef.current.indexes = newIndexes;
      forceUpdate();
      return true;
    }
    return false;
  };

  if (stateRef.current.itemCount !== itemCount) {
    // itemCount changes have to be handled on the same render (not on sideEffects)
    handleItemCountChanged({
      containerRef,
      newItemCount: itemCount,
      stateRef,
      updateIndexes,
    });
  }
  stateRef.current.itemCount = itemCount;

  useEffect(() => {
    initScrollHeight({
      container: containerRef.current,
      stateRef,
    });
    fillWindow({
      container: containerRef.current,
      stateRef,
      updateIndexes,
    });
    const observer = initIntersectionObserver({
      container: containerRef.current,
      stateRef,
      updateIndexes,
    });
    stateRef.current.isMounted = true;
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    scrollToIndex({
      scrollToIndexObject,
      container: containerRef.current,
      stateRef,
      updateIndexes,
    });
  }, [scrollToIndexObject]);

  useLayoutEffect(() => {
    handleLayoutEffect({
      container: containerRef.current,
      forceUpdate,
      stateRef,
      updateIndexes,
    });
  });

  const onScroll = () => {
    // Fallback in case something goes wrong #shame
    setTimeout(() => {
      if (isOutOfView(containerRef.current)) {
        setTimeout(() => {
          if (isOutOfView(containerRef.current)) {
            console.error('Container is out of view. Simulating scroll');
            handleScroll({
              container: containerRef.current,
              hasJumped: true,
              stateRef,
              updateIndexes,
            });
          }
        }, 100);
      }
    }, 100);
  };

  return {
    ...stateRef.current.indexes,
    containerRef,
    containerStyles: stateRef.current.containerStyles,
    stateRef,
    onScroll,
  };
};

const initScrollHeight = ({ container, stateRef }) => {
  // Without the setTimeout, the offsetHeight is not correct because the styles are not applied yet.
  // Possible causes: dev environment?, fast refresh?
  setTimeout(() => {
    const totalElementsHeight =
      averageElementHeight(container) * stateRef.current.itemCount;

    updateScrollHeight({
      container,
      stateRef,
      totalElementsHeight,
    });
  });
};

const fillWindow = ({ container, stateRef, updateIndexes }) => {
  // Using setTimeout so that it triggers on the next tick
  setTimeout(() => {
    handleScroll({
      container,
      hasJumped: isOutOfView(container),
      stateRef,
      updateIndexes,
    });
  });
};

const initIntersectionObserver = ({ container, stateRef, updateIndexes }) => {
  const options = {
    root: container.offsetParent,
    rootMargin: `${SAFE_WINDOW_SPACE}px 0px`,
    threshold: buildThresholdList(),
  };

  const callback = (entries) => {
    const lastEntry = entries[entries.length - 1];

    handleScroll({
      container,
      hasJumped: lastEntry.intersectionRatio === 0,
      stateRef,
      updateIndexes,
    });
  };

  const observer = new IntersectionObserver(callback, options);
  observer.observe(container);

  return observer;
};

const handleLayoutEffect = ({
  container,
  forceUpdate,
  stateRef,
  updateIndexes,
}) => {
  const { itemCount, indexes } = stateRef.current;
  if (indexes.numElements === itemCount) {
    // All the elements are being rendered
    const totalElementsHeight = heightWithoutPadding(container);
    updateScrollHeight({
      container,
      stateRef,
      totalElementsHeight,
    });
  }
  switch (stateRef.current.nextLayoutEffect) {
    case FINISH_SCROLL_TO_INDEX:
    case FIX_POSITION_AFTER_SCROLL_DOWN:
    case FIX_POSITION_AFTER_SCROLL_UP:
      fixPositionAfterRender({
        container,
        stateRef,
        triggerRender: forceUpdate,
        updateIndexes,
      });
      stateRef.current.nextLayoutEffect = null;
      break;
    case SCROLL_TO_BOTTOM:
      // console.log('Why is this necessary?');
      scrollToBottom(container.offsetParent);
      stateRef.current.nextLayoutEffect = null;
      break;
    case null:
      break;
    default:
      throw new Error(
        `Layout effect not handled: ${stateRef.current.nextLayoutEffect}`
      );
  }
};

const handleItemCountChanged = ({
  containerRef,
  newItemCount,
  stateRef,
  updateIndexes,
}) => {
  const { indexes } = stateRef.current;
  const container = containerRef.current;

  const totalElementsHeight = averageElementHeight(container) * newItemCount;

  updateScrollHeight({
    container,
    stateRef,
    totalElementsHeight,
  });

  // eslint-disable-next-line no-restricted-globals
  if (newItemCount === 0 || isNaN(newItemCount)) {
    stateRef.current.indexes = { startIndex: 0, numElements: 0 };
  } else {
    stateRef.current.itemCount = newItemCount;
    updateIndexes({
      startIndex: indexes.startIndex,
      numElements: NUM_ELEMENTS_INITIAL,
    });
  }
};

const scrollToIndex = ({
  scrollToIndexObject,
  container,
  stateRef,
  updateIndexes,
}) => {
  if (!isValidScrollToIndexObject(scrollToIndexObject)) {
    // console.error(`scrollToIndexObject is not correct.`);
    return;
  }
  const newStartIndex = scrollToIndexObject.value;
  const { offsetParent } = container;

  const newScrollTop = startIndexToScrollTop({
    startIndex: newStartIndex,
    stateRef,
    container,
  });

  offsetParent.scrollTop = newScrollTop;

  updateContainerStyles({
    stateRef,
    top: `${offsetParent.scrollTop - stateRef.current.paddingTopPx}px`,
  });

  updateIndexes({
    startIndex: newStartIndex,
    numElements: NUM_ELEMENTS_INITIAL,
    nextLayoutEffect: FINISH_SCROLL_TO_INDEX,
    forceStateUpdate: true,
  });
};

const handleScroll = ({ container, hasJumped, stateRef, updateIndexes }) => {
  if (stateRef.current.nextLayoutEffect) {
    // It's a bad idea to have this here because:
    // if we loose the last onScroll event, we might be rendering the wrong content
    // return;
    // throw new Error('stateRef.current.nextLayoutEffect is not null');
    console.error('stateRef.current.nextLayoutEffect is not null');
    stateRef.current.nextLayoutEffect = null;
    return;
  }

  if (hasJumped || container.children.length === 0) {
    handleScrollJump({
      container,
      stateRef,
      updateIndexes,
    });
  } else {
    handleSmoothScroll({
      container,
      stateRef,
      updateIndexes,
    });
  }
};

const handleSmoothScroll = ({ container, stateRef, updateIndexes }) => {
  const scrollingDown = isScrollingDown({ container, stateRef });
  const { newIndexes, heightOfRemovedElements } = calculateNewIndexes({
    container,
    scrollingDown,
    stateRef,
  });

  if (haveIndexesChanged(stateRef.current.indexes, newIndexes)) {
    updatePositionForTheNextRender({
      container,
      heightOfRemovedElements,
      newIndexes,
      scrollingDown,
      stateRef,
    });

    updateIndexes({
      ...newIndexes,
      nextLayoutEffect: scrollingDown
        ? FIX_POSITION_AFTER_SCROLL_DOWN
        : FIX_POSITION_AFTER_SCROLL_UP,
    });
  }
};

const handleScrollJump = ({ container, stateRef, updateIndexes }) => {
  const { offsetParent } = container;
  if (isScrolledToTheBottom(offsetParent)) {
    // console.log('Does this work?');
    updateContainerStyles({
      stateRef,
      bottom: `${offsetParent.offsetHeight - offsetParent.scrollHeight}px`,
    });
    updateIndexes({
      startIndex: stateRef.current.itemCount - NUM_ELEMENTS_INITIAL,
      numElements: NUM_ELEMENTS_INITIAL,
      nextLayoutEffect: SCROLL_TO_BOTTOM,
      forceStateUpdate: true,
    });
  } else {
    const startIndex = Math.min(
      scrollTopToStartIndex({
        container,
        stateRef,
      }),
      stateRef.current.itemCount - 1
    );

    if (startIndex + NUM_ELEMENTS_INITIAL >= stateRef.current.itemCount - 1) {
      updateContainerStyles({
        stateRef,
        bottom: `${offsetParent.offsetHeight - offsetParent.scrollHeight}px`,
      });
    } else {
      const newTop =
        startIndex === 0
          ? 0
          : offsetParent.scrollTop - stateRef.current.paddingTopPx;

      updateContainerStyles({
        stateRef,
        top: `${newTop}px`,
      });
    }

    updateIndexes({
      startIndex,
      numElements: NUM_ELEMENTS_INITIAL,
      forceStateUpdate: true,
    });
  }
};

const updatePositionForTheNextRender = ({
  container,
  heightOfRemovedElements,
  newIndexes,
  scrollingDown,
  stateRef,
}) => {
  if (stateRef.current.indexes.startIndex === newIndexes.startIndex) {
    if (stateRef.current.containerStyles.top === undefined) {
      updateContainerStyles({ stateRef, top: `${currentTop(container)}px` });
    }
    return;
  }
  if (!hasEndIndexChanged(stateRef.current.indexes, newIndexes)) {
    if (stateRef.current.containerStyles.bottom === undefined) {
      updateContainerStyles({
        stateRef,
        bottom: `${currentBottom(container)}px`,
      });
    }
    return;
  }
  if (scrollingDown) {
    const newTop = currentTop(container) + heightOfRemovedElements;
    updateContainerStyles({ stateRef, top: `${newTop}px` });
  } else {
    const newBottom = currentBottom(container) + heightOfRemovedElements;
    updateContainerStyles({ stateRef, bottom: `${newBottom}px` });
  }
};

const fixPositionAfterRender = ({
  container,
  stateRef,
  triggerRender,
  updateIndexes,
}) => {
  const scrollingDown =
    stateRef.current.nextLayoutEffect === FIX_POSITION_AFTER_SCROLL_DOWN;

  const { offsetParent } = container;
  const { indexes, itemCount } = stateRef.current;
  const { startIndex } = indexes;

  if (startIndex === 0 || isAtTheEnd({ indexes, itemCount })) {
    let errorOffset = 0;
    if (startIndex === 0) {
      errorOffset = currentTop(container);
      updateContainerStyles({ stateRef, top: '0px' });
    } else {
      const newBottom = offsetParent.offsetHeight - offsetParent.scrollHeight;
      errorOffset = newBottom - currentBottom(container);
      updateContainerStyles({ stateRef, bottom: `${newBottom}px` });
    }
    if (
      container.offsetHeight <
      offsetParent.offsetHeight + EXTRA_WINDOW_SPACE
    ) {
      // Simulate a scroll to load more items
      stateRef.current.nextLayoutEffect = null;
      // -1 so that it thinks that it's a scroll up and adds items above
      stateRef.current.lastHandledScrollTop = offsetParent.scrollTop - 1;
      handleScroll({
        container,
        hasJumped: false,
        stateRef,
        updateIndexes,
      });
    } else {
      offsetParent.scrollBy(0, -errorOffset);
      triggerRender();
    }
  } else {
    if (scrollingDown) {
      updateScrollHeightIfNeeded({
        scrollingDown,
        stateRef,
        container,
      });
    } else if (
      !scrollingDown &&
      startIndex !== 0 &&
      offsetParent.scrollTop < offsetParent.scrollHeight / 2
    ) {
      const spaceNeededAbove = averageElementHeight(container) * startIndex;
      // console.log('#############');
      // console.log('spaceNeededAbove: ', spaceNeededAbove);
      // console.log('container.offsetTop: ', container.offsetTop);
      // if (spaceNeededAbove > container.offsetTop) {
      const newTop = spaceNeededAbove;
      const errorOffset = newTop - container.offsetTop;
      updateContainerStyles({ stateRef, top: `${newTop}px` });
      // console.log({ errorOffset });
      // if (offsetParent.scrollTop + errorOffset > offsetParent.scrollHeight) {
      updateScrollHeightIfNeeded({
        scrollingDown,
        stateRef,
        container,
      });
      // }
      offsetParent.scrollBy(0, errorOffset);
      triggerRender();
      // }
    }
  }
};

const updateScrollHeightIfNeeded = ({ container, scrollingDown, stateRef }) => {
  const { offsetParent } = container;
  const { indexes, itemCount } = stateRef.current;
  const { startIndex, numElements } = indexes;

  if (startIndex === 0 || isAtTheEnd({ indexes, itemCount })) return;
  let totalElementsHeight;

  if (scrollingDown) {
    const bottomRelative =
      -currentBottom(container) / offsetParent.scrollHeight;
    const whereShouldBottomBe = (startIndex + numElements + 1) / itemCount;
    const ratio = bottomRelative / whereShouldBottomBe;
    totalElementsHeight = stateRef.current.totalElementsHeight * ratio;
    if (ratio < 0.98 || ratio > 1.02) {
      // console.log(`updateScrollHeight. ratio: ${ratio}`);
      // const totalElementsHeight = stateRef.current.totalElementsHeight * ratio;
      updateScrollHeight({
        container,
        stateRef,
        totalElementsHeight,
      });
    }
  } else if (!scrollingDown) {
    // [TODO]: review
    totalElementsHeight =
      averageElementHeight(container) * stateRef.current.itemCount;
    updateScrollHeight({
      container,
      stateRef,
      totalElementsHeight,
    });
  }
};

const updateScrollHeight = ({ container, stateRef, totalElementsHeight }) => {
  const scrollHeight =
    totalElementsHeight +
    stateRef.current.paddingTopPx +
    stateRef.current.paddingBottomPx;
  stateRef.current.totalElementsHeight = totalElementsHeight;
  stateRef.current.scrollHeight = scrollHeight;
  container.offsetParent.lastChild.style.height = `${scrollHeight}px`;
};

const calculateNewIndexes = ({ container, scrollingDown, stateRef }) => {
  const elements = container.children;

  const itemCountToAdd = calculateElementsToAdd({
    container,
    elements,
    scrollingDown,
    stateRef,
  });

  if (itemCountToAdd === 0) {
    // Wait to remove elements on the same render that we need to add elements
    return { newIndexes: stateRef.current.indexes };
  }

  const {
    itemCountToRemove,
    heightOfRemovedElements,
  } = calculateElementsToRemove({
    container,
    elements,
    scrollingDown,
  });

  const startIndex = scrollingDown
    ? stateRef.current.indexes.startIndex + itemCountToRemove
    : stateRef.current.indexes.startIndex - itemCountToAdd;

  const numElements =
    stateRef.current.indexes.numElements + itemCountToAdd - itemCountToRemove;

  const newIndexes = capIndexes({
    startIndex,
    numElements,
    itemCount: stateRef.current.itemCount,
  });

  return { newIndexes, heightOfRemovedElements };
};

const calculateElementsToAdd = ({
  container,
  elements,
  scrollingDown,
  stateRef,
}) => {
  const { indexes, itemCount } = stateRef.current;
  if (
    (scrollingDown && isAtTheEnd({ indexes, itemCount })) ||
    (!scrollingDown && indexes.startIndex === 0)
  ) {
    return 0;
  }

  const element = scrollingDown ? elements[elements.length - 1] : elements[0];

  const distance = scrollingDown
    ? distanceFromElementBottomToVisibleDiv({ container, element })
    : distanceFromElementTopToVisibleDiv({ container, element });

  const isSafeWindowFull = distance + element.offsetHeight >= SAFE_WINDOW_SPACE;

  if (!isSafeWindowFull) {
    const gapToFill = EXTRA_WINDOW_SPACE - distance - element.offsetHeight;
    const num = Math.trunc(gapToFill / averageElementHeight(container)) + 1;
    if (scrollingDown) {
      return Math.min(
        num,
        itemCount - (indexes.startIndex + indexes.numElements)
      );
    }
    return Math.min(num, indexes.startIndex);
  }

  return 0;
};

const calculateElementsToRemove = ({ container, elements, scrollingDown }) => {
  let itemCountToRemove = 0;
  let heightOfRemovedElements = 0;

  for (let i = 0; i <= elements.length - 1; i += 1) {
    const isFirstElement = i === 0;
    const idx = scrollingDown ? i : elements.length - 1 - i;
    const element = elements[idx];

    const distance = scrollingDown
      ? distanceFromElementTopToVisibleDiv({ container, element })
      : distanceFromElementBottomToVisibleDiv({ container, element });

    let shouldBeRemoved;

    if (isFirstElement) {
      shouldBeRemoved = distance > EXTRA_WINDOW_SPACE;
    } else {
      shouldBeRemoved = distance > SAFE_WINDOW_SPACE;
    }

    if (shouldBeRemoved) {
      itemCountToRemove += 1;
      heightOfRemovedElements += element.offsetHeight;
    } else {
      break;
    }
  }

  return { itemCountToRemove, heightOfRemovedElements };
};

const distanceFromElementTopToVisibleDiv = ({ container, element }) => {
  const offsetParentRect = container.offsetParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  return offsetParentRect.top - elementRect.bottom;
};

const distanceFromElementBottomToVisibleDiv = ({ container, element }) => {
  const offsetParentRect = container.offsetParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  return elementRect.top - offsetParentRect.bottom;
};

export const averageElementHeight = (container) => {
  return heightWithoutPadding(container) / container.children.length;
};

const heightWithoutPadding = (container) => {
  return (
    container.offsetHeight -
    currentPaddingTopPx({ container }) -
    currentPaddingBottomPx({ container })
  );
};

const currentPaddingTopPx = ({ container }) => {
  if (!container.style.paddingTop) return 0;
  return parseFloat(container.style.paddingTop.split('px')[0]);
};

const currentPaddingBottomPx = ({ container }) => {
  if (!container.style.paddingBottom) return 0;
  return parseFloat(container.style.paddingBottom.split('px')[0]);
};

const currentTop = (container) => {
  return container.offsetTop;
};

const currentBottom = (container) => {
  return (
    container.offsetParent.offsetHeight -
    container.offsetTop -
    container.offsetHeight
  );
};

const capNumber = (number, min, max) => {
  return Math.max(min, Math.min(number, max));
};

const capIndexes = ({ startIndex, numElements, itemCount }) => {
  const newStartIndex = capNumber(startIndex, 0, itemCount - 1);
  const newNumElements = capNumber(numElements, 1, itemCount - newStartIndex);
  return {
    startIndex: newStartIndex,
    numElements: newNumElements,
  };
};

const isAtTheEnd = ({ indexes, itemCount }) => {
  return indexes.startIndex + indexes.numElements === itemCount;
};

const haveIndexesChanged = (a, b) => {
  const haveChanged =
    a.startIndex !== b.startIndex || a.numElements !== b.numElements;
  return haveChanged;
};

const hasEndIndexChanged = (a, b) => {
  return a.startIndex + a.numElements !== b.startIndex + b.numElements;
};

const isScrolledToTheBottom = (el) => {
  return el.scrollHeight - el.offsetHeight === el.scrollTop;
};

const scrollToBottom = (el) => {
  el.scrollTop = el.scrollHeight - el.offsetHeight;
};

const updateContainerStyles = ({ stateRef, bottom, top }) => {
  stateRef.current.containerStyles = {
    ...containerDefaultStyles,
    paddingTop: stateRef.current.containerStyles.paddingTop,
    paddingBottom: stateRef.current.containerStyles.paddingBottom,
    top,
    bottom,
  };
};

const isValidScrollToIndexObject = (obj) => {
  return obj && typeof obj.value === 'number';
};

const scrollTopToStartIndex = ({ container, stateRef }) => {
  const { offsetParent } = container;
  return Math.round(
    (offsetParent.scrollTop /
      (offsetParent.scrollHeight - offsetParent.offsetHeight)) *
      stateRef.current.itemCount
  );
};

const startIndexToScrollTop = ({ startIndex, stateRef }) => {
  return (
    stateRef.current.paddingTopPx +
    (startIndex / stateRef.current.itemCount) *
      stateRef.current.totalElementsHeight
  );
};

const isScrollingDown = ({ container, stateRef }) => {
  const { offsetParent } = container;
  const _ = offsetParent.scrollTop - stateRef.current.lastHandledScrollTop > 0;
  stateRef.current.lastHandledScrollTop = offsetParent.scrollTop;
  return _;
};

const buildThresholdList = () => {
  const thresholds = [];
  const numSteps = 100;

  for (let i = 1.0; i <= numSteps; i += 1) {
    const ratio = i / numSteps;
    thresholds.push(ratio);
  }

  thresholds.push(0);
  return thresholds;
};

const isOutOfView = (container) => {
  const containerRect = container.getBoundingClientRect();
  const offsetParentRect = container.offsetParent.getBoundingClientRect();
  if (containerRect.top < offsetParentRect.top) {
    return containerRect.top + containerRect.height < offsetParentRect.top;
  }
  return containerRect.top > offsetParentRect.top + offsetParentRect.height;
};
