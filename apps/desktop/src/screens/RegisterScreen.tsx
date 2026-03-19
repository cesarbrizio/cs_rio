import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button, Card, Input, useToast } from '../components/ui';
import { useAuthStore } from '../stores/authStore';

export function RegisterScreen(): JSX.Element {
  const isLoading = useAuthStore((state) => state.isLoading);
  const register = useAuthStore((state) => state.register);
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setErrorMessage(null);
      await register({
        confirmPassword,
        email,
        nickname,
        password,
      });
      pushToast({
        description: 'Conta criada. O app ja entrou com a sessao e vai seguir para o personagem.',
        title: 'Registro concluido',
        tone: 'success',
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha inesperada no registro.');
    }
  };

  return (
    <Card className="auth-screen">
      <div className="auth-screen__copy">
        <span className="eyebrow">/register</span>
        <h2>Registro</h2>
        <p>O backend autentica a conta nova e o desktop persiste os tokens no bridge IPC.</p>
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
          autoComplete="nickname"
          label="Nickname da conta"
          onChange={(event) => setNickname(event.target.value)}
          placeholder="3-16 caracteres"
          value={nickname}
        />
        <Input
          autoComplete="new-password"
          label="Senha"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimo 8 caracteres"
          type="password"
          value={password}
        />
        <Input
          autoComplete="new-password"
          label="Confirmar senha"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repita a senha"
          type="password"
          value={confirmPassword}
        />
        {errorMessage ? <p className="auth-screen__error">{errorMessage}</p> : null}
        <Button block isBusy={isLoading} type="submit">
          Registrar e entrar
        </Button>
      </form>

      <footer className="auth-screen__footer">
        <span>Ja tem conta?</span>
        <Link to="/login">Voltar para login</Link>
      </footer>
    </Card>
  );
}
