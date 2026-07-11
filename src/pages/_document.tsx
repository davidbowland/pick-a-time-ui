import { Head, Html, Main, NextScript } from 'next/document'
import React from 'react'

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('dark')",
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
