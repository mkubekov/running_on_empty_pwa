import { useEffect, useState } from 'react'
import type { TrackerDef } from '@/content/trackers'
import type { DayKey, TrackerValue } from '@/db/schema'
import { putTrackerDay, useTrackerDay } from '@/db/queries'
import { dayKey } from '@/lib/date'

function emptyValue(def: TrackerDef): TrackerValue {
  switch (def.type.kind) {
    case 'counter':
      return { kind: 'counter', count: 0 }
    case 'checklist':
      return {
        kind: 'checklist',
        groups: Object.fromEntries(
          def.type.groups.map((g) => [g.id, Array<string>(g.slots).fill('')]),
        ),
      }
    case 'scale':
      return { kind: 'scale', value: 0 }
    default:
      return { kind: 'habit', done: false }
  }
}

/**
 * Счётчик рисуется палочками, как считают на полях тетради: пятая палочка
 * перечёркивает предыдущие четыре. Цифра справа — для тех дней, когда палочек
 * становится много.
 */
function Tally({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="font-form text-form text-pencil-faint">пока ни разу</span>
    )
  }
  const groups = Math.floor(count / 5)
  const rest = count % 5

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {Array.from({ length: groups }, (_, i) => (
        <span key={i} className="relative inline-flex gap-[3px]">
          {Array.from({ length: 4 }, (_, j) => (
            <span key={j} className="block h-4 w-px bg-violet" />
          ))}
          <span className="absolute inset-x-[-2px] top-1/2 h-px -rotate-12 bg-violet" />
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex gap-[3px]">
          {Array.from({ length: rest }, (_, j) => (
            <span key={j} className="block h-4 w-px bg-violet" />
          ))}
        </span>
      )}
    </span>
  )
}

function CounterWidget({
  def,
  date,
  value,
}: {
  def: TrackerDef & { type: { kind: 'counter'; unit: string; hint: string } }
  date: DayKey
  value: TrackerValue
}) {
  const count = value.kind === 'counter' ? value.count : 0

  function set(next: number) {
    void putTrackerDay(def.id, date, { kind: 'counter', count: Math.max(0, next) })
  }

  return (
    <div className="space-y-3">
      <p className="font-form text-form leading-snug text-pencil">
        {def.type.hint}
      </p>
      <div className="flex items-center gap-4">
        <div className="flex min-h-6 flex-1 items-center">
          <Tally count={count} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Убрать одну отметку"
            disabled={count === 0}
            onClick={() => set(count - 1)}
            className="size-11 border border-rule-strong font-form text-body text-ink transition-colors hover:border-pencil disabled:border-rule disabled:text-pencil-faint"
          >
            −
          </button>
          <span className="w-6 text-center font-form text-word tabular-nums">
            {count}
          </span>
          <button
            type="button"
            aria-label="Добавить отметку"
            onClick={() => set(count + 1)}
            className="size-11 border border-violet font-form text-body text-violet transition-colors hover:bg-violet-wash"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

function ChecklistWidget({
  def,
  date,
  value,
}: {
  def: TrackerDef & {
    type: {
      kind: 'checklist'
      groups: { id: string; title: string; slots: number; placeholder: string }[]
    }
  }
  date: DayKey
  value: TrackerValue
}) {
  const groups =
    value.kind === 'checklist'
      ? value.groups
      : (emptyValue(def) as Extract<TrackerValue, { kind: 'checklist' }>).groups

  // Локальный буфер, чтобы ввод не дёргался на каждом кадре записи в базу.
  const [draft, setDraft] = useState(groups)
  useEffect(() => setDraft(groups), [JSON.stringify(groups)])

  function commit(next: Record<string, string[]>) {
    setDraft(next)
    void putTrackerDay(def.id, date, { kind: 'checklist', groups: next })
  }

  return (
    <div className="space-y-5">
      {def.type.groups.map((group) => {
        const rows = draft[group.id] ?? Array<string>(group.slots).fill('')
        const filled = rows.filter((r) => r.trim()).length
        return (
          <div key={group.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="font-form text-form text-pencil">{group.title}</h4>
              <span className="font-form text-note text-pencil-faint tabular-nums">
                {filled} из {group.slots}
              </span>
            </div>
            {rows.map((row, i) => (
              <div key={i} className="flex items-baseline gap-2.5">
                <span
                  aria-hidden
                  className={`w-3 shrink-0 text-center font-form text-note ${
                    row.trim() ? 'text-sepia' : 'text-pencil-faint'
                  }`}
                >
                  {row.trim() ? '✓' : i + 1}
                </span>
                <input
                  value={row}
                  placeholder={group.placeholder}
                  aria-label={`${group.title}, строка ${i + 1}`}
                  onChange={(e) => {
                    const next = { ...draft }
                    const copy = [...rows]
                    copy[i] = e.target.value
                    next[group.id] = copy
                    setDraft(next)
                  }}
                  onBlur={() => commit(draft)}
                  className="min-h-10 flex-1 border-b border-rule bg-transparent font-book text-form text-ink outline-none focus:border-violet"
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function TrackerWidget({
  def,
  date = dayKey(),
}: {
  def: TrackerDef
  date?: DayKey
}) {
  const row = useTrackerDay(def.id, date)
  const value = row?.value ?? emptyValue(def)

  switch (def.type.kind) {
    case 'counter':
      return (
        <CounterWidget
          def={def as Parameters<typeof CounterWidget>[0]['def']}
          date={date}
          value={value}
        />
      )
    case 'checklist':
      return (
        <ChecklistWidget
          def={def as Parameters<typeof ChecklistWidget>[0]['def']}
          date={date}
          value={value}
        />
      )
    default:
      return (
        <p className="font-form text-form text-pencil-faint">
          Этот лист появится в следующей версии.
        </p>
      )
  }
}
