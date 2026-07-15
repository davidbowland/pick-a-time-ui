import React from 'react'

export const PhoneMock = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div
    aria-hidden="true"
    className="mx-auto w-[min(310px,82vw)] rounded-[2.6rem] bg-gradient-to-b from-[#232330] to-[#101017] p-[0.55rem] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55)]"
    inert={true}
  >
    <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[calc(2.6rem-0.4rem)] bg-[var(--bone)]">
      <div className="absolute top-2 left-1/2 h-5 w-[84px] -translate-x-1/2 rounded-full bg-[#101017]" />
      <div className="flex-1 overflow-hidden pt-10">{children}</div>
    </div>
  </div>
)
