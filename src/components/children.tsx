import React from 'react'
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

const Children = (props: {
  decorate: (entry: NodeEntry) => Range[]
  decorations: Range[]
  node: Ancestor
  renderElement?: (props: RenderElementProps) => JSX.Element
  renderLeaf?: (props: RenderLeafProps) => JSX.Element
  selection: Range | null
  ReactHappyWindow: React.Component | undefined
  reactHappyWindowProps: Object | undefined
}) => {
  const {
    decorate,
    decorations,
    node,
    renderElement,
    renderLeaf,
    selection,
    ReactHappyWindow,
    reactHappyWindowProps = {},
  } = props
  const editor = useEditor()
  const path = ReactEditor.findPath(editor, node)
  const children = []
  const isLeafBlock =
    Element.isElement(node) &&
    !editor.isInline(node) &&
    Editor.hasInlines(editor, node)

  const renderChild = (i: number) => {
    const p = path.concat(i)
    const n = node.children[i] as Descendant
    const key = ReactEditor.findKey(editor, n)
    const range = Editor.range(editor, p)
    const sel = selection && Range.intersection(range, selection)

    // Commented out to improve performance. We don't use decorations
    // const ds = decorate([n, p])
    const ds = [] as Range[]
    // for (const dec of decorations) {
    //   const d = Range.intersection(dec, range)

    //   if (d) {
    //     ds.push(d)
    //   }
    // }

    NODE_TO_INDEX.set(n, i)
    NODE_TO_PARENT.set(n, node)

    if (Element.isElement(n)) {
      return (
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
      return (
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
  }

  if (ReactHappyWindow) {
    return (
      <ReactHappyWindow
        itemCount={node.children.length}
        renderItem={renderChild}
        {...reactHappyWindowProps}
      />
    )
  }

  for (let i = 0; i < node.children.length; i++) {
    children.push(renderChild(i))
  }

  return <React.Fragment>{children}</React.Fragment>
}

export default Children
