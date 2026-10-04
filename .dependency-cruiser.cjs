/**
 * Layer rules (anti-clunk rule 1): calls run downward only.
 *   apps  ->  packages
 *   packages  ->  other packages, never apps
 *   services  ->  packages, never apps
 *   contracts  ->  nothing internal (it is the source of truth)
 */
module.exports = {
  forbidden: [
    {
      name: "no-unresolvable",
      comment: "Every import must resolve, otherwise the rules below cannot see it.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
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
      name: "services-never-import-apps",
      severity: "error",
      from: { path: "^services/" },
      to: { path: "^apps/" },
    },
    {
      name: "apps-never-import-services",
      comment: "The Studio talks to services through the database, never by importing them.",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^services/" },
    },
    {
      name: "supabase-stays-behind-its-seam",
      comment: "Decision 0003: Supabase client code lives only in the Studio's supabase adapter, middleware and auth callback.",
      severity: "error",
      from: { pathNot: "^apps/studio/src/(lib/supabase/|middleware\\.ts$|app/auth/)" },
      to: { path: "node_modules/@supabase/" },
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
      from: { path: "^(apps|packages|services)/([^/]+)/" },
      to: { path: "^packages/[^/]+/src/(?!index\\.ts$)", pathNot: "^packages/$2/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // node_modules stays visible (not followed) so rules about outside packages can fire.
    exclude: { path: "(^|/)\\.next/" },
    // Resolves the Studio's "@/" alias; extends the base config used everywhere else.
    tsConfig: { fileName: "tsconfig.depcruise.json" },
  },
};
