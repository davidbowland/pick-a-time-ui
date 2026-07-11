// @ts-check
import fs from 'fs'
import withExportImages from 'next-export-optimize-images'

if (process.env.DEVELOPMENT === 'true') {
  fs.readFileSync('.env.development', 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
      if (match) process.env[match[1]] = match[2]
    })
}

/** @type {import('next').NextConfig} */
const nextConfig = withExportImages({
  ...(process.env.NODE_ENV !== 'development' && { output: 'export' }),
  pageExtensions: ['ts', 'tsx'],
  trailingSlash: true,
})

export default nextConfig
