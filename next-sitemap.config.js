// These routes also carry <meta name="robots" content="noindex, nofollow">.
// They are deliberately NOT disallowed in robots.txt: a crawler has to fetch a page
// to see its noindex, so blocking it would keep the URL indexable from inbound links.
const noIndexRoutes = ['/400', '/403', '/404', '/500', '/auth/callback', '/calendar-connected', '/p/*']

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  // Without this, next-sitemap writes to its default `public/`, which `next build` has already
  // read by the time postbuild runs -- so the sitemap never reached `out/` and never deployed.
  outDir: './out',
  exclude: noIndexRoutes,
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        allow: '/',
        userAgent: '*',
      },
    ],
  },
  siteUrl: 'https://pick-a-time.com',
}
