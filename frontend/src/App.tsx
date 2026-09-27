import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { AnalysisProvider } from './hooks/useAnalysis';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <AnalysisProvider>
            <AppRoutes />
          </AnalysisProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
