import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type AuthUser = { id: string; email: string; displayName: string };
type TenantOption = { id: string; label: string };
type AuthSession = { user: AuthUser; tenantId: string; role: string };

const tenantOptions: TenantOption[] = [
  { id: "tenant-autofix", label: "Autofix Center" },
  { id: "tenant-ruta-24", label: "Ruta 24" },
  { id: "tenant-moto-verde", label: "Moto Verde" },
];

export default function AuthGate({ children }: { children: (session: AuthSession) => ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantId, setTenantId] = useState(tenantOptions[0].id);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (active) setSession(payload?.user ? payload as AuthSession : null);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, tenantId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo iniciar sesión.");
      setSession(payload);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setSession(null);
  };

  if (checking) {
    return <main className="auth-page"><p className="auth-loading">Comprobando sesión...</p></main>;
  }

  if (!session) {
    return (
      <main className="auth-page">
        <form className="auth-panel" onSubmit={handleLogin}>
          <p className="eyebrow">AdPulse · Acceso seguro</p>
          <h1>Iniciar sesión</h1>
          <label>
            Correo electrónico
            <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Contraseña
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <label>
            Espacio de trabajo
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
              {tenantOptions.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.label}</option>)}
            </select>
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <>
      <div className="auth-session-bar">
        <span>{session.user.displayName} · {session.user.email}</span>
        <button type="button" onClick={handleLogout}>Cerrar sesión</button>
      </div>
      {children(session)}
    </>
  );
}