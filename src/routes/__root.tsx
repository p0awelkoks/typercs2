import { Outlet, createRootRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { SiteHeader } from "@/components/SiteHeader";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">Strony nie znaleziono</h2>
        <p className="mt-2 text-sm text-muted-foreground">Strona, której szukasz, nie istnieje.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  // Per-route head() metadata (SPA: update document title on navigation)
  useEffect(() => {
    // base title — individual pages can override via document.title in their components
  }, []);

  return (
    <AuthProvider>
      <SiteHeader />
      <Outlet />
      <OnboardingDialog />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
