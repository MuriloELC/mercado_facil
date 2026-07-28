import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { AuthSession } from '../auth';

type LoginPageProps = {
  onAuthenticated: (session: AuthSession) => void;
};

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await login(email.trim(), password);
      onAuthenticated({ token: response.access_token, user: response.user });
      navigate(response.user.role === 'admin' ? '/queue' : '/lists');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 460, marginTop: 40 }}>
      <section className="card">
        <h1 className="title">Login</h1>
        <p className="subtitle">Entre com as credenciais configuradas para sua conta.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="voce@exemplo.com" required />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </div>
          {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}
          <div className="button-row">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
