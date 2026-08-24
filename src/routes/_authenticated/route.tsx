import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import talkLogoAsset from "@/assets/talk-logo.png.asset.json";

type AppRole = "admin" | "designer" | "editor";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/clients",
  designer: "/design",
  editor: "/fluxo",
};

function allowedFor(role: AppRole, email: string, pathname: string): boolean {
  if (role === "admin") return true;
  if (pathname.startsWith("/roteiros")) {
    const e = email.toLowerCase();
    return e.startsWith("erik@") || e.startsWith("diandra@");
  }
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

    if (!isAdmin && !allowedFor(primary, data.user.email ?? "", location.pathname)) {
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
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = primaryRole === "admin";
  const showDesign = isAdmin || primaryRole === "designer";
  const showEdicao = isAdmin || primaryRole === "editor";
  const showRoteiros =
    isAdmin || (user.email ?? "").toLowerCase().startsWith("erik@");


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

  const navItems: { to: string; label: string }[] = [
    ...(isAdmin
      ? [
          { to: "/clients", label: "Clientes" },
          { to: "/dashboard", label: "Calendário" },
          { to: "/tasks", label: "Tarefas" },
        ]
      : []),
    ...(showEdicao ? [{ to: "/fluxo", label: "Edição" }] : []),
    ...(showDesign ? [{ to: "/design", label: "Design" }] : []),
    ...(showRoteiros ? [{ to: "/roteiros", label: "Roteiros" }] : []),
  ];

  const displayName = (() => {
    const meta = (user.user_metadata ?? {}) as Record<string, any>;
    const name =
      meta.name || meta.full_name || user.email?.split("@")[0] || "Usuário";
    return name.toString().replace(/^./, (c: string) => c.toUpperCase());
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <Link to={homePath} className="flex shrink-0 items-center">
            <img
              src={talkLogoAsset.url}
              alt="Talk"
              className="h-7 w-auto md:h-8"
            />
          </Link>

          <nav className="hidden items-center gap-3 md:flex md:gap-6">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <span className="text-xs text-muted-foreground">{displayName}</span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair</span>
            </button>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Abrir menu"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] max-w-xs">
              <SheetHeader>
                <SheetTitle className="text-left text-base">
                  {displayName}
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    activeProps={{ className: "bg-accent text-foreground" }}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}
