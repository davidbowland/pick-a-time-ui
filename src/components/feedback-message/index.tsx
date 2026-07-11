import { Alert, AlertDescription, AlertRoot, CloseButton } from '@heroui/react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

const STATUS_MAP = {
  error: 'danger',
  info: 'accent',
  success: 'success',
} as const

export interface FeedbackMessageProps {
  autoHideDuration?: number
  message: string | undefined
  onClose: () => void
  severity: 'error' | 'success' | 'info'
}

const FeedbackMessage = ({
  autoHideDuration = 5_000,
  message,
  onClose,
  severity,
}: FeedbackMessageProps): React.ReactNode => {
  const [visible, setVisible] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const handleClose = useCallback(() => {
    setVisible(false)
    onCloseRef.current()
  }, [])

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(handleClose, autoHideDuration)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [message, autoHideDuration, handleClose])

  if (!visible || !message) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center" role="alert">
      <AlertRoot className="max-w-md shadow-lg" status={STATUS_MAP[severity]}>
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <CloseButton aria-label="Close notification" onPress={handleClose} />
      </AlertRoot>
    </div>
  )
}

export default FeedbackMessage
