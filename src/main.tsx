import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './styles/index.css'

import { Layout } from './app/Layout'
import { TodayScreen } from './features/today/TodayScreen'
import { LogScreen } from './features/emotion-log/LogScreen'
import { IaaaScreen } from './features/iaaa/IaaaScreen'
import { SkillsScreen } from './features/trackers/SkillsScreen'
import { TrackerScreen } from './features/trackers/TrackerScreen'
import { SummaryScreen } from './features/history/SummaryScreen'
import { EntriesScreen } from './features/history/EntriesScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { RemindersScreen } from './features/settings/RemindersScreen'
import { AssessmentScreen } from './features/assessment/AssessmentScreen'
import { RecoveryScreen } from './features/recovery/RecoveryScreen'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <TodayScreen /> },
      { path: 'log', element: <LogScreen /> },
      { path: 'iaaa', element: <IaaaScreen /> },
      { path: 'skills', element: <SkillsScreen /> },
      { path: 'skills/:trackerId', element: <TrackerScreen /> },
      { path: 'history', element: <SummaryScreen /> },
      { path: 'history/entries', element: <EntriesScreen /> },
      { path: 'settings', element: <SettingsScreen /> },
      { path: 'settings/reminders', element: <RemindersScreen /> },
      { path: 'assessment', element: <AssessmentScreen /> },
      { path: 'recovery', element: <RecoveryScreen /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
