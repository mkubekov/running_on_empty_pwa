import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  customEmotionId,
  EMOTION_CATEGORIES,
  resolveEmotion,
  searchEmotions,
  toEmotionId,
} from '@/content/emotions'
import type { EmotionId, Valence } from '@/content/emotions'
import { useEmotionFrequency } from '@/db/queries'

/*
  Две чернильницы, а не светофор: фиолетовые чернила и сепия равны в правах.
  Книга прямо говорит, что плохих эмоций не бывает, — цвет не должен
  подсказывать, какое чувство «правильное».
*/
const CHOSEN: Record<Valence, string> = {
  heavy: 'border-violet bg-violet-wash text-violet',
  light: 'border-sepia bg-sepia-wash text-sepia',
}

// Строка списка: только заливка и цвет, линовка между строками остаётся серой.
const CHOSEN_ROW: Record<Valence, string> = {
  heavy: 'bg-violet-wash text-violet',
  light: 'bg-sepia-wash text-sepia',
}

const MARK: Record<Valence, string> = {
  heavy: 'text-violet',
  light: 'text-sepia',
}

function Word({
  word,
  valence,
  chosen,
  onToggle,
}: {
  word: string
  valence: Valence
  chosen: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={chosen}
      className={`min-h-11 max-w-full break-words border px-2.5 py-1.5 text-left font-book text-form transition-colors ${
        chosen
          ? CHOSEN[valence]
          : 'border-rule text-pencil hover:border-pencil-faint hover:text-ink'
      }`}
    >
      {word}
    </button>
  )
}

/**
 * Поле-селект. Список раскрывается под полем, в потоке страницы, а не поверх:
 * так его не обрезает рамка графы. Закрывается повторным нажатием,
 * Escape или нажатием мимо.
 */
function Dropdown({
  label,
  value,
  placeholder,
  open,
  onOpenChange,
  children,
}: {
  label: string
  value: string
  placeholder: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="min-w-0 space-y-1.5">
      <p className="font-form text-note text-pencil-faint">{label}</p>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`flex min-h-11 w-full items-center gap-3 border px-3 text-left transition-colors ${
          open ? 'border-pencil' : 'border-rule-strong'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate font-book text-body ${
            value ? 'text-ink' : 'text-pencil-faint'
          }`}
        >
          {value || placeholder}
        </span>
        <span aria-hidden className="shrink-0 text-pencil">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain border border-rule-strong">
          {children}
        </div>
      )}
    </div>
  )
}

/** Строка внутри раскрытого списка. */
function Option({
  selected,
  className = '',
  onSelect,
  children,
}: {
  selected: boolean
  className?: string
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-11 w-full min-w-0 items-center gap-2.5 border-b border-rule px-3 py-2 text-left last:border-b-0 ${className}`}
    >
      {children}
    </button>
  )
}

const INKS = [
  { id: 'heavy' as const, title: 'Тяжёлые' },
  { id: 'light' as const, title: 'Светлые' },
]

export function EmotionPicker({
  value,
  onChange,
}: {
  value: EmotionId[]
  onChange: (next: EmotionId[]) => void
}) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [openList, setOpenList] = useState<'category' | 'words' | null>(null)
  const category = EMOTION_CATEGORIES.find((c) => c.id === categoryId)

  const frequency = useEmotionFrequency(60)
  const recent = useMemo(
    () => frequency.slice(0, 12).map((f) => resolveEmotion(f.id)),
    [frequency],
  )
  const results = useMemo(() => searchEmotions(query), [query])

  const chosen = new Set(value)

  function toggle(id: EmotionId) {
    onChange(chosen.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  function countIn(words: string[]): number {
    return words.filter((w) => chosen.has(toEmotionId(w))).length
  }

  return (
    <div className="space-y-5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => {
            const emotion = resolveEmotion(id)
            return (
              <Word
                key={id}
                word={emotion.word}
                valence={emotion.valence}
                chosen
                onToggle={() => toggle(id)}
              />
            )
          })}
        </div>
      )}

      <input
        type="search"
        inputMode="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Искать слово"
        aria-label="Искать слово"
        className="min-h-11 w-full border-b border-rule-strong bg-transparent font-book text-body text-ink outline-none focus:border-violet"
      />

      {query ? (
        results.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {results.map((emotion) => (
              <Word
                key={emotion.id}
                word={emotion.word}
                valence={emotion.valence}
                chosen={chosen.has(emotion.id)}
                onToggle={() => toggle(emotion.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-book text-form text-pencil">
              В словаре такого слова нет. Запишите своё:
            </p>
            <button
              type="button"
              onClick={() => {
                toggle(customEmotionId(query))
                setQuery('')
              }}
              className="min-h-11 border border-dashed border-pencil-faint px-2.5 py-1.5 font-book text-form text-ink"
            >
              {query}
            </button>
          </div>
        )
      ) : (
        <>
          {recent.length > 0 && (
            <div className="space-y-2.5">
              <p className="font-form text-note text-pencil-faint">
                Возвращается чаще всего
              </p>
              <div className="flex flex-wrap gap-2">
                {recent.map((emotion) => (
                  <Word
                    key={emotion.id}
                    word={emotion.word}
                    valence={emotion.valence}
                    chosen={chosen.has(emotion.id)}
                    onToggle={() => toggle(emotion.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <Dropdown
            label="Группа"
            value={category?.title ?? ''}
            placeholder="Выберите группу"
            open={openList === 'category'}
            onOpenChange={(o) => setOpenList(o ? 'category' : null)}
          >
            {INKS.map((ink) => (
              <div key={ink.id}>
                <p className="border-b border-rule bg-page px-3 pt-3 pb-1.5 font-form text-note text-pencil-faint">
                  {ink.title}
                </p>
                {EMOTION_CATEGORIES.filter((c) => c.valence === ink.id).map((c) => {
                  const n = countIn(c.words)
                  return (
                    <Option
                      key={c.id}
                      selected={c.id === categoryId}
                      onSelect={() => {
                        setCategoryId(c.id)
                        setOpenList('words')
                      }}
                    >
                      <span aria-hidden className="w-4 shrink-0 text-pencil">
                        {c.id === categoryId ? '✓' : ''}
                      </span>
                      <span className="min-w-0 flex-1 break-words font-book text-body text-ink">
                        {c.title}
                      </span>
                      {n > 0 && (
                        <span className={`shrink-0 font-form text-note ${MARK[c.valence]}`}>
                          {n}
                        </span>
                      )}
                    </Option>
                  )
                })}
              </div>
            ))}
          </Dropdown>

          {category && (
            <Dropdown
              label="Слова"
              value={category.words
                .filter((w) => chosen.has(toEmotionId(w)))
                .join(', ')}
              placeholder="Отметьте слова"
              open={openList === 'words'}
              onOpenChange={(o) => setOpenList(o ? 'words' : null)}
            >
              {category.words.map((word) => {
                const id = toEmotionId(word)
                const on = chosen.has(id)
                return (
                  <Option
                    key={id}
                    selected={on}
                    className={on ? CHOSEN_ROW[category.valence] : 'text-ink'}
                    onSelect={() => toggle(id)}
                  >
                    <span aria-hidden className="w-4 shrink-0">
                      {on ? '☑' : '☐'}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-book text-body">
                      {word}
                    </span>
                  </Option>
                )
              })}
            </Dropdown>
          )}
        </>
      )}
    </div>
  )
}
