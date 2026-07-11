import React from 'react'

import { ErrorAlert, LoadingSpinner, TimeoutAlert } from './elements'
import { SessionData } from '@types'

export { LoadingSpinner } from './elements'

export interface LoadingPhaseProps {
  session?: SessionData
}

const LoadingPhase = ({ session }: LoadingPhaseProps): React.ReactNode => {
  if (session?.errorMessage != null) {
    return <ErrorAlert message={session.errorMessage} />
  }

  if (session?.timeoutAt != null && Date.now() > session.timeoutAt) {
    return <TimeoutAlert />
  }

  return <LoadingSpinner />
}

export default LoadingPhase
