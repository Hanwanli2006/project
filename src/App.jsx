import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import StudentPage from './pages/StudentPage'
import TeacherPage from './pages/TeacherPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/student" element={<StudentPage />} />
      <Route path="/teacher" element={<TeacherPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
