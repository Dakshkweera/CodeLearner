import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Header from './shared/components/Header';
import ErrorMessage from './shared/components/ErrorMessage';
import GraphPanel from './features/graph/components/GraphPanel';
import CodePanel from './features/codeViewer/components/CodePanel';
import { useAppStore } from './shared/store/appStore';

import Signup from './pages/Auth/Signup';
import Login from './pages/Auth/Login';
import LandingPage from './pages/LandingPage';

function App() {
  const { error, selectedFile, repository } = useAppStore();
  const [token, setToken] = useState<string | null>(null);

  // Read token once on mount
  useEffect(() => {
    const stored = localStorage.getItem('codelearnerToken');
    setToken(stored);
  }, []);

  const AppLayout = (
    <div className="flex h-screen flex-col bg-gray-900">
      <Header />
      {error && (
        <div className="px-6 pt-4">
          <ErrorMessage />
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        <GraphPanel />
        {selectedFile && repository && (
          <CodePanel owner={repository.owner} name={repository.name} />
        )}
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Public auth routes */}
        <Route path="/signup" element={<Signup setToken={setToken} />} />
        <Route path="/login" element={<Login setToken={setToken} />} />

        {/* Protected main app route */}
        <Route
          path="/app"
          element={token ? AppLayout : <Navigate to="/login" replace />}
        />

        {/* Fallback: redirect unknown routes */}
        <Route
          path="*"
          element={<Navigate to={token ? '/app' : '/'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
