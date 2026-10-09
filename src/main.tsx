import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { session } from './api';
import { Layout } from './components/Layout';
import { DocumentPage } from './pages/DocumentPage';
import { Documents } from './pages/Documents';
import { Login } from './pages/Login';
import { Upload } from './pages/Upload';
import { UsagePage } from './pages/UsagePage';

// Every page but the login needs the admin key of this tab's session.
function Guarded({ children }: { children: React.ReactNode }) {
  return session.key() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Guarded><Documents /></Guarded>} />
        <Route path="/upload" element={<Guarded><Upload /></Guarded>} />
        <Route path="/documents/:id" element={<Guarded><DocumentPage /></Guarded>} />
        <Route path="/usage" element={<Guarded><UsagePage /></Guarded>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
