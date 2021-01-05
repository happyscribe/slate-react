To run locally:
1. Clone the version v0.57.1 of the slate repo: https://github.com/ianstormtaylor/slate/commit/22d9095c39a0e201878e1df04ef5e35d4d86a596
2. cd slate/packages and remove slate-react
3. Pull this repo in slate/packages
4. cd slate && yarn start

To deploy:
1. cd slate && yarn build
2. cd packages/slate-react
3. npm version [patch | minor ...] && git push
4. Update the commit hash in hs-editor/package.json
5. cd hs-monorepo && yarn
