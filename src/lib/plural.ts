/**
 * Русские числительные: 1 запись, 2 записи, 5 записей.
 * Формы передаются в порядке [одна, две, пять].
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export function withPlural(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`
}
