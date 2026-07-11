import Link from 'next/link'
import React from 'react'

const PrivacyLink = (): React.ReactNode => {
  return (
    <div className="p-2 text-center text-xs text-[#1F2937] hover:text-[#374151]">
      <Link href="/privacy-policy">Privacy policy</Link>
    </div>
  )
}

export default PrivacyLink
