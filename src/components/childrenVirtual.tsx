import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Editor, Range, Element, NodeEntry, Ancestor, Descendant } from 'slate'

import ElementComponent from './element'
import TextComponent from './text'
import { ReactEditor } from '..'
import { useEditor } from '../hooks/use-editor'
import { NODE_TO_INDEX, NODE_TO_PARENT } from '../utils/weak-maps'
import { RenderElementProps, RenderLeafProps } from './editable'

/**
 * Children.
 */

const ChildrenVirtual = (props: {
  decorate: (entry: NodeEntry) => Range[]
  decorations: Range[]
  node: Ancestor
  renderElement?: (props: RenderElementProps) => JSX.Element
  renderLeaf?: (props: RenderLeafProps) => JSX.Element
  selection: Range | null
}) => {
  const {
    decorate,
    decorations,
    node,
    renderElement,
    renderLeaf,
    selection,
  } = props
  const editor = useEditor()
  const path = ReactEditor.findPath(editor, node)
  const children = []
  const isLeafBlock =
    Element.isElement(node) &&
    !editor.isInline(node) &&
    Editor.hasInlines(editor, node)

  const {
    startIndex,
    endIndex,
    containerRef,
    containerStyle,
    onWheel,
  } = useVirtualization(node.children.length)

  for (let i = startIndex; i <= endIndex; i++) {
    const p = path.concat(i)
    const n = node.children[i] as Descendant
    const key = ReactEditor.findKey(editor, n)
    const range = Editor.range(editor, p)
    const sel = selection && Range.intersection(range, selection)
    const ds = decorate([n, p])

    for (const dec of decorations) {
      const d = Range.intersection(dec, range)

      if (d) {
        ds.push(d)
      }
    }

    if (Element.isElement(n)) {
      children.push(
        <ElementComponent
          decorate={decorate}
          decorations={ds}
          element={n}
          key={key.id}
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          selection={sel}
          elementIndex={i}
        />
      )
    } else {
      children.push(
        <TextComponent
          decorations={ds}
          key={key.id}
          isLast={isLeafBlock && i === node.children.length - 1}
          parent={node}
          renderLeaf={renderLeaf}
          text={n}
        />
      )
    }

    NODE_TO_INDEX.set(n, i)
    NODE_TO_PARENT.set(n, node)
  }

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
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          width: '100%',
          ...containerStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default ChildrenVirtual

let updatingState = true

const NUM_ELEMENTS_RENDERED = 5
const EXTRA_WINDOW_SPACE = 500

const useVirtualization = (childrenLength: number) => {
  const [state, setState] = useState({
    startIndex: 0,
    endIndex: Math.min(NUM_ELEMENTS_RENDERED - 1, childrenLength-1),
    containerStyle: { top: '0px' },
  })
  const { startIndex, endIndex, containerStyle } = state
  const containerRef = useRef()
  const stateRef = useRef()
  stateRef.current = { ...state, childrenLength }
  window.containerRef = containerRef

  const onWheel = useCallback(
    e => {
      handleWeel({
        e,
        container: containerRef.current,
        state: stateRef.current,
        setState,
      })
    },
    [containerRef, stateRef]
  )

  useEffect(() => {
    if (updatingState) {
      anchorToTop({ container: containerRef.current, state, setState })
    }
  }, [state])


  return { startIndex, endIndex, containerRef, containerStyle, onWheel }
}

const handleWeel = ({ e, container, state, setState }) => {
  e.stopPropagation()
  if (updatingState) return

  const { deltaY } = e
  const scrollingDown = deltaY > 0

  updatePosition({ container, deltaY, scrollingDown })

  if (scrollingDown) {
    handleScrollDown({ container, state, setState, deltaY })
  } else {
    handleScrollUp({ container, state, setState, deltaY })
  }
}

const handleScrollDown = ({ container, state, setState }) => {
  if (state.endIndex === state.childrenLength - 1) return

  if (currentBottom(container) > -EXTRA_WINDOW_SPACE) {
    const {
      newStartIndex,
      newEndIndex,
      heightOfRemovedElements,
    } = calculateNewIndexes({
      state,
      container,
      scrollingDown: true,
    })

    const newTop = currentTop(container) + heightOfRemovedElements
    setState({
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      containerStyle: { top: `${newTop}px` },
    })
    updatingState = true
  }
}

const handleScrollUp = ({ container, state, setState }) => {
  if (state.startIndex === 0) return

  if (currentTop(container) > -EXTRA_WINDOW_SPACE) {
    const {
      newStartIndex,
      newEndIndex,
      heightOfRemovedElements,
    } = calculateNewIndexes({
      state,
      container,
      scrollingDown: false,
    })

    const newBottom = currentBottom(container) + heightOfRemovedElements

    setState({
      startIndex: newStartIndex,
      endIndex: newEndIndex,
      containerStyle: { bottom: `${newBottom}px` },
    })
    updatingState = true
  }
}

const updatePosition = ({ container, deltaY, scrollingDown }) => {
  const top = currentTop(container)
  const bottom = currentBottom(container)

  if (scrollingDown && bottom > 0) return

  if (!scrollingDown && top > 0) return

  const { style } = container

  if (style.top) {
    if (bottom + deltaY > 0) {
      // eslint-disable-next-line no-param-reassign
      deltaY = -bottom
    }
    const newTop = Math.min(0, top - deltaY)
    style.top = `${newTop}px`
  }

  if (style.bottom) {
    if (top - deltaY > 0) {
      // eslint-disable-next-line no-param-reassign
      deltaY = top
    }
    const newBottom = Math.min(0, bottom + deltaY)
    style.bottom = `${newBottom}px`
  }
}

const calculateNewIndexes = ({ state, container, scrollingDown }) => {
  const elements = container.children

  const numElementsToAdd = 1

  const {
    numElementsToRemove,
    heightOfRemovedElements,
  } = calculateElementsToRemove({
    elements,
    container,
    scrollingDown,
  })

  let newStartIndex = state.startIndex
  let newEndIndex = state.endIndex

  if (scrollingDown) {
    newStartIndex += numElementsToRemove
    newEndIndex = Math.min(
      state.childrenLength - 1,
      newEndIndex + numElementsToAdd
    )
  } else {
    newStartIndex = Math.max(0, newStartIndex - numElementsToAdd)
    newEndIndex -= numElementsToRemove
  }

  return {
    newStartIndex,
    newEndIndex,
    heightOfRemovedElements,
  }
}

const calculateElementsToRemove = ({ elements, container, scrollingDown }) => {
  let numElementsToRemove = 0
  let heightOfRemovedElements = 0

  if (scrollingDown) {
    for (let i = 0; i < elements.length; i += 1) {
      const element = elements[i]

      const distanceFromElementToVisibleDiv =
        container.offsetParent.getBoundingClientRect().top -
        element.getBoundingClientRect().bottom

      if (distanceFromElementToVisibleDiv > EXTRA_WINDOW_SPACE) {
        // Item will be removed
        numElementsToRemove += 1
        heightOfRemovedElements += element.offsetHeight
      } else {
        break
      }
    }
  } else {
    for (let i = elements.length - 1; i >= 0; i -= 1) {
      const element = elements[i]

      const distanceFromElementToVisibleDiv =
        element.getBoundingClientRect().top -
        container.offsetParent.getBoundingClientRect().bottom

      if (distanceFromElementToVisibleDiv > EXTRA_WINDOW_SPACE) {
        // Item will be removed
        numElementsToRemove += 1
        heightOfRemovedElements += element.offsetHeight
      } else {
        break
      }
    }
  }

  return { numElementsToRemove, heightOfRemovedElements }
}

const anchorToTop = ({ container, state, setState }) => {
  const { style } = container
  if (style.bottom) {
    const newTop = currentTop(container)
    setState({
      ...state,
      containerStyle: { top: `${newTop}px` },
    })
  } else {
    updatingState = false
  }
}

const currentTop = container => {
  return container.offsetTop
}

const currentBottom = container => {
  return (
    container.offsetParent.offsetHeight -
    container.offsetTop -
    container.offsetHeight
  )
}
