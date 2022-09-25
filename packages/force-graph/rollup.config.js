import resolve from "@rollup/plugin-node-resolve";
import commonJs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import postCss from "rollup-plugin-postcss";
import { terser } from "rollup-plugin-terser";
import dts from "rollup-plugin-dts";
import { name, homepage, version, dependencies } from "./package.json";

const umdConf = {
  format: "umd",
  name: "ForceGraph",
  banner: `// Version ${version} ${name} - ${homepage}`,
};

export const umdConfig = {
  // UMD
  input: "src/index.js",
  output: [
    {
      ...umdConf,
      file: `dist/${name}.js`,
      sourcemap: true,
    },
    {
      // minify
      ...umdConf,
      file: `dist/${name}.min.js`,
      plugins: [
        terser({
          output: { comments: "/Version/" },
        }),
      ],
    },
  ],
  plugins: [postCss({ plugins: [] }), babel({ exclude: "node_modules/**" }), resolve(), commonJs()],
};

export const cjsAndEsm = {
  // commonJs and ES modules
  input: "src/index.js",
  output: [
    {
      format: "cjs",
      file: `dist/${name}.common.js`,
      exports: "auto",
    },
    {
      format: "es",
      file: `dist/${name}.module.js`,
    },
  ],
  external: Object.keys(dependencies || {}),
  plugins: [postCss({ plugins: [] }), babel()],
};

export default [
  umdConfig,
  cjsAndEsm,
  {
    // expose TS declarations
    input: "src/index.d.ts",
    output: [
      {
        file: `dist/${name}.d.ts`,
        format: "es",
      },
    ],
    plugins: [dts()],
  },
];
