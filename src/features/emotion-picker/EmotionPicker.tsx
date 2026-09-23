import { useMemo, useState } from 'react'
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
import { withPlural } from '@/lib/plural'
import { Line, Sheet } from '@/app/ui'

/*
  Две чернильницы, а не светофор: фиолетовые чернила и сепия равны в правах.
  Книга прямо говорит, что плохих эмоций не бывает, — цвет не должен
  подсказывать, какое чувство «правильное».
*/
const CHOSEN: Record<Valence, string> = {
  heavy: 'border-violet bg-violet-wash text-violet',
  light: 'border-sepia bg-sepia-wash text-sepia',
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
      className={`min-h-11 border px-2.5 py-1.5 font-book text-form transition-colors ${
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
 * Раскрывающаяся строка. Счёт выбранного живёт на полях, слева.
 * Уровень задаёт кегль: чернильница крупнее, группа внутри — мельче.
 */
function Fold({
  title,
  count,
  chosen,
  valence,
  open,
  level,
  onToggle,
  children,
}: {
  title: string
  count: string
  chosen: number
  valence: Valence
  open: boolean
  level: 1 | 2
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <Line
      note={chosen > 0 ? <span className={MARK[valence]}>{chosen}</span> : null}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <span className={`font-book ${level === 1 ? 'text-word' : 'text-body'}`}>
          {title}
        </span>
        <span className="shrink-0 font-form text-note text-pencil-faint">
          {open ? 'свернуть' : count}
        </span>
      </button>
      {open && children}
    </Line>
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
  // Оба уровня закрыты: 38 категорий простынёй читать невозможно.
  const [openInk, setOpenInk] = useState<Valence | null>(null)
  const [openCategory, setOpenCategory] = useState<string | null>(null)

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

          <Sheet>
            {INKS.map((ink) => {
              const categories = EMOTION_CATEGORIES.filter(
                (c) => c.valence === ink.id,
              )
              const words = categories.flatMap((c) => c.words)
              const inkOpen = openInk === ink.id

              return (
                <Fold
                  key={ink.id}
                  title={ink.title}
                  count={withPlural(categories.length, [
                    'группа',
                    'группы',
                    'групп',
                  ])}
                  chosen={countIn(words)}
                  valence={ink.id}
                  open={inkOpen}
                  level={1}
                  onToggle={() => {
                    setOpenInk(inkOpen ? null : ink.id)
                    setOpenCategory(null)
                  }}
                >
                  {/* Вложенный уровень сдвинут вправо — иначе иерархия не читается. */}
                  <div className="mt-1 pl-5">
                    <Sheet>
                      {categories.map((category) => {
                        const catOpen = openCategory === category.id
                        return (
                          <Fold
                            key={category.id}
                            title={category.title}
                            count={withPlural(category.words.length, [
                              'слово',
                              'слова',
                              'слов',
                            ])}
                            chosen={countIn(category.words)}
                            valence={category.valence}
                            open={catOpen}
                            level={2}
                            onToggle={() =>
                              setOpenCategory(catOpen ? null : category.id)
                            }
                          >
                            <div className="mt-3 flex flex-wrap gap-2">
                              {category.words.map((word) => {
                                const id = toEmotionId(word)
                                return (
                                  <Word
                                    key={id}
                                    word={word}
                                    valence={category.valence}
                                    chosen={chosen.has(id)}
                                    onToggle={() => toggle(id)}
                                  />
                                )
                              })}
                            </div>
                          </Fold>
                        )
                      })}
                    </Sheet>
                  </div>
                </Fold>
              )
            })}
          </Sheet>
        </>
      )}
    </div>
  )
}
