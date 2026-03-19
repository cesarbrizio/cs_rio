import { type FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Button, Card, Input, useToast } from '../components/ui';
import { useAuthStore } from '../stores/authStore';

interface RouteState {
  redirectTo?: string;
}

export function LoginScreen(): JSX.Element {
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const { pushToast } = useToast();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const redirectTarget = (location.state as RouteState | null)?.redirectTo;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setErrorMessage(null);
      await login({ email, password });
      pushToast({
        description: redirectTarget
          ? `Sessão autenticada. Direcionando para ${redirectTarget}.`
          : 'Perfil autenticado. Decidindo o próximo passo...',
        title: 'Login concluído',
        tone: 'success',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha inesperada no login.');
    }
  };

  return (
    <Card className="auth-screen">
      <div className="auth-screen__copy">
        <span className="eyebrow">/login</span>
        <h2>Entrar</h2>
        <p>Informe seu email e senha.</p>
      </div>

      <form className="auth-screen__form" onSubmit={handleSubmit}>
        <Input
          autoComplete="email"
          autoFocus
          label="Email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@csrio.com"
          type="email"
          value={email}
        />
        <Input
          autoComplete="current-password"
          label="Senha"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          trailing={
            <button
              className="ui-input__toggle"
              onClick={() => setIsPasswordVisible((current) => !current)}
              type="button"
            >
              {isPasswordVisible ? 'Ocultar' : 'Mostrar'}
            </button>
          }
          type={isPasswordVisible ? 'text' : 'password'}
          value={password}
        />
        {errorMessage ? <p className="auth-screen__error">{errorMessage}</p> : null}
        <Button block isBusy={isLoading} type="submit">
          Entrar
        </Button>
      </form>

      <footer className="auth-screen__footer">
        <span>Ainda nao tem conta?</span>
        <Link to="/register">Criar agora</Link>
      </footer>
    </Card>
  );
}
