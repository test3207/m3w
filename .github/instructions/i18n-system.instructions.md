# i18n System Instruction

## Overview

M3W uses a custom Proxy-based internationalization system designed for type safety, reactive language switching, and developer experience. This is **not** next-intl or any third-party i18n library—it's a custom implementation tailored to our architecture requirements.

## Architecture Principles

- **Proxy-based Property Access**: Use `I18n.category.key` syntax instead of function calls
- **Full Type Safety**: Auto-generated TypeScript definitions with JSDoc comments
- **Reactive Updates**: Event-driven language switching without page refresh
- **Build Integration**: Automatic type generation during development and production builds
- **Source of Truth**: English JSON file drives all type generation
- **Smart Merging**: Preserves existing translations while adding new keys

## File Structure

```
src/locales/
├── messages/
│   ├── en.json                   # Source of truth (218+ keys)
│   └── zh-CN.json                # Chinese translations
├── generated/
│   └── types.d.ts                # Auto-generated TypeScript types
├── i18n.ts                       # Proxy runtime with event system
└── use-locale.ts                 # React hook for component reactivity

scripts/
├── build-i18n.js                 # Type generation and translation merging
└── watch-i18n.js                 # Development hot reload
```

## Core Components

### 1. Message Storage (`src/locales/messages/en.json`)

**Structure:**
```json
{
  "error": {
    "unauthorized": "You must be signed in",
    "notFound": "Resource not found"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back"
  },
  "library": {
    "create": "Create Library",
    "delete": "Delete Library"
  }
}
```

**Rules:**
- Nested structure for categorization
- English is the default and fallback language
- Keys use camelCase
- Messages are plain strings (no interpolation syntax)
- This file is the single source of truth for all text

### 2. Proxy Runtime (`src/locales/i18n.ts`)

**Key Functions:**
- `registerMessages(locale, messages)` - Store messages for a locale
- `setLocale(locale)` - Change language and notify listeners
- `getLocale()` - Get current language
- `onLocaleChange(callback)` - Subscribe to language changes
- `I18n` - Proxy object for accessing messages

**Usage:**
```typescript
import { I18n, setLocale, getLocale, onLocaleChange } from '@/locales/i18n';

// Access messages
const title = I18n.dashboard.title;

// Change language
setLocale('zh-CN');

// Get current language
const current = getLocale();

// Subscribe to changes
const unsubscribe = onLocaleChange(() => {
  console.log('Language changed');
});
```

### 3. React Hook (`src/locales/use-locale.ts`)

**Purpose:** Trigger component re-render when locale changes

**Architecture Note:** Since v0.1.1, `useLocale()` is called once at the root level in `LocaleProvider` (see `src/components/providers/locale-provider.tsx`). Individual components **no longer need** to call `useLocale()` - the root provider handles locale reactivity for the entire component tree.

**Implementation:**
```typescript
// src/components/providers/locale-provider.tsx
import { useLocale } from '@/locales/use-locale';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  useLocale(); // Single subscription at root level
  return <>{children}</>;
}
```

**Rules:**
- Do NOT call `useLocale()` in individual components - it's handled at root level
- The `LocaleProvider` wraps the entire app in `main.tsx`
- When locale changes, the entire component tree re-renders automatically

### 4. Build Script (`scripts/build-i18n.js`)

**Responsibilities:**
- Read `en.json` and generate TypeScript interface
- Add JSDoc comments with English text for hover hints
- Merge translations from other language files
- Preserve existing translations while adding new keys with English fallback
- Output `types.d.ts` and updated language files

**Execution:**
- Automatically runs on `npm run dev` (predev hook)
- Automatically runs on `npm run build` (prebuild hook)
- Manually via `npm run i18n:build`

### 5. Watch Script (`scripts/watch-i18n.js`)

**Purpose:** Auto-rebuild types when `en.json` changes during development

**Usage:**
- Runs alongside Next.js dev server via `concurrently`
- Monitors `src/locales/messages/en.json`
- Debounces with `isBuilding` flag to prevent concurrent builds

## Usage Patterns

### Client Components

```typescript
import { I18n } from '@/locales/i18n';

export default function DashboardPage() {
  // No need to call useLocale() - handled by LocaleProvider at root level
  return (
    <div>
      <h1>{I18n.dashboard.title}</h1>
      <p>{I18n.dashboard.welcome}</p>
    </div>
  );
}
```

**Rules:**
- Only import `I18n` (useLocale is handled at root level by LocaleProvider)
- Access messages via `I18n.category.key`
- Add `suppressHydrationWarning` to elements containing i18n text if needed

### API Routes

```typescript
import { I18n } from '@/locales/i18n';

export async function POST() {
  if (!authorized) {
    return NextResponse.json(
      { error: I18n.error.unauthorized },
      { status: 401 }
    );
  }
}
```

**Rules:**
- Only import `I18n` (no `useLocale` needed)
- Access messages via `I18n.category.key`

### Server Actions

```typescript
'use server';

import { I18n } from '@/locales/i18n';

export async function createLibrary(data: FormData) {
  try {
    // ... business logic
    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create library'
    };
  }
}
```

**Rules:**
- Import `I18n` only
- Return `{ success, data? }` or `{ success: false, error }` shape
- Error messages in English (for future i18n)
- Let client components handle toast display with localized text

### Language Switcher

```typescript
import { setLocale } from '@/locales/i18n';

export function LanguageSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuItem onClick={() => setLocale('en')}>
        English
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setLocale('zh-CN')}>
        简体中文
      </DropdownMenuItem>
    </DropdownMenu>
  );
}
```

**Rules:**
- Call `setLocale(locale)` on user selection
- No page refresh needed
- All components with `useLocale()` will re-render automatically

## Adding New Text

### Step-by-Step Process

1. **Add to English Source:**
   ```json
   // src/locales/messages/en.json
   {
     "playlist": {
       "addSong": "Add Song",
       "removeSong": "Remove Song"
     }
   }
   ```

2. **Build Types:**
   - Automatically on next `npm run dev`
   - Or manually: `npm run i18n:build`

3. **Add Translations (optional):**
   ```json
   // src/locales/messages/zh-CN.json
   {
     "playlist": {
       "addSong": "添加歌曲",
       "removeSong": "移除歌曲"
     }
   }
   ```

4. **Use in Code:**
   ```typescript
   import { I18n } from '@/locales/i18n';
   
   const buttonText = I18n.playlist.addSong;
   ```

5. **TypeScript Validation:**
   - Full autocomplete in IDE
   - Hover shows English text
   - Type errors if key doesn't exist

## TypeScript Integration

### Generated Types

The build script generates:

```typescript
// src/locales/generated/types.d.ts
export interface I18nMessages {
  dashboard: {
    /** Dashboard */
    title: string;
    /** Welcome back */
    welcome: string;
  };
  library: {
    /** Create Library */
    create: string;
  };
}
```

### Benefits

- **Autocomplete**: IDE suggests all available keys
- **Type Safety**: Compiler catches typos and missing keys
- **Hover Hints**: JSDoc shows English text without opening files
- **Refactoring**: Safe renaming across codebase

## Architecture Decisions

### Full CSR Approach

**Decision:** Root layout marked `'use client'` for full client-side rendering

**Rationale:**
- Avoids SSR hydration mismatches
- Ensures consistent state between server and client
- Simplifies language switching logic
- No localStorage persistence (reserved for future database-backed approach)

**Trade-offs:**
- No SEO benefits for i18n text (acceptable for authenticated dashboard)
- Initial render always in English (consistent experience)

### Event-Driven Updates

**Decision:** Use event listeners instead of Context API or global state

**Rationale:**
- Lightweight and performant
- No provider tree needed
- Components opt-in via `useLocale()` hook
- Unsubscribe on unmount prevents memory leaks

**Implementation:**
```typescript
// Listener set
const localeChangeListeners = new Set<() => void>();

// Notify on change
function setLocale(locale: string) {
  currentLocale = locale;
  localeChangeListeners.forEach(listener => listener());
}

// Subscribe
function onLocaleChange(callback: () => void) {
  localeChangeListeners.add(callback);
  return () => localeChangeListeners.delete(callback);
}
```

### No Interpolation

**Decision:** Messages are plain strings without variable interpolation

**Current State:**
```typescript
// Not supported
I18n.welcome.message("John") // ❌

// Use string concatenation or template literals
`${I18n.welcome.prefix} John` // ✅
```

**Future Enhancement:** May add interpolation support if needed

## Common Patterns

### Conditional Text

```typescript
const status = isActive ? I18n.status.active : I18n.status.inactive;
```

### Array Mapping

```typescript
const tabs = [
  { label: I18n.tabs.overview, value: 'overview' },
  { label: I18n.tabs.settings, value: 'settings' },
];
```

### Error Handling

```typescript
try {
  await action();
  toast.success(I18n.success.saved);
} catch (error) {
  toast.error(I18n.error.saveFailed);
}
```

### Form Labels

```typescript
<Label htmlFor="name">{I18n.form.name}</Label>
<Input id="name" placeholder={I18n.form.namePlaceholder} />
```

## Troubleshooting

### Issue: Types Not Updating

**Solution:**
```bash
npm run i18n:build
```

### Issue: Hydration Errors

**Solution:** Add `suppressHydrationWarning` to i18n text elements:
```typescript
<span suppressHydrationWarning>{I18n.dashboard.title}</span>
```

### Issue: Component Not Re-rendering on Language Change

**Note:** This should not happen with the current architecture since `LocaleProvider` handles all locale reactivity at the root level. If you encounter this issue, verify that:
1. `LocaleProvider` is wrapping the component tree in `main.tsx`
2. The `I18n.category.key` syntax is being used (not a cached value)

### Issue: Missing Translation

**Check:**
1. Key exists in `en.json`
2. Build script ran successfully
3. Import statement is correct
4. TypeScript server restarted (reload window)

## Best Practices

### DO:
- ✅ Add all new text to `en.json` first
- ✅ Keep messages short and descriptive
- ✅ Organize by feature/domain in nested structure
- ✅ Run `npm run i18n:build` after batch edits

### DON'T:
- ❌ Hardcode user-facing text
- ❌ Edit `types.d.ts` manually (auto-generated)
- ❌ Call `useLocale()` in individual components (handled by LocaleProvider)
- ❌ Call `setLocale()` on every render
- ❌ Create separate i18n stores or contexts

## Migration Checklist

When migrating existing code:

- [ ] Replace hardcoded strings with `I18n.category.key`
- [ ] Add keys to `en.json` if missing
- [ ] Remove old i18n imports (if any)
- [ ] Test language switching
- [ ] Verify TypeScript compilation

## Future Enhancements

### Planned:
- Database-backed user language preference
- Language detection from browser settings
- Interpolation support for dynamic values
- Pluralization rules
- Date/time formatting helpers

### Not Planned:
- RTL (right-to-left) support (not required for current languages)
- Server-side rendering of i18n text (CSR approach chosen)
- localStorage persistence (prefer database approach)

## References

- Implementation: `src/locales/i18n.ts`
- React Hook: `src/locales/use-locale.ts`
- Build Script: `scripts/build-i18n.js`
- Watch Script: `scripts/watch-i18n.js`
- Example Usage: `src/components/layouts/language-switcher.tsx`
