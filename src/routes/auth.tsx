/**
 * /auth — strona logowania (Google OAuth).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Crosshair } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logowanie — CS2 Typer" },
      { name: "description", content: "Zaloguj się i typuj mecze CS2." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, signInWithGoogle, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="gaming-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow-primary">
          <Crosshair className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mb-2 font-display text-3xl font-bold">
          Witaj w <span className="gradient-text">CS2 Typer</span>
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Zaloguj się przez Google, aby typować mecze i walczyć o czołówkę rankingu.
        </p>
        <Button onClick={signInWithGoogle} size="lg" className="w-full" variant="default">
          <GoogleIcon /> Kontynuuj z Google
        </Button>
        <p className="mt-6 text-xs text-muted-foreground">
          Konto zostanie utworzone automatycznie przy pierwszym logowaniu.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85" />
      <path fill="#fff" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" opacity=".7"/>
      <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.52 6.16-4.52z" opacity=".55"/>
    </svg>
  );
}
