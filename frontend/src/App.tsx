import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import DebtGraph from './pages/DebtGraph';
import AILanguageInput from './pages/AILanguageInput';
import Settlements from './pages/Settlements';
import AppLayout from './components/AppLayout';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Dashboard/App Panel Routes */}
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />
        <Route
          path="/groups"
          element={
            <AppLayout>
              <Groups />
            </AppLayout>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <AppLayout>
              <GroupDetail />
            </AppLayout>
          }
        />
        <Route
          path="/groups/:id/graph"
          element={
            <AppLayout>
              <DebtGraph />
            </AppLayout>
          }
        />
        <Route
          path="/ai-input"
          element={
            <AppLayout>
              <AILanguageInput />
            </AppLayout>
          }
        />
        <Route
          path="/settlement-page"
          element={
            <AppLayout>
              <Settlements />
            </AppLayout>
          }
        />

        {/* Fallbacks */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
