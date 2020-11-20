/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable react/destructuring-assignment */

import React, { useCallback, useState, useRef, useEffect } from 'react';

const NUM_ELEMENTS_INITIAL = 10;
const EXTRA_WINDOW_SPACE = 500;

export const ReactWindow = ({ children }) => {
  const {
    startIndex,
    endIndex,
    containerRef,
    containerStyle,
    onWheel,
  } = useVirtualization(children.length);

  return (
    <div
      style={{
        position: 'relative',
        minWidth: '100px',
        minHeight: '100px',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      onWheel={onWheel}
    >
      <div ref={containerRef} style={containerStyle}>
        {children.slice(startIndex, endIndex)}
      </div>
    </div>
  );
};

export const useVirtualization = (childrenLength) => {
  const [state, setState] = useState({
    startIndex: 0,
    endIndex: NUM_ELEMENTS_INITIAL,
    containerPosition: { top: '0px' },
  });
  const { startIndex, endIndex, containerPosition } = state;
  const containerRef = useRef();
  const stateRef = useRef();
  stateRef.current = { ...state, childrenLength };
  const isUpdatingStateRef = useRef(false);

  const onWheel = useCallback(
    (e) => {
      handleWeel({
        e,
        container: containerRef.current,
        state: stateRef.current,
        setState,
        isUpdatingStateRef,
      });
    },
    [containerRef, stateRef]
  );

  useEffect(() => {
    anchorToTop({
      isUpdatingStateRef,
      container: containerRef.current,
      state,
      setState,
    });
  }, [state]);

  return {
    startIndex,
    endIndex,
    containerRef,
    containerStyle: {
      position: 'absolute',
      width: '100%',
      ...containerPosition,
    },
    onWheel,
  };
};

const handleWeel = ({ e, container, state, setState, isUpdatingStateRef }) => {
  e.stopPropagation();
  if (isUpdatingStateRef.current) return;

  const { deltaY } = e;
  const scrollingDown = deltaY > 0;

  updatePosition({ container, deltaY, scrollingDown });

  if (scrollingDown) {
    handleScrollDown({ container, state, setState, isUpdatingStateRef });
  } else {
    handleScrollUp({ container, state, setState, isUpdatingStateRef });
  }
};

const handleScrollDown = ({
  container,
  state,
  setState,
  isUpdatingStateRef,
}) => {
  if (state.endIndex === state.childrenLength - 1) return;

  if (currentBottom(container) > -EXTRA_WINDOW_SPACE) {
    const {
      newStartIndex,
      newEndIndex,
      heightOfRemovedElements,
    } = calculateNewIndexes({
      state,
      container,
      scrollingDown: true,
    });

    const newTop = currentTop(container) + heightOfRemovedElements;

    setState({
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      containerPosition: { top: `${newTop}px` },
    });
    // eslint-disable-next-line no-param-reassign
    isUpdatingStateRef.current = true;
  }
};

const handleScrollUp = ({ container, state, setState, isUpdatingStateRef }) => {
  if (state.startIndex === 0) return;

  if (currentTop(container) > -EXTRA_WINDOW_SPACE) {
    const {
      newStartIndex,
      newEndIndex,
      heightOfRemovedElements,
    } = calculateNewIndexes({
      state,
      container,
      scrollingDown: false,
    });

    const newBottom = currentBottom(container) + heightOfRemovedElements;

    setState({
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      containerPosition: { bottom: `${newBottom}px` },
    });
    // eslint-disable-next-line no-param-reassign
    isUpdatingStateRef.current = true;
  }
};

const updatePosition = ({ container, deltaY, scrollingDown }) => {
  const top = currentTop(container);
  const bottom = currentBottom(container);

  if (scrollingDown && bottom > 0) return;
  if (!scrollingDown && top > 0) return;

  const { style } = container;

  if (style.top) {
    if (bottom + deltaY > 0) {
      // eslint-disable-next-line no-param-reassign
      deltaY = -bottom;
    }
    const newTop = Math.min(0, top - deltaY);
    style.top = `${newTop}px`;
  }
};

const calculateNewIndexes = ({ state, container, scrollingDown }) => {
  const elements = container.children;

  const {
    numElementsToRemove,
    heightOfRemovedElements,
  } = calculateElementsToRemove({
    elements,
    container,
    scrollingDown,
  });

  let newStartIndex = state.startIndex;
  let newEndIndex = state.endIndex;
  const numElementsToAdd = 1; // If the elements are small we should add more than 1

  if (scrollingDown) {
    newStartIndex += numElementsToRemove;
    newEndIndex = Math.min(
      state.childrenLength - 1,
      newEndIndex + numElementsToAdd
    );
  } else {
    newStartIndex = Math.max(0, newStartIndex - numElementsToAdd);
    newEndIndex -= numElementsToRemove;
  }

  return {
    newStartIndex,
    newEndIndex,
    heightOfRemovedElements,
  };
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
  const offsetParentRect = container.offsetParent.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const distanceFromElementToVisibleDiv = scrollingDown
    ? offsetParentRect.top - elementRect.bottom
    : elementRect.top - offsetParentRect.bottom;

  return distanceFromElementToVisibleDiv > EXTRA_WINDOW_SPACE;
};

const anchorToTop = ({ isUpdatingStateRef, container, state, setState }) => {
  if (!isUpdatingStateRef.current) return;

  const { style } = container;
  if (style.bottom) {
    const newTop = currentTop(container);
    setState({
      ...state,
      containerPosition: { top: `${newTop}px` },
    });
  } else {
    // eslint-disable-next-line no-param-reassign
    isUpdatingStateRef.current = false;
  }
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
