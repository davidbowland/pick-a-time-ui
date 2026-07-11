import React, { useMemo } from 'react'

import { BracketDrawer, ByeCard, MatchupCard, RoundColumn } from './elements'
import { ChoicesMap, SessionData } from '@types'
import { getRoundWinners } from '@utils/bracket'

export interface BracketViewProps {
  choices: ChoicesMap
  onClose: () => void
  open: boolean
  session: SessionData
}

const getChoiceName = (choiceId: string, choices: ChoicesMap): string => choices[choiceId]?.name ?? choiceId

const BracketView = ({ choices, onClose, open, session }: BracketViewProps): React.ReactNode => {
  const winnersByRound = useMemo(
    () => session.bracket.map((_, roundIndex) => getRoundWinners(session, roundIndex)),
    [session],
  )

  return (
    <BracketDrawer onClose={onClose} open={open}>
      {session.bracket.map((roundMatchups, roundIndex) => {
        const bye = session.byes[roundIndex]
        const winners = winnersByRound[roundIndex]

        return (
          <RoundColumn key={roundIndex} roundNumber={roundIndex + 1}>
            {roundMatchups.map((matchup, matchupIndex) => {
              const [choiceA, choiceB] = matchup
              const winnerId = winners[matchupIndex] ?? null
              const winnerSlot = winnerId === choiceA ? 'a' : winnerId === choiceB ? 'b' : null

              return (
                <MatchupCard
                  key={matchupIndex}
                  nameA={getChoiceName(choiceA, choices)}
                  nameB={getChoiceName(choiceB, choices)}
                  winnerSlot={winnerSlot}
                />
              )
            })}

            {bye && <ByeCard name={getChoiceName(bye, choices)} />}
          </RoundColumn>
        )
      })}
    </BracketDrawer>
  )
}

export default BracketView
