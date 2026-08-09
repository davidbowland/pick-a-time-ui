import config from '../next-sitemap.config.js'

describe('next-sitemap config', () => {
  it('should write beside the exported site so the sitemap and robots.txt deploy', () => {
    expect(config.outDir).toEqual('./out')
  })

  it('should generate a robots.txt', () => {
    expect(config.generateRobotsTxt).toBe(true)
  })

  it('should allow crawling everything, so noindex pages can be fetched and read', () => {
    expect(config.robotsTxtOptions?.policies).toEqual([{ allow: '/', userAgent: '*' }])
  })

  it.each(['/400', '/403', '/404', '/500', '/auth/callback', '/calendar-connected', '/p/*'])(
    'should keep %s out of the sitemap',
    (route) => {
      expect(config.exclude).toContain(route)
    },
  )

  it('should keep the landing page and the privacy policy in the sitemap', () => {
    expect(config.exclude).not.toContain('/')
    expect(config.exclude).not.toContain('/privacy-policy')
  })
})
