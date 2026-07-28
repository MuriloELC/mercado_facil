import { lazy, Suspense, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthContext, AuthSession } from './auth';
import { AdminLayout } from './components/AdminLayout';
import { UserLayout } from './components/UserLayout';

const IntakePage = lazy(() =>
  import('./pages/IntakePage').then((module) => ({ default: module.IntakePage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const QueuePage = lazy(() =>
  import('./pages/QueuePage').then((module) => ({ default: module.QueuePage })),
);
const ReceiptReviewPage = lazy(() =>
  import('./pages/ReceiptReviewPage').then((module) => ({
    default: module.ReceiptReviewPage,
  })),
);
const UserListsPage = lazy(() =>
  import('./pages/UserListsPage').then((module) => ({
    default: module.UserListsPage,
  })),
);

const SESSION_KEY = 'nota_auth_session';
const routeFallback = <p className="muted">Carregando...</p>;

function AdminArea({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <AdminLayout onLogout={onLogout}>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/intake" element={<IntakePage token={token} />} />
          <Route path="/queue" element={<QueuePage token={token} />} />
          <Route path="/receipts/:id" element={<ReceiptReviewPage token={token} />} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

function UserArea({ token, onLogout }: { token: string; onLogout: () => void }) {
  return (
    <UserLayout onLogout={onLogout}>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/lists" element={<UserListsPage token={token} />} />
          <Route path="*" element={<Navigate to="/lists" replace />} />
        </Routes>
      </Suspense>
    </UserLayout>
  );
}

export function App() {
  const [session, setSessionState] = useState<AuthSession | null>(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  });

  const contextValue = useMemo(
    () => ({
      session,
      setSession: (next: AuthSession | null) => {
        setSessionState(next);
        if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
        else localStorage.removeItem(SESSION_KEY);
      },
    }),
    [session],
  );

  if (!session) {
    return (
      <AuthContext.Provider value={contextValue}>
        <Suspense fallback={routeFallback}>
          <Routes>
            <Route
              path="/login"
              element={<LoginPage onAuthenticated={(next) => contextValue.setSession(next)} />}
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {session.user.role === 'admin' ? (
        <AdminArea token={session.token} onLogout={() => contextValue.setSession(null)} />
      ) : (
        <UserArea token={session.token} onLogout={() => contextValue.setSession(null)} />
      )}
    </AuthContext.Provider>
  );
}
