import React from 'react'

// `next/head` hands its children to the Next runtime's head manager, which only exists inside a
// real Next render -- under jsdom it drops them, so nothing a page puts in <Head> is assertable.
// Rendering the children inline instead lets React 19 hoist <title>, <meta>, and <link> into
// document.head on its own, and pull them back out on unmount, so tests see exactly the tags the
// page asked for and none left behind by an earlier test.
//
// Jest applies this automatically: a manual mock for a node_modules package needs no jest.mock call.
const Head = ({ children }: { children?: React.ReactNode }): React.ReactNode => <>{children}</>

export default Head
