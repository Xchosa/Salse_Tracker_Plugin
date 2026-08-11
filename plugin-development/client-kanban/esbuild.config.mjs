import esbuild from "esbuild";
import builtinModules from "builtin-modules";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtinModules],
  outfile: "main.js",
  format: "cjs",
  platform: "node",
  sourcemap: production ? false : "inline",
  minify: production,
  treeShaking: true,
  logLevel: "info"
});
