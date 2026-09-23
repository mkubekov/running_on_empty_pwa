import { EMOTION_CATEGORIES } from './emotionWords.generated'
import type { EmotionCategory, Valence } from './emotionWords.generated'

export type { EmotionCategory, Valence }
export { EMOTION_CATEGORIES }

/** Стабильный идентификатор слова — латинский слаг, его и пишем в базу. */
export type EmotionId = string

export interface Emotion {
  id: EmotionId
  word: string
  /** Одно слово нередко встречается в нескольких категориях книги. */
  categoryIds: string[]
  valence: Valence
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ' ': '-',
  '-': '-',
}

/** Тот же алгоритм, что в генераторе, — id не должны разъехаться. */
export function toEmotionId(word: string): EmotionId {
  let out = ''
  for (const ch of word.toLowerCase()) out += TRANSLIT[ch] ?? ''
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** Для поиска: регистр и «ё» не должны мешать. Используется и поиском по записям. */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').trim()
}

const byId = new Map<EmotionId, Emotion>()

for (const category of EMOTION_CATEGORIES) {
  for (const word of category.words) {
    const id = toEmotionId(word)
    const existing = byId.get(id)
    if (existing) {
      if (!existing.categoryIds.includes(category.id)) {
        existing.categoryIds.push(category.id)
      }
    } else {
      byId.set(id, {
        id,
        word,
        categoryIds: [category.id],
        valence: category.valence,
      })
    }
  }
}

export const ALL_EMOTIONS: Emotion[] = [...byId.values()]

const SEARCH_INDEX: { emotion: Emotion; normalized: string }[] = ALL_EMOTIONS.map(
  (emotion) => ({
    emotion,
    normalized: normalize(emotion.word),
  }),
)

export function getEmotion(id: EmotionId): Emotion | undefined {
  return byId.get(id)
}

/**
 * Словарь книги обширен, но не всеобъемлющ. Если человеку не хватило слова,
 * он добавляет своё — оно живёт под префиксом `custom:` и ведёт себя как
 * обычная эмоция везде, кроме поиска по категориям.
 */
export const CUSTOM_PREFIX = 'custom:'

export function customEmotionId(word: string): EmotionId {
  return CUSTOM_PREFIX + word.trim().toLowerCase()
}

export function isCustomEmotion(id: EmotionId): boolean {
  return id.startsWith(CUSTOM_PREFIX)
}

/** Всегда возвращает что-то отображаемое — интерфейс не должен терять выбор. */
export function resolveEmotion(id: EmotionId): Emotion {
  const known = byId.get(id)
  if (known) return known

  const word = isCustomEmotion(id) ? id.slice(CUSTOM_PREFIX.length) : id
  return {
    id,
    word: word.charAt(0).toUpperCase() + word.slice(1),
    categoryIds: [],
    valence: 'heavy',
  }
}

/** Слова для перечисления в интерфейсе: «Грустный, Потерянный, Усталый». */
export function emotionWords(ids: EmotionId[]): string[] {
  return ids.map((id) => resolveEmotion(id).word)
}

export function getCategory(id: string): EmotionCategory | undefined {
  return EMOTION_CATEGORIES.find((c) => c.id === id)
}

/**
 * Совпадения с начала слова важнее, чем где-то в середине: набирая «груст»,
 * человек ищет «Грустный», а не «Полный грусти».
 */
export function searchEmotions(query: string, limit = 60): Emotion[] {
  const q = normalize(query)
  if (!q) return []

  const prefix: Emotion[] = []
  const inner: Emotion[] = []

  for (const { emotion, normalized } of SEARCH_INDEX) {
    if (normalized.startsWith(q)) prefix.push(emotion)
    else if (normalized.includes(q)) inner.push(emotion)
    if (prefix.length >= limit) break
  }

  return [...prefix, ...inner].slice(0, limit)
}

export const EMOTION_STATS = {
  categories: EMOTION_CATEGORIES.length,
  words: ALL_EMOTIONS.length,
}
