import {
  Autocomplete,
  AutocompleteFilter,
  AutocompleteIndicator,
  AutocompletePopover,
  AutocompleteTrigger,
  AutocompleteValue,
  Button,
  Description,
  EmptyState,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  SearchField,
  SliderFill,
  SliderRoot,
  SliderThumb,
  SliderTrack,
  Spinner,
  Switch,
  Tag,
  TagGroup,
  Input,
  useFilter,
} from '@heroui/react'
import type { Key } from '@heroui/react'
import { Clock, LocateFixed } from 'lucide-react'
import React from 'react'

import { PillArrowButton } from '@components/pill-arrow-button'
import { LoadingSpinner } from '@components/session/loading'
import type { SortOption } from '@types'

export const LoadingCard = ({ error }: { error?: string }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner p-6">
      {error ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-center text-sm text-red-400">{error}</p>
          <Button
            className="rounded-full border-white/[0.09] bg-white/[0.05] text-[#D4D4D4]"
            onPress={() => window.location.reload()}
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      ) : (
        <LoadingSpinner />
      )}
    </div>
  </div>
)

export const CreateCard = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner p-6">
      <div className="flex flex-col gap-[18px]">{children}</div>
    </div>
  </div>
)

export const AddressField = ({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string
  error?: string
  disabled: boolean
  onChange: (value: string) => void
}): React.ReactNode => (
  <div className="w-full">
    <div className="mb-[5px] text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Your location</div>
    <Input
      aria-label="Your location"
      autoComplete="postal-code"
      className="w-full"
      disabled={disabled}
      name="address"
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder="Address or ZIP code"
      type="text"
      value={value}
    />
    {error && <span className="mt-1 block text-sm text-red-400">{error}</span>}
  </div>
)

export const UseMyLocationButton = ({
  error,
  isLoading,
  onPress,
}: {
  error?: string
  isLoading: boolean
  onPress: () => void
}): React.ReactNode => (
  <div className="flex flex-col gap-1">
    <button
      className="flex items-center gap-1.5 self-start text-xs text-[#F59E0B] hover:text-[#FBBF24] hover:underline disabled:opacity-40"
      disabled={isLoading}
      onClick={onPress}
      type="button"
    >
      {isLoading ? <Spinner className="h-3 w-3" size="sm" /> : <LocateFixed className="h-3 w-3" />}
      {isLoading ? 'Detecting location…' : 'Use my location'}
    </button>
    {error && <span className="text-xs text-red-400">{error}</span>}
  </div>
)

const radioContentClass = [
  'group relative flex w-full flex-col items-start gap-0.5 rounded-[10px] border px-3 py-2.5 text-[11px] font-medium transition-all',
  'border-white/[0.06] bg-white/[0.02] text-[#4B5563]',
  'data-[selected=true]:border-[rgba(245,158,11,0.25)] data-[selected=true]:bg-[rgba(245,158,11,0.08)] data-[selected=true]:text-[#F59E0B]',
  'data-[focus-visible=true]:border-[rgba(245,158,11,0.25)] data-[focus-visible=true]:bg-[rgba(245,158,11,0.08)]',
].join(' ')

export const SortByFieldset = ({
  rankBy,
  isLoading,
  options,
  onChange,
}: {
  rankBy: string
  isLoading: boolean
  options: SortOption[]
  onChange: (value: string) => void
}): React.ReactNode => (
  <RadioGroup isDisabled={isLoading} onChange={(v) => onChange(v)} value={rankBy} variant="secondary">
    <Label className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Sort by</Label>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {options.map(({ value, label, description }) => (
        <Radio key={value} value={value}>
          <Radio.Content className={radioContentClass}>
            <Radio.Control className="absolute top-2.5 right-2.5 size-4">
              <Radio.Indicator />
            </Radio.Control>
            <Label className="text-[11px] font-semibold">{label}</Label>
            <Description className="text-[10px]">{description}</Description>
          </Radio.Content>
        </Radio>
      ))}
    </div>
  </RadioGroup>
)

export const VoteCountHint = ({ maxChoices }: { maxChoices: number }): React.ReactNode => {
  const maxVotes = maxChoices - 1
  return (
    <p className="text-[11px] text-[#4B5563]">
      Up to <span className="font-semibold text-[#F59E0B]">{maxChoices}</span> restaurants —{' '}
      <span className="font-semibold text-[#F59E0B]">{maxVotes}</span> {maxVotes === 1 ? 'vote' : 'votes'} per person
    </p>
  )
}

export const MaxChoicesSlider = ({
  value,
  disabled,
  min,
  max,
  onChange,
}: {
  value: number
  disabled: boolean
  min: number
  max: number
  onChange: (v: number) => void
}): React.ReactNode => (
  <div className="w-full">
    <div className="mb-3 flex items-center justify-between text-sm">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Maximum restaurants</span>
      <span className="font-semibold text-[#F59E0B]">{value}</span>
    </div>
    <SliderRoot
      aria-label="Maximum restaurants"
      isDisabled={disabled}
      maxValue={max}
      minValue={min}
      onChange={(v: number | number[]) => onChange(Array.isArray(v) ? v[0] : v)}
      step={1}
      value={value}
    >
      <SliderTrack>
        <SliderFill />
        <SliderThumb />
      </SliderTrack>
    </SliderRoot>
  </div>
)

export const DistanceSlider = ({
  value,
  disabled,
  min,
  max,
  onChange,
}: {
  value: number
  disabled: boolean
  min: number
  max: number
  onChange: (v: number) => void
}): React.ReactNode => (
  <div className="w-full">
    <div className="mb-3 flex items-center justify-between text-sm">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">Maximum distance</span>
      <span className="font-semibold text-[#F59E0B]">
        {value} {value === 1 ? 'mile' : 'miles'}
      </span>
    </div>
    <SliderRoot
      aria-label="Maximum distance"
      isDisabled={disabled}
      maxValue={max}
      minValue={min}
      onChange={(v: number | number[]) => onChange(Array.isArray(v) ? v[0] : v)}
      step={1}
      value={value}
    >
      <SliderTrack>
        <SliderFill />
        <SliderThumb />
      </SliderTrack>
    </SliderRoot>
  </div>
)

export const SubmitButton = ({ isLoading, onPress }: { isLoading: boolean; onPress: () => void }): React.ReactNode => (
  <PillArrowButton isLoading={isLoading} label="Find restaurants" loadingLabel="Loading..." onPress={onPress} />
)

export interface MultiSelectItem {
  id: string
  name: string
}

export const MultiSelect = ({
  items,
  selectedKeys,
  onChange,
  label,
  disabled,
}: {
  items: MultiSelectItem[]
  selectedKeys: string[]
  onChange: (key: string) => void
  label: string
  disabled?: boolean
}): React.ReactNode => {
  const { contains } = useFilter({ sensitivity: 'base' })

  const onRemoveTags = (keys: Set<Key>) => {
    keys.forEach((key) => onChange(String(key)))
  }

  const handleChange = (keys: Key | Key[] | null) => {
    const newKeys = new Set(Array.isArray(keys) ? keys.map(String) : [])
    const oldKeys = new Set(selectedKeys)
    for (const key of newKeys) {
      if (!oldKeys.has(key)) onChange(key)
    }
    for (const key of oldKeys) {
      if (!newKeys.has(key)) onChange(key)
    }
  }

  return (
    <Autocomplete
      aria-label={label}
      isDisabled={disabled}
      onChange={handleChange}
      selectionMode="multiple"
      value={selectedKeys as Key[]}
    >
      <Label className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">{label}</Label>
      <AutocompleteTrigger>
        <AutocompleteValue>
          {({ defaultChildren, isPlaceholder, state }: any) => {
            if (isPlaceholder || !state?.selectedItems?.length) {
              return defaultChildren
            }
            const selectedItemsKeys = state.selectedItems.map((item: { key: Key }) => item.key)
            return (
              <TagGroup aria-label={`Selected ${label}`} onRemove={onRemoveTags} size="sm">
                <TagGroup.List>
                  {selectedItemsKeys.map((key: Key) => {
                    const item = items.find((s) => s.id === String(key))
                    if (!item) return null
                    return (
                      <Tag id={item.id} key={item.id}>
                        {item.name}
                      </Tag>
                    )
                  })}
                </TagGroup.List>
              </TagGroup>
            )
          }}
        </AutocompleteValue>
        <AutocompleteIndicator />
      </AutocompleteTrigger>
      <AutocompletePopover>
        <AutocompleteFilter filter={contains}>
          <SearchField aria-label={`Search ${label}`} autoFocus name="search" variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>No results found</EmptyState>}>
            {items.map((item) => (
              <ListBox.Item id={item.id} key={item.id} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </AutocompleteFilter>
      </AutocompletePopover>
    </Autocomplete>
  )
}

export const FilterClosingSoonToggle = ({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}): React.ReactNode => (
  <Switch isDisabled={disabled} isSelected={checked} onChange={onChange}>
    <Switch.Content
      className={`flex w-full items-center justify-between gap-3 rounded-[10px] border p-3 transition-all ${
        checked
          ? 'border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.06)]'
          : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.09]'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            checked ? 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]' : 'bg-white/[0.05] text-[#4B5563]'
          }`}
        >
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Label className="text-sm font-medium text-[#D4D4D4]">Skip closed & closing places</Label>
          <Description className="cursor-[inherit]! text-xs text-[#4B5563]">
            Skip places already closed or closing within an hour
          </Description>
        </div>
      </div>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch.Content>
  </Switch>
)
