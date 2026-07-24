import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import talkLogoAsset from "@/assets/talk-logo.png.asset.json";

type AppRole = "admin" | "designer" | "editor";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/clients",
  designer: "/design",
  editor: "/fluxo",
};

function allowedFor(role: AppRole, pathname: string): boolean {
  if (role === "admin") return true;
  if (role === "designer") return pathname.startsWith("/design");
  if (role === "editor") return pathname.startsWith("/fluxo");
  return false;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesData ?? []).map((r) => r.role as AppRole);

    if (roles.length === 0) throw redirect({ to: "/auth" });

    const isAdmin = roles.includes("admin");
    const primary: AppRole = isAdmin
      ? "admin"
      : roles.includes("designer")
        ? "designer"
        : "editor";

    if (!isAdmin && !allowedFor(primary, location.pathname)) {
      throw redirect({ to: ROLE_HOME[primary] });
    }

    return { user: data.user, roles, primaryRole: primary };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, primaryRole } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isAdmin = primaryRole === "admin";
  const showDesign = isAdmin || primaryRole === "designer";
  const showEdicao = isAdmin || primaryRole === "editor";

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const homePath =
    primaryRole === "admin"
      ? "/clients"
      : primaryRole === "designer"
        ? "/design"
        : "/fluxo";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <Link to={homePath} className="flex items-center">
            <img
              src={talkLogoAsset.url}
              alt="Talk"
              className="h-7 w-auto md:h-8"
            />
          </Link>
          <nav className="flex items-center gap-3 md:gap-6">
            {isAdmin && (
              <Link
                to="/clients"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground md:text-sm"
                activeProps={{ className: "text-foreground" }}
              >
                Clientes
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/dashboard"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground md:text-sm"
                activeProps={{ className: "text-foreground" }}
              >
                Calendário
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/tasks"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground md:text-sm"
                activeProps={{ className: "text-foreground" }}
              >
                Tarefas
              </Link>
            )}
            {showEdicao && (
              <Link
                to="/fluxo"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground md:text-sm"
                activeProps={{ className: "text-foreground" }}
              >
                Edição
              </Link>
            )}
            {showDesign && (
              <Link
                to="/design"
                className="text-xs font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:text-foreground md:text-sm"
                activeProps={{ className: "text-foreground" }}
              >
                Design
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {(() => {
                const meta = (user.user_metadata ?? {}) as Record<string, any>;
                const name =
                  meta.name ||
                  meta.full_name ||
                  user.email?.split("@")[0] ||
                  "Usuário";
                return name
                  .toString()
                  .replace(/^./, (c: string) => c.toUpperCase());
              })()}
            </span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground md:px-3"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
