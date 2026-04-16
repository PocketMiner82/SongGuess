import antfu from "@antfu/eslint-config";


export default antfu({
  jsonc: false,
  yaml: false,
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: true,
  },
  rules: {
    "no-console": "off",
    "no-alert": "warn",
    "jsdoc/check-param-names": "off",
    "regexp/no-super-linear-backtracking": "off",
    "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "import/newline-after-import": ["error", { count: 2 }],
    "style/no-multiple-empty-lines": ["error", { max: 2, maxEOF: 0, maxBOF: 0 }],
  },
});
