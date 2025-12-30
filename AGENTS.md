# AGENTS.md

## Build/Lint/Test Commands
- **Build**: `npm run build` (Vite production build)
- **Dev Server**: `npm run dev` (starts Vite dev server on localhost:5173)
- **Preview**: `npm run preview` (preview built app)
- **No lint/test scripts available** - codebase lacks linting/testing setup. For single tests, none configured.

## Code Style Guidelines
- **Language**: TypeScript React with Vite
- **Components**: Functional components with hooks (useState, etc.)
- **Imports**: Group React, third-party (e.g., lucide-react), then local
- **Formatting**: No semicolons, 2-space indentation, double quotes for JSX
- **Types**: Use TypeScript interfaces for props/state; avoid `any` where possible
- **Naming**: camelCase for variables/functions, PascalCase for components, UPPER_CASE for constants
- **Error Handling**: try/catch for async operations, set error state for UI feedback
- **State Management**: React hooks only; keep components simple
- **Styling**: Tailwind CSS classes in JSX
- **Commits**: Descriptive messages; one feature per commit
- **No Cursor/Copilot rules found** in .cursor/ or .github/