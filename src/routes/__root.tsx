import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
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
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          Wróć na stronę główną
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CS2 Typer — Typuj mecze Counter-Strike 2" },
      { name: "description", content: "Typuj wyniki meczów CS2, zdobywaj coinsy, oraz freebety" },
      { name: "author", content: "CS2 Typer" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "CS2 Typer — Typuj mecze Counter-Strike 2" },
      { name: "twitter:title", content: "CS2 Typer — Typuj mecze Counter-Strike 2" },
      { property: "og:description", content: "Typuj wyniki meczów CS2, zdobywaj coinsy, oraz freebety" },
      { name: "twitter:description", content: "Typuj wyniki meczów CS2, zdobywaj coinsy, oraz freebety" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5cf14468-e3b7-406c-a8b7-b84575beecfb/id-preview-22ae0268--4cda4d7e-1a2d-4444-a640-c0447d512781.lovable.app-1777122314713.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5cf14468-e3b7-406c-a8b7-b84575beecfb/id-preview-22ae0268--4cda4d7e-1a2d-4444-a640-c0447d512781.lovable.app-1777122314713.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <SiteHeader />
      <Outlet />
      <OnboardingDialog />
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}
