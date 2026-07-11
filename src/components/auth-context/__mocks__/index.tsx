import React from 'react'

const mockAuthState = {
  isSignedIn: false,
  user: null,
  isLoading: false,
  handleSignIn: jest.fn(),
  handleSignOut: jest.fn(),
}

export const useAuthContext = jest.fn(() => mockAuthState)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>

export const mockSetAuthState = (overrides: Partial<typeof mockAuthState>) => {
  useAuthContext.mockReturnValue({ ...mockAuthState, ...overrides })
}
