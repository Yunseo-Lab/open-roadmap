import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { LoginRoute } from './auth/LoginRoute';
import { RequireAuth } from './auth/RequireAuth';
import { DashboardPage } from './components/DashboardPage';
import { Workspace } from './components/Workspace';
import { PublicProfile } from './components/PublicProfile';
import { PublicRoadmap } from './components/PublicRoadmap';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth loadingBody="Loading roadmaps.">
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/workspace"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/workspace/:roadmapId"
            element={
              <RequireAuth loadingBody="Preparing your workspace.">
                <Workspace />
              </RequireAuth>
            }
          />
          <Route path="/u/:handle" element={<PublicProfile />} />
          <Route path="/r/:slug" element={<PublicRoadmap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
