# slate-react (HappyScribe fork)

Fork of `slate-react` from [slate v0.57.1](https://github.com/ianstormtaylor/slate/commit/22d9095c39a0e201878e1df04ef5e35d4d86a596) with HappyScribe-specific customizations.

## Setup from scratch

```bash
# Clone upstream slate at v0.57.1
git clone https://github.com/ianstormtaylor/slate.git slate-build
cd slate-build
git checkout 22d9095c39a0e201878e1df04ef5e35d4d86a596

# Replace slate-react with our fork
rm -rf packages/slate-react
git clone git@github.com:happyscribe/slate-react.git packages/slate-react

# Install dependencies
yarn install

# Start dev (watches for changes)
yarn start

# Build dist files (required before deploying)
# NOTE: Node 18+ requires the legacy OpenSSL flag
NODE_OPTIONS=--openssl-legacy-provider yarn build
```

## Deploy

```bash
# Build all packages from the slate monorepo root
cd slate-build
NODE_OPTIONS=--openssl-legacy-provider yarn build

# Bump version, commit, and push from the fork directory
cd packages/slate-react
npm version [patch | minor | major]
git push && git push --tags
```

Then in `hs-monorepo`:
1. Update the commit hash in `package.json` (`"slate-react": "git+https://github.com/happyscribe/slate-react.git#<new-hash>"`)
2. Run `yarn`

## What this fork changes

All changes are in `src/components/` — the fork customizes three files:

### 1. Custom copy/paste with timestamps ([`src/components/editable.tsx`](src/components/editable.tsx) — `setFragmentData`)

Commits: [`dc0b756`](https://github.com/happyscribe/slate-react/commit/dc0b756), [`b7fc595`](https://github.com/happyscribe/slate-react/commit/b7fc595), [`f373e1c`](https://github.com/happyscribe/slate-react/commit/f373e1c), [`87498ca`](https://github.com/happyscribe/slate-react/commit/87498ca)

Overrides the default clipboard behavior in `setFragmentData`. When copying, the editor calls `editor.getFormattedSelection()` and `editor.getHTMLFormattedSelection()` (injected by the consuming app) to produce clean plain-text and HTML without word-level timestamps. Falls back to the default `application/x-slate-fragment` encoding if those methods aren't available.

### 2. RTL (right-to-left) cursor movement ([`src/components/editable.tsx`](src/components/editable.tsx) — `onKeyDown`)

Commits: [`d627880`](https://github.com/happyscribe/slate-react/commit/d627880), [`efd05e6`](https://github.com/happyscribe/slate-react/commit/efd05e6)

Fixes cursor movement for RTL languages (Arabic, Hebrew, etc.). Detects text direction via the `direction` package and adjusts `Transforms.move` calls so that arrow keys, word-jump shortcuts, and backspace behave correctly regardless of text direction. Includes a hack for positioning the cursor at the end of the previous text node when `anchor.offset === 1`.

### 3. Virtual windowing support ([`src/components/children.tsx`](src/components/children.tsx), [`src/components/editable.tsx`](src/components/editable.tsx), [`src/components/element.tsx`](src/components/element.tsx))

Commits: [`c3f2c08`](https://github.com/happyscribe/slate-react/commit/c3f2c08), [`5465fe8`](https://github.com/happyscribe/slate-react/commit/5465fe8), [`be659f7`](https://github.com/happyscribe/slate-react/commit/be659f7), [`f09a840`](https://github.com/happyscribe/slate-react/commit/f09a840)

Adds optional `ReactHappyWindow` and `reactHappyWindowProps` props to `Editable`. When provided, children are rendered through a virtual windowing component instead of the default flat list, enabling performant rendering of very long transcriptions. Also passes `elementIndex` to each element for the windowing component to use.

### 4. Null-safety guard on `beforeInput` range ([`src/components/editable.tsx`](src/components/editable.tsx))

Commit: [`77ef1b3`](https://github.com/happyscribe/slate-react/commit/77ef1b3)

Adds an early return when `ReactEditor.toSlateRange` returns a falsy value during `beforeInput` handling, preventing a crash when the target range can't be resolved.

### 5. `contentEditable` removed from root element ([`src/components/editable.tsx`](src/components/editable.tsx))

Commit: [`878fbcd`](https://github.com/happyscribe/slate-react/commit/878fbcd)

The `contentEditable={readOnly ? undefined : true}` attribute was removed from the root `<div>`. The consuming app is expected to set this attribute explicitly via the `happyWindowRef` or wrapper.

### 6. Decorations disabled for performance ([`src/components/children.tsx`](src/components/children.tsx))

Commit: [`c3f2c08`](https://github.com/happyscribe/slate-react/commit/c3f2c08)

The `decorate` function call and decoration intersection loop are commented out in `Children` to improve rendering performance. HappyScribe does not use Slate decorations.
