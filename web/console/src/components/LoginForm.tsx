import { FormEvent, useState } from "react";
import { useStrings } from "../i18n/strings";

type Props = {
  onSubmit: (email: string, password: string) => Promise<void>;
  error?: string | null;
  isLoading?: boolean;
};

const LoginForm = ({ onSubmit, error, isLoading = false }: Props) => {
  const strings = useStrings();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <div className="login-overlay">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>{strings.auth.title}</h2>
        <label htmlFor="login-email">{strings.auth.email}</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isLoading}
        />
        <label htmlFor="login-password">{strings.auth.password}</label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={isLoading}
        />
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? strings.auth.signingIn : strings.auth.submit}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
