import fs from 'fs'
import path from 'path'

// `src/assets/css/index.css` imports HeroUI's per-component stylesheets by hand instead of pulling
// in the whole 410 KB package, because that stylesheet was the page's only render-blocking request
// and ~94% of its bytes. The saving is real but the arrangement is fragile in one specific way:
// importing a new HeroUI component ships its JavaScript and renders its markup, and nothing about
// that fails if its CSS is missing — the component just quietly renders unstyled in production.
//
// This test closes that gap. It reads what the app imports from '@heroui/react', looks each
// component up below, and fails if the matching stylesheet isn't in index.css. A component with no
// entry at all fails too, so a newly-imported one can't slip through by being unrecognized.
const STYLESHEETS_BY_COMPONENT: Record<string, string[]> = {
  Alert: ['alert'],
  AlertDescription: ['alert', 'description'],
  AlertDialog: ['alert-dialog', 'modal'],
  AlertRoot: ['alert'],
  Button: ['button'],
  Calendar: ['calendar', 'calendar-year-picker'],
  CloseButton: ['close-button'],
  Dropdown: ['dropdown', 'menu', 'menu-item', 'popover'],
  FieldError: ['field-error'],
  Header: ['header'],
  Input: ['input'],
  Label: ['label'],
  Menu: ['menu', 'menu-item', 'menu-section'],
  Modal: ['modal'],
  PopoverContent: ['popover'],
  PopoverDialog: ['popover'],
  Radio: ['radio'],
  RadioGroup: ['radio-group', 'radio'],
  Separator: ['separator'],
  Spinner: ['spinner'],
  TextField: ['textfield', 'input', 'label'],
  ToastProvider: ['toast', 'close-button'],
}

const SRC_DIR = path.join(process.cwd(), 'src')
const CSS_PATH = path.join(SRC_DIR, 'assets/css/index.css')

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })

const importedComponents = (): string[] => {
  const names = sourceFiles(SRC_DIR).flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*'@heroui\/react'/g)].flatMap((match) =>
      match[1].split(',').map((name) => name.trim()),
    ),
  )
  return [...new Set(names.filter(Boolean))].sort()
}

const importedStylesheets = (): string[] =>
  [...fs.readFileSync(CSS_PATH, 'utf8').matchAll(/@heroui\/styles\/components\/([a-z-]+)\.css/g)].map(
    (match) => match[1],
  )

describe('HeroUI stylesheet imports', () => {
  it('imports the app from @heroui/react at all, so the checks below are not vacuous', () => {
    expect(importedComponents().length).toBeGreaterThan(0)
  })

  it('knows which stylesheets every imported HeroUI component needs', () => {
    const unmapped = importedComponents().filter((component) => !(component in STYLESHEETS_BY_COMPONENT))

    // Add the component to STYLESHEETS_BY_COMPONENT above, then import the stylesheets it names
    // in src/assets/css/index.css. Its styles live in node_modules/@heroui/styles/dist/components.
    expect(unmapped).toEqual([])
  })

  it('imports a stylesheet for every HeroUI component the app renders', () => {
    const available = importedStylesheets()
    const missing = importedComponents()
      .flatMap((component) => STYLESHEETS_BY_COMPONENT[component] ?? [])
      .filter((stylesheet) => !available.includes(stylesheet))

    // Add `@import '@heroui/styles/components/<name>.css' layer(components);` to
    // src/assets/css/index.css for each stylesheet listed here.
    expect([...new Set(missing)]).toEqual([])
  })

  it('imports no stylesheet the app has stopped needing', () => {
    const needed = new Set(importedComponents().flatMap((component) => STYLESHEETS_BY_COMPONENT[component] ?? []))

    expect(importedStylesheets().filter((stylesheet) => !needed.has(stylesheet))).toEqual([])
  })
})
