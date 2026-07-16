import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import talkLogoAsset from "@/assets/talk-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center">
            <img
              src={talkLogoAsset.url}
              alt="Talk"
              className="h-8 w-auto"
            />
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link
              to="/dashboard"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Dashboard
            </Link>
            <Link
              to="/clients"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Clientes
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
