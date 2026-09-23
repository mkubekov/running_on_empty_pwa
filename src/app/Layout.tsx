import { NavLink, Outlet, useLocation } from 'react-router'
import type { ReactNode } from 'react'

/*
  Нижняя навигация — закладки тетради. Активная отмечена жирной чертой
  сверху, как торчащий язычок. Иконок нет: слово точнее пиктограммы,
  а произвольные значки вроде «◍» ничего не сообщают.
*/
const TABS = [
  { to: '/', label: 'Сегодня' },
  { to: '/skills', label: 'Навыки' },
  { to: '/history', label: 'Сводка' },
  { to: '/settings', label: 'Настройки' },
]

export function Layout() {
  const { pathname } = useLocation()
  // На экранах-мастерах закладки мешают: они уводят из начатого дела.
  const immersive =
    pathname.startsWith('/log') ||
    pathname.startsWith('/iaaa') ||
    pathname.startsWith('/assessment')

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[34rem] flex-col">
      <main className={`flex-1 px-4 pt-5 ${immersive ? 'pb-10' : 'pb-24'}`}>
        <Outlet />
      </main>

      {!immersive && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-page/97 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[34rem]">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex-1 border-t-2 py-3.5 text-center font-form text-form transition-colors ${
                    isActive
                      ? 'border-violet text-ink'
                      : 'border-transparent text-pencil'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

/**
 * Шапка экрана. Дата и прочие приписки идут мельче и гротеском —
 * это надпись на бланке, а не содержание.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="safe-top mb-5 flex items-baseline justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-book text-head leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 font-form text-form text-pencil">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  )
}
