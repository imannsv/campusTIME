import { shouldIgnoreBuild } from "./site-config.mjs";
const ignored = shouldIgnoreBuild(process.env.VERCEL_GIT_COMMIT_REF);
console.log(
  ignored
    ? "Landingpage: Build außerhalb von landingpage übersprungen."
    : "Landingpage: Branch freigegeben.",
);
// Vercel's Ignored Build Step: 0 skips the build, 1 continues it.
process.exit(ignored ? 0 : 1);
