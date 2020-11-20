import React from 'react'
import { Editor, Range, Element, NodeEntry, Ancestor, Descendant } from 'slate'

import ElementComponent from './element'
import TextComponent from './text'
import { ReactEditor } from '..'
import { useEditor } from '../hooks/use-editor'
import { NODE_TO_INDEX, NODE_TO_PARENT } from '../utils/weak-maps'
import { RenderElementProps, RenderLeafProps } from './editable'
import { useVirtualization } from 'slate-react/src/components/ReactWindow'

/**
 * Children.
 */

const Children = (props: {
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

  const isRoot = path.length === 0

  const { startIndex, endIndex, containerRef, containerStyle, onWheel } = isRoot
    ? useVirtualization(node.children.length)
    : {
        startIndex: 0,
        endIndex: node.children.length - 1,
        containerRef: null,
        containerStyle: null,
        onWheel: null,
      }

  for (let i = startIndex; i <= endIndex; i++) {
    const p = path.concat(i)
    const n = node.children[i] as Descendant
    const key = ReactEditor.findKey(editor, n)
    const range = Editor.range(editor, p)
    const sel = selection && Range.intersection(range, selection)

    // Commented out for performance. We don't use decorations
    // const ds = decorate([n, p])
    const ds = [] as Range[]
    // for (const dec of decorations) {
    //   const d = Range.intersection(dec, range)

    //   if (d) {
    //     ds.push(d)
    //   }
    // }

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

  if (containerRef) {
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
          {children}
        </div>
      </div>
    )
  }
  return <React.Fragment>{children}</React.Fragment>
}

export default Children
