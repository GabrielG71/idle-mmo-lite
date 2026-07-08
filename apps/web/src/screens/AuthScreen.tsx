import { useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError, setToken } from '@/lib/api';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      setToken(res.accessToken);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha inesperada');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-6">
      <header className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted">
          <Sparkles size={14} className="text-accent" /> Fase 1 · itens &amp; talentos
        </div>
        <h1 className="bg-gradient-to-br from-white to-muted bg-clip-text text-3xl font-bold text-transparent">
          Idle MMO-lite
        </h1>
      </header>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Entrar' : 'Criar conta'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="senha (mín. 8 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-muted hover:text-foreground"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
