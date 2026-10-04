/**
 * Layer rules (anti-clunk rule 1): calls run downward only.
 *   apps  ->  packages
 *   packages  ->  other packages, never apps
 *   contracts  ->  nothing internal (it is the source of truth)
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-never-import-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "contracts-stay-pure",
      comment: "packages/contracts is the source of truth and depends on nothing internal.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: { path: "^(apps|packages/(?!contracts))" },
    },
    {
      name: "no-deep-imports-across-packages",
      comment: "Import a package through its entry point, never its internals.",
      severity: "error",
      from: { path: "^(apps|packages)/([^/]+)/" },
      to: { path: "^packages/[^/]+/src/(?!index\\.ts$)", pathNot: "^packages/$2/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(node_modules|\\.next|dist)" },
    tsConfig: { fileName: "tsconfig.base.json" },
  },
};
