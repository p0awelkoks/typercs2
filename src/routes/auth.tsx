/**
 * /auth — strona logowania (Discord OAuth).
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
  const { user, signInWithDiscord, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundImage: "var(--gradient-hero)" }}
    >
      <div className="gaming-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow-primary">
          <Crosshair className="h-8 w-8 text-primary-foreground" />
        </div>

        <h1 className="mb-2 font-display text-3xl font-bold">
          Witaj w <span className="gradient-text">CS2 Typer</span>
        </h1>

        <p className="mb-8 text-sm text-muted-foreground">
          Zaloguj się przez Discord, aby typować mecze i walczyć o czołówkę rankingu.
        </p>

        <Button
          onClick={signInWithDiscord}
          size="lg"
          className="w-full"
          variant="default"
        >
          <DiscordIcon /> Kontynuuj z Discord
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          Konto zostanie utworzone automatycznie przy pierwszym logowaniu.
        </p>
      </div>
    </div>
  );
}

function DiscordIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="white">
      <path d="M20 4.5A17 17 0 0 0 16.5 3l-.2.4a15 15 0 0 1 3.3 1.2A16.5 16.5 0 0 0 20 4.5zM7.5 3A17 17 0 0 0 4 4.5c.2.3.4.7.5 1A15 15 0 0 1 7.8 4L7.5 3zM12 7c-2.5 0-4.5 2-4.5 4.5S9.5 16 12 16s4.5-2 4.5-4.5S14.5 7 12 7z"/>
    </svg>
  );
}
