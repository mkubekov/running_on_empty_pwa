import type { ReactNode, ButtonHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

/*
  Тетрадные примитивы. Раздел — обведённая графа бланка с названием,
  врезанным в рамку: границы разделов видно сразу. Внутри графы строки
  разделяет линовка, а слева идёт узкое поле для приписок.
  Скруглений нет нигде — в тетради их не бывает.
*/

/** Раздел экрана. Название врезано в рамку, как на бланке. */
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      {title && <h2 className="panel-title">{title}</h2>}
      {children}
    </section>
  )
}

/** Стопка строк с линовкой между ними. */
export function Sheet({
  children,
  ruled = true,
  className = '',
}: {
  children: ReactNode
  ruled?: boolean
  className?: string
}) {
  return (
    <div className={`${ruled ? 'sheet-ruled' : ''} ${className}`}>{children}</div>
  )
}

/**
 * Строка графы. `note` — приписка на поле: время, счёт, номер.
 * Если приписки нет вовсе, строка занимает всю ширину.
 */
export function Line({
  note,
  children,
  className = '',
}: {
  note?: ReactNode
  children: ReactNode
  className?: string
}) {
  if (note === undefined) {
    return <div className={`line-plain ${className}`}>{children}</div>
  }
  return (
    <div className="line">
      <div className="line-note">{note}</div>
      <div className={`line-body ${className}`}>{children}</div>
    </div>
  )
}

/** Строка-переход на другой экран. */
export function NavRow({
  to,
  title,
  hint,
  note,
}: {
  to: string
  title: string
  hint?: string
  note?: ReactNode
}) {
  return (
    <Link to={to} className="block">
      <Line note={note}>
        <span className="flex min-h-11 flex-col justify-center">
          <span className="font-book text-word leading-snug">{title}</span>
          {hint && (
            <span className="mt-0.5 font-form text-form text-pencil">{hint}</span>
          )}
        </span>
      </Line>
    </Link>
  )
}

type ButtonVariant = 'write' | 'plain' | 'quiet'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  // Главное действие — обведённое поле, как графа бланка, которую заполняют.
  write:
    'border border-violet text-violet hover:bg-violet-wash disabled:border-rule disabled:text-pencil-faint',
  plain:
    'border border-rule-strong text-ink hover:border-pencil disabled:text-pencil-faint',
  quiet: 'text-pencil hover:text-ink disabled:text-pencil-faint',
}

export function Button({
  variant = 'plain',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`min-h-11 px-4 font-form text-body transition-colors disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
    />
  )
}

/** Поле для письма: подчёркнуто снизу, как строка в тетради. */
export function TextArea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none border-b border-rule-strong bg-transparent py-2 font-book text-body leading-[1.7] text-ink outline-none focus:border-violet ${className}`}
    />
  )
}

/**
 * Мысль из книги. Набирается антиквой и отбивается линией слева —
 * так в конспекте отмечают чужие слова, а не свои.
 */
export function FromBook({
  children,
  source,
}: {
  children: ReactNode
  source?: string
}) {
  return (
    <div className="border-l-2 border-violet pl-4">
      <p className="font-book text-form leading-[1.75] text-pencil">{children}</p>
      {source && (
        <p className="mt-2 font-form text-note text-pencil-faint">{source}</p>
      )}
    </div>
  )
}

/** Пустой экран — приглашение к действию, а не сообщение о пустоте. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-3 font-book text-body leading-[1.7] text-pencil">{children}</p>
  )
}
