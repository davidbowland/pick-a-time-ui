import { Input, Label, TextField } from '@heroui/react'
import React from 'react'

export const VoterNameField = ({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}): React.ReactNode => (
  <TextField>
    <Label>{label}</Label>
    <Input
      className="border border-[var(--slate)]/70 bg-[var(--bone)]/[0.04] text-[var(--bone)] placeholder:text-[var(--slate)]"
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. Alex"
      value={value}
    />
    <p className="text-xs text-[var(--slate)]">
      Optional — skip it and we&rsquo;ll give you a name like &lsquo;Clever Fox.&rsquo;
    </p>
  </TextField>
)
