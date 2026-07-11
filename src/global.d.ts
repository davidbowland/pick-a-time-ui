declare module '*.pdf' {
  export default '' as string
}

declare module '*.png' {
  import { StaticImageData } from 'next/image'
  const content: StaticImageData
  export default content
}

declare module '*.jpg' {
  import { StaticImageData } from 'next/image'
  const content: StaticImageData
  export default content
}

declare module '*.webp' {
  import { StaticImageData } from 'next/image'
  const content: StaticImageData
  export default content
}
