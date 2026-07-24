import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-create-users")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const users = [
          { email: "robson@talk.local", password: "designer", role: "designer" as const },
          { email: "erik@talk.local", password: "editor", role: "editor" as const },
        ];
        const results: any[] = [];
        for (const u of users) {
          let userId: string | null = null;
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
          });
          if (createErr) {
            // Se já existe, buscar por email
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const found = list?.users?.find((x) => x.email === u.email);
            userId = found?.id ?? null;
            if (userId) {
              await supabaseAdmin.auth.admin.updateUserById(userId, { password: u.password });
            }
          } else {
            userId = created.user?.id ?? null;
          }
          if (!userId) {
            results.push({ email: u.email, error: createErr?.message ?? "user not found" });
            continue;
          }
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: userId, role: u.role }, { onConflict: "user_id,role" });
          results.push({ email: u.email, userId, roleErr: roleErr?.message ?? null });
        }
        return new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
