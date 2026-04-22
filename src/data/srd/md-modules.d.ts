/**
 * Ambient declaration so TypeScript treats esbuild's `text` loader imports of
 * `.md` files as plain strings. Without this, each `import foo from "./foo.md"`
 * resolves to `any`, which in turn triggers `@typescript-eslint/no-unsafe-*`
 * errors in the generated SRD MD index.
 */
declare module "*.md" {
  const content: string;
  export default content;
}
