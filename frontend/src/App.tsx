import { useEffect, useState } from 'react';
import { listBatches } from './api/batches';
import type { Batch } from './api/batches';
import { clearToken, getToken } from './api/client';
import { logout } from './api/auth';
import { AuthForm } from './components/AuthForm';
import { BatchList } from './components/BatchList';
import { CreateBatchForm } from './components/CreateBatchForm';

type View = 'auth' | 'app';

function viewFromToken(): View {
  return getToken() === null ? 'auth' : 'app';
}

export function App() {
  const [view, setView] = useState<View>(viewFromToken);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<number | null>(null);

  useEffect(() => {
    if (view !== 'app') {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listBatches()
      .then((loaded) => {
        if (!cancelled) {
          setBatches(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load batches.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  async function handleLogout(): Promise<void> {
    try {
      await logout();
    } finally {
      clearToken();
      setHouseholdId(null);
      setView('auth');
    }
  }

  function handleAuthenticated(id: number): void {
    setHouseholdId(id);
    setView('app');
  }

  if (view === 'auth') {
    return <AuthForm onAuthenticated={handleAuthenticated} />;
  }

  if (householdId === null) {
    return <p>Loading…</p>;
  }

  return (
    <div>
      <header>
        <h1>rotless</h1>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>
      <main>
        <h2>Your pantry</h2>
        {loading && <p>Loading batches…</p>}
        {error !== null && <p role="alert">{error}</p>}
        {!loading && error === null && <BatchList batches={batches} />}
        <CreateBatchForm householdId={householdId} onCreated={() => {
          listBatches().then(setBatches).catch(() => setError('Could not reload batches.'));
        }} />
      </main>
    </div>
  );
}
