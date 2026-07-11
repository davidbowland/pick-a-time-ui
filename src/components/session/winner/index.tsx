import { useRouter } from 'next/router'
import React, { useState } from 'react'

import { BracketButton, NewSessionButton, WinnerContainer, WinnerLoading, WinnerTitle } from './elements'
import BracketView from '@components/bracket-view'
import RestaurantCard from '@components/restaurant-card'
import { FilterClosingSoonBadge } from '@components/session/elements'
import { ChoicesMap, SessionData } from '@types'

export interface WinnerPhaseProps {
  session: SessionData
  choices: ChoicesMap
}

const WinnerPhase = ({ session, choices }: WinnerPhaseProps): React.ReactNode => {
  const router = useRouter()
  const [bracketOpen, setBracketOpen] = useState(false)
  const winnerChoice = session.winner ? choices[session.winner] : null

  if (!winnerChoice) {
    return <WinnerLoading />
  }

  return (
    <WinnerContainer>
      <WinnerTitle />
      {session.filterClosingSoon && <FilterClosingSoonBadge />}
      <RestaurantCard choice={winnerChoice} variant="winner" />
      <NewSessionButton onPress={() => router.push('/')} />
      <BracketButton onPress={() => setBracketOpen(true)} />
      <BracketView choices={choices} onClose={() => setBracketOpen(false)} open={bracketOpen} session={session} />
    </WinnerContainer>
  )
}

export default WinnerPhase
