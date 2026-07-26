import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/tmp-reset-bia")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          "dc25fc3f-3765-4c36-9b4f-c65402e3ab4a",
          { password: "pinotnoir" },
        );
        if (error) return new Response(error.message, { status: 500 });
        return new Response(JSON.stringify({ ok: true, id: data.user?.id }));
      },
    },
  },
});
