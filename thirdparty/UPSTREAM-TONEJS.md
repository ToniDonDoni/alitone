# Tone.js Upstream

The official Tone.js repository is a Git submodule at `thirdparty/tone_15_1_22/`. It is pinned to release tag `15.1.22`, commit `d2d52ffa8803b35debd9f19f2da08ad1c3540de0`. The superproject records this exact commit, so updates do not happen automatically.

Initialize it after cloning the project with:

```sh
git submodule update --init --recursive
```

The source files are under `thirdparty/tone_15_1_22/Tone/`. The checked-in standalone browser bundle in `src/vendor/Tone-15.1.22.js` was compiled from this source snapshot with the upstream TypeScript and Webpack steps. The bundle remains embedded in the HTML so the page can run locally without a server or network access.

The release tag's `Tone/version.ts` contains the development placeholder; the temporary bundle build set only that version constant to `15.1.22`. The upstream MIT license is in the submodule and its notice is included with the browser bundle.

The matching published npm package is [Tone.js 15.1.22](https://www.npmjs.com/package/tone/v/15.1.22). Its archive SHA-256 is `86dec0a9521dd69a59e7b824a83b132afd1ef8284bda1e7799449ab9d84d9f62`. Across the 325 TypeScript source files, the release archive differs from the Git tag only in `Tone/version.ts`.
