import { Input, Label, TextField } from '@heroui/react'
import React from 'react'

type VoterNameFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

export const VoterNameField = React.forwardRef<HTMLInputElement, VoterNameFieldProps>(
  ({ label, value, onChange, maxLength }, ref): React.ReactNode => (
    <TextField>
      <Label>{label}</Label>
      <Input
        className="border border-[var(--slate)]/70 bg-[var(--bone)]/[0.04] text-[var(--bone)] placeholder:text-[var(--slate)]"
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Alex"
        ref={ref}
        value={value}
      />
      <p className="text-xs text-[var(--slate)]">
        Optional — skip it and we&rsquo;ll give you a name like &lsquo;Clever Fox.&rsquo;
      </p>
    </TextField>
  ),
)
VoterNameField.displayName = 'VoterNameField'
