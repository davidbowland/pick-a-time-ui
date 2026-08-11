import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

interface ManifestIcon {
  purpose?: string
  sizes: string
  src: string
  type: string
}

interface Manifest {
  background_color: string
  description: string
  display: string
  icons: ManifestIcon[]
  id: string
  name: string
  scope: string
  short_name: string
  start_url: string
  theme_color: string
}

const publicDir = join(process.cwd(), 'public')

const readManifest = (): Manifest => JSON.parse(readFileSync(join(publicDir, 'site.webmanifest'), 'utf-8')) as Manifest

// PNG stores its dimensions in the IHDR chunk: two big-endian uint32s at byte offsets 16 and 20.
const readPngSize = (fileName: string): { height: number; width: number } => {
  const bytes = readFileSync(join(publicDir, fileName))
  return { height: bytes.readUInt32BE(20), width: bytes.readUInt32BE(16) }
}

const purposes = (icon: ManifestIcon): string[] => (icon.purpose ?? 'any').split(/\s+/)

const iconsWith = (manifest: Manifest, sizes: string, purpose: string): ManifestIcon[] =>
  manifest.icons.filter((icon) => icon.sizes === sizes && purposes(icon).includes(purpose))

describe('public/site.webmanifest', () => {
  it('is valid JSON', () => {
    expect(() => readManifest()).not.toThrow()
  })

  it.each([
    ['name', 'Pick a Time'],
    ['short_name', 'Pick a Time'],
    ['display', 'standalone'],
    ['theme_color', '#17171a'],
    ['background_color', '#17171a'],
  ] as [keyof Manifest, string][])('declares %s as %s', (field, value) => {
    expect(readManifest()[field]).toBe(value)
  })

  // start_url, scope, and id all resolve against the origin. next.config.mjs sets
  // trailingSlash: true, so the site's own home URL is '/' -- anything else would launch the
  // installed app on a redirect, and a changed id makes browsers treat this as a different app.
  it.each([['start_url'], ['scope'], ['id']] as [keyof Manifest][])('declares %s as the site root', (field) => {
    expect(readManifest()[field]).toBe('/')
  })

  it('describes the app in a full sentence', () => {
    expect(readManifest().description).toMatch(/^[A-Z].*\.$/)
  })

  it('describes the app without exclamation marks', () => {
    expect(readManifest().description).not.toMatch(/!/)
  })

  it('offers an installable 192x192 icon', () => {
    expect(iconsWith(readManifest(), '192x192', 'any')).toHaveLength(1)
  })

  it('offers an installable 512x512 icon', () => {
    expect(iconsWith(readManifest(), '512x512', 'any')).toHaveLength(1)
  })

  it('offers a 512x512 maskable icon for Android', () => {
    expect(iconsWith(readManifest(), '512x512', 'maskable')).toHaveLength(1)
  })

  it('names /icon-512-maskable.png as the maskable icon', () => {
    expect(iconsWith(readManifest(), '512x512', 'maskable')[0].src).toBe('/icon-512-maskable.png')
  })

  it('declares every icon as a PNG', () => {
    expect(readManifest().icons.map((icon) => icon.type)).toEqual(readManifest().icons.map(() => 'image/png'))
  })

  it('references icon files that exist, at the root-relative paths the browser will request', () => {
    const missing = readManifest()
      .icons.map((icon) => icon.src)
      .filter((src) => !existsSync(join(publicDir, src.replace(/^\//, ''))))
    expect(missing).toEqual([])
  })

  it('ships icons whose real pixel dimensions match their declared sizes', () => {
    const declared = readManifest().icons.map((icon) => icon.sizes)
    const actual = readManifest().icons.map((icon) => {
      const { height, width } = readPngSize(icon.src.replace(/^\//, ''))
      return `${width}x${height}`
    })
    expect(actual).toEqual(declared)
  })

  // A maskable icon must be full-bleed art: Android crops it to an arbitrary shape, so any
  // transparency in the corners renders as a white or black wedge. Byte-inequality against
  // icon-512.png is NOT enough on its own -- a re-export or a single changed pixel satisfies it,
  // including a re-save of the transparent-cornered icon, which is the exact failure this is
  // supposed to catch. The property that actually matters is the PNG colour type: 2 is truecolor
  // with no alpha channel. Read from IHDR, byte 25.
  it('ships the maskable icon as full-bleed art with no alpha channel', () => {
    const bytes = readFileSync(join(publicDir, 'icon-512-maskable.png'))

    expect(bytes.readUInt8(25)).toBe(2)
  })

  it('declares no transparency chunk on the maskable icon', () => {
    const bytes = readFileSync(join(publicDir, 'icon-512-maskable.png'))

    expect(bytes.includes(Buffer.from('tRNS'))).toBe(false)
  })

  // Secondary to the two above: catches the lazy failure of copying the source icon outright.
  it('ships maskable artwork distinct from the non-maskable icon', () => {
    expect(readFileSync(join(publicDir, 'icon-512-maskable.png'))).not.toEqual(
      readFileSync(join(publicDir, 'icon-512.png')),
    )
  })
})
