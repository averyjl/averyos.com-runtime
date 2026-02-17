# Truthforce Pages Content

This directory contains markdown content files for the Truthforce Pages on AveryOS.com.

## Structure

Each Truthforce page has a corresponding markdown file in this directory. The structure follows the route hierarchy:

```
content/
├── auditlog/
│   └── Truthforce2026_Public.md
├── viewer/
│   └── truthdeck-ui.md
├── capsule/
│   └── resonance-log.md
├── vault/
│   └── ledger-archive.md
├── creator-lock.md
├── capsuleecho/
│   └── how-it-works.md
├── retroclaim/
│   └── how-to-license.md
├── faq/
│   └── truthforce.md
└── timeline/
    └── suppression-burn.md
```

## Adding New Content

To add a new Truthforce page:

1. **Create the markdown file** in the appropriate directory under `/content/`
   ```bash
   mkdir -p content/category
   touch content/category/page-name.md
   ```

2. **Create the corresponding page component** under `/pages/`
   ```tsx
   import type { GetStaticProps, NextPage } from "next";
   import TruthforcePage from "../../components/TruthforcePage";
   import { loadMarkdownAsHtml } from "../../lib/markdown";

   type PageProps = {
     content: string;
   };

   const YourPage: NextPage<PageProps> = ({ content }) => {
     return (
       <TruthforcePage
         title="Your Page Title"
         route="category/page-name"
         content={content}
         enableCapsuleEcho={true}
         injectGlyph={true}
         enforcePerspectiveLock={true}
       />
     );
   };

   export const getStaticProps: GetStaticProps<PageProps> = async () => {
     const content = loadMarkdownAsHtml("category/page-name.md");
     return {
       props: { content },
     };
   };

   export default YourPage;
   ```

3. **Build and test**
   ```bash
   npm run build
   npm run dev
   ```

## Markdown Features

All markdown files support:
- Standard markdown syntax (headings, lists, links, etc.)
- Code blocks with syntax highlighting
- Tables
- Blockquotes
- Inline HTML (use sparingly)

## Content Guidelines

Each Truthforce page should include:
- Clear heading structure
- Concise, informative content
- The CapsuleEcho/Glyph/PerspectiveLock indicators at the top (⛓️⚓)
- Links to related documentation
- Footer attribution

## Deployment

Truthforce Pages are automatically deployed via GitHub Pages when changes are committed to the main branch. The Next.js build process converts markdown to static HTML for optimal performance.

## Related Documentation

- `/components/TruthforcePage.tsx` - Reusable page template component
- `/lib/markdown.ts` - Markdown processing utilities
- `/pages/` - Page components that render the content
