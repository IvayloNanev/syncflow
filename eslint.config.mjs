import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [{ignores:["app/.well-known/workflow/**",".workflow-vitest/**",".workflow-data/**"]}, ...nextVitals, ...nextTypeScript];

export default eslintConfig;
