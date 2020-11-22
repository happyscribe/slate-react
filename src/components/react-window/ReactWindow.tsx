/* eslint-disable no-param-reassign */
/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ScrollBar } from './ScrollBar';
import { loadStyles } from './styles';

const NUM_ELEMENTS_INITIAL = 20;
const EXTRA_WINDOW_SPACE = 500;

export const ReactWindow = ({ children, scrollToIndex }) => {
  const { startIndex, endIndex, containerRef, onWheel } = useVirtualization(
    children.length,
    scrollToIndex
  );

  return (
    <div className="react-window-offset-parent" onWheel={onWheel}>
      <div ref={containerRef} className="react-window-container">
        {children.slice(startIndex, endIndex + 1)}
      </div>
      <ScrollBar
        startIndex={startIndex}
        endIndex={endIndex}
        childrenLength={children.length}
      />
    </div>
  );
};

export const useVirtualization = (childrenLength, scrollToIndex) => {
  const [indexes, setIndexes] = useState({
    startIndex: scrollToIndex || 0,
    endIndex: Math.min(NUM_ELEMENTS_INITIAL, childrenLength - 1),
  });
  const { startIndex, endIndex } = indexes;
  const containerRef = useRef();
  const containerPositionRef = useRef({ top: '0px' });
  const performingAction = useRef(null);

  useEffect(() => {
    loadStyles()
  }, [])

  const onWheel = (e) => {
    handleWeel({
      deltaY: e.deltaY,
      container: containerRef.current,
      containerPositionRef,
      indexes,
      setIndexes,
      performingAction,
      childrenLength,
    });
  };

  useEffect(() => {
    handleScrollToIndex({
      scrollToIndex,
      childrenLength,
      containerRef,
      containerPositionRef,
      setIndexes,
      performingAction,
    });
  }, [scrollToIndex]);

  useEffect(() => {
    if (childrenLength <= endIndex) {
      containerPositionRef.current = { bottom: '0px' };
      setIndexes({
        startIndex: Math.max(childrenLength - NUM_ELEMENTS_INITIAL, 0),
        endIndex: childrenLength - 1,
      });
      performingAction.current = 'childrenRemoved';
    } else {
      // Simulate a scroll to add items at the bottom
      handleScrollDown({
        container: containerRef.current,
        containerPositionRef,
        indexes,
        setIndexes,
        deltaY: 0,
        performingAction,
        childrenLength,
      });
    }
  }, [childrenLength]);

  useLayoutEffect(() => {
    handleLayoutEffect({
      containerPositionRef,
      containerRef,
      performingAction,
      indexes,
      setIndexes,
      childrenLength,
    });
  });

  console.log('endIndexxx: ', endIndex)

  return {
    startIndex,
    endIndex,
    containerRef,
    containerStyle: containerPositionRef.current,
    onWheel,
  };
};

const handleWeel = ({
  deltaY,
  container,
  containerPositionRef,
  indexes,
  setIndexes,
  performingAction,
  childrenLength,
}) => {
  if (performingAction.current) return;

  const scrollingDown = deltaY > 0;
  let shouldUpdatePosition = false;
  if (scrollingDown) {
    shouldUpdatePosition = handleScrollDown({
      container,
      containerPositionRef,
      indexes,
      setIndexes,
      performingAction,
      childrenLength,
    });
  } else {
    shouldUpdatePosition = handleScrollUp({
      container,
      containerPositionRef,
      indexes,
      setIndexes,
      performingAction,
      childrenLength,
    });
  }

  if (shouldUpdatePosition) {
    updatePosition({
      container,
      containerPositionRef,
      deltaY,
      scrollingDown,
      performingAction,
    });
  }
};

const handleLayoutEffect = ({
  containerPositionRef,
  containerRef,
  performingAction,
  indexes,
  setIndexes,
  childrenLength,
}) => {
  if (performingAction.current === null) return;
  switch (performingAction.current) {
    case 'scrollToIndex':
      // Simulate a scroll to add items at the top
      handleScrollUp({
        container: containerRef.current,
        containerPositionRef,
        indexes,
        setIndexes,
        performingAction,
        childrenLength,
      });
      return;
    case 'up':
    case 'down':
    case 'childrenRemoved':
      finishUpdate({
        performingAction,
        container: containerRef.current,
        containerPositionRef,
      });
      return;
    default:
      console.log('Layout effect not handled:', performingAction.current);
      performingAction.current = null;
  }
};

const applyStyles = ({ container, containerPositionRef }) => {
  const { top, bottom } = containerPositionRef.current;
  const cssText = `bottom: ${bottom}; top: ${top};`;
  container.style.cssText = cssText;
};

const handleScrollToIndex = ({
  scrollToIndex,
  childrenLength,
  containerRef,
  containerPositionRef,
  setIndexes,
  performingAction,
}) => {
  // eslint-disable-next-line no-restricted-globals
  if (scrollToIndex === null || isNaN(scrollToIndex)) return;
  const newStartIndex = capNumber(scrollToIndex, 0, childrenLength - 1);
  const newEndIndex = capNumber(
    scrollToIndex + NUM_ELEMENTS_INITIAL,
    newStartIndex,
    childrenLength - 1
  );

  containerPositionRef.current = { top: '0px' };
  applyStyles({ container: containerRef.current, containerPositionRef });
  setIndexes({
    startIndex: newStartIndex,
    endIndex: newEndIndex,
  });
  if (newStartIndex > 0) {
    performingAction.current = 'scrollToIndex';
  }
};

const handleScrollDown = ({
  container,
  containerPositionRef,
  indexes,
  setIndexes,
  performingAction,
  childrenLength,
}) => {
  if (indexes.endIndex === childrenLength - 1) return true;

  const {
    updatingIndexes,
    startIndex,
    endIndex,
    heightOfRemovedElements,
  } = calculateNewIndexes({
    indexes,
    container,
    scrollingDown: true,
    childrenLength,
  });

  if (!updatingIndexes) return true;

  const newTop = currentTop(container) + heightOfRemovedElements;

  performingAction.current = 'down';
  containerPositionRef.current = { top: `${newTop}px` };
  applyStyles({ container, containerPositionRef });
  setIndexes({ startIndex, endIndex });
  return false;
};

const handleScrollUp = ({
  container,
  containerPositionRef,
  indexes,
  setIndexes,
  performingAction,
  childrenLength,
}) => {
  if (indexes.startIndex === 0) return true;

  const {
    updatingIndexes,
    startIndex,
    endIndex,
    heightOfRemovedElements,
  } = calculateNewIndexes({
    indexes,
    container,
    scrollingDown: false,
    childrenLength,
  });

  if (!updatingIndexes) return true;

  const newBottom = currentBottom(container) + heightOfRemovedElements;

  performingAction.current = 'up';
  containerPositionRef.current = { bottom: `${newBottom}px` };
  applyStyles({ container, containerPositionRef });
  setIndexes({ startIndex, endIndex });
  return false;
};

const calculateNewIndexes = ({
  indexes,
  container,
  scrollingDown,
  childrenLength,
}) => {
  const elements = container.children;

  const numElementsToAdd = calculateElementsToAdd({
    elements,
    container,
    scrollingDown,
  });

  const {
    numElementsToRemove,
    heightOfRemovedElements,
  } = calculateElementsToRemove({
    elements,
    container,
    scrollingDown,
  });

  const startIndex = Math.max(
    scrollingDown
      ? indexes.startIndex + numElementsToRemove
      : indexes.startIndex - numElementsToAdd,
    0
  );

  const endIndex = Math.min(
    scrollingDown
      ? indexes.endIndex + numElementsToAdd
      : indexes.endIndex - numElementsToRemove,
    childrenLength - 1
  );

  const updatingIndexes =
    startIndex !== indexes.startIndex || endIndex !== indexes.endIndex;

  return {
    updatingIndexes,
    startIndex,
    endIndex,
    heightOfRemovedElements,
  };
};

const calculateElementsToAdd = ({ elements, container, scrollingDown }) => {
  if (elements.length === 0) {
    return NUM_ELEMENTS_INITIAL;
  }

  let numElementsToAdd = 0;

  const element = scrollingDown ? elements[elements.length - 1] : elements[0];
  const distance = distanceFromElementToVisibleDiv({
    container,
    element,
    scrollingDown,
  });

  const isWindowFull = element.offsetHeight + distance >= EXTRA_WINDOW_SPACE;
  if (!isWindowFull) {
    const gapToFill = EXTRA_WINDOW_SPACE - distance - element.offsetHeight;
    numElementsToAdd = Math.trunc(gapToFill / element.offsetHeight) + 1;
  }

  return numElementsToAdd;
};

const calculateElementsToRemove = ({ elements, container, scrollingDown }) => {
  let numElementsToRemove = 0;
  let heightOfRemovedElements = 0;

  if (scrollingDown) {
    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i];

      if (shouldBeRemoved({ container, element, scrollingDown })) {
        numElementsToRemove += 1;
        heightOfRemovedElements += element.offsetHeight;
      } else {
        break;
      }
    }
  } else {
    for (let i = elements.length - 1; i >= 0; i -= 1) {
      const element = elements[i];

      if (shouldBeRemoved({ container, element, scrollingDown })) {
        numElementsToRemove += 1;
        heightOfRemovedElements += element.offsetHeight;
      } else {
        break;
      }
    }
  }
  return { numElementsToRemove, heightOfRemovedElements };
};

const shouldBeRemoved = ({ container, element, scrollingDown }) => {
  return (
    distanceFromElementToVisibleDiv({ container, element, scrollingDown }) >
    EXTRA_WINDOW_SPACE
  );
};

const distanceFromElementToVisibleDiv = ({
  container,
  element,
  scrollingDown,
}) => {
  const offsetParentRect = container.offsetParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  return scrollingDown
    ? offsetParentRect.top - elementRect.bottom
    : elementRect.top - offsetParentRect.bottom;
};

const updatePosition = ({
  container,
  containerPositionRef,
  deltaY,
  scrollingDown,
}) => {
  const top = currentTop(container);
  const bottom = currentBottom(container);

  if (scrollingDown && bottom > 0) return;
  if (!scrollingDown && top > 0) return;

  if (bottom + deltaY > 0) {
    deltaY = -bottom;
  }
  const newTop = Math.min(0, top - deltaY);

  containerPositionRef.current = { top: `${newTop}px` };
  container.style.cssText = `bottom: ${null}; top: ${newTop}px;`;
};

const finishUpdate = ({
  performingAction,
  container,
  containerPositionRef,
}) => {
  const { style } = container;

  if (style.bottom) anchorToTop({ container, containerPositionRef });

  const top = currentTop(container);
  const bottom = currentBottom(container);

  if (top > 0 || container.offsetHeight < container.offsetParent.offsetHeight) {
    containerPositionRef.current = { top: '0px' };
    applyStyles({ container, containerPositionRef });
  } else if (bottom > 0 && top < 0) {
    containerPositionRef.current = { bottom: '0px' };
    applyStyles({ container, containerPositionRef });
    anchorToTop({ container, containerPositionRef });
  }
  performingAction.current = null;
};

const anchorToTop = ({ container, containerPositionRef }) => {
  const newTop = `${currentTop(container)}px`;
  container.style.cssText = `top: ${newTop}; bottom: ${null};`;
  containerPositionRef.current = { top: newTop };
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
