import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export type TeamMember = { id: string; name: string; email: string };

/** Lista membros da equipe (admins) — usa admin client apenas após verificar admin */
export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    await assertAdmin(context);
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw error;
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const members: TeamMember[] = [];
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id as string);
      if (!u?.user) continue;
      const meta = (u.user.user_metadata ?? {}) as Record<string, any>;
      const email = u.user.email ?? "";
      const nameFromMeta = meta.name || meta.full_name;
      const nameFromEmail = email.split("@")[0];
      const name = (nameFromMeta || nameFromEmail || "Usuário")
        .toString()
        .replace(/^./, (c: string) => c.toUpperCase());
      members.push({ id: id as string, name, email });
    }
    members.sort((a, b) => a.name.localeCompare(b.name));
    return members;
  });

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("tasks")
      .select("*")
      .order("task_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  task_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  participants: z.array(z.string().uuid()).default([]),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        title: data.title,
        description: data.description ?? null,
        task_date: data.task_date,
        start_time: data.start_time,
        end_time: data.end_time,
        participants: data.participants,
        created_by: context.userId,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    createSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update({
        title: rest.title,
        description: rest.description ?? null,
        task_date: rest.task_date,
        start_time: rest.start_time,
        end_time: rest.end_time,
        participants: rest.participants,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["pending", "done"]) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let completedByName: string | null = null;
    if (data.status === "done") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const meta = (u?.user?.user_metadata ?? {}) as Record<string, any>;
      const email = u?.user?.email ?? "";
      completedByName = (meta.name || meta.full_name || email.split("@")[0] || "Usuário")
        .toString()
        .replace(/^./, (c: string) => c.toUpperCase());
    }
    const update =
      data.status === "done"
        ? {
            status: "done",
            completed_by: context.userId,
            completed_by_name: completedByName,
            completed_at: new Date().toISOString(),
          }
        : {
            status: "pending",
            // manter histórico: não zeramos completed_by/name/at
          };
    const { data: row, error } = await context.supabase
      .from("tasks")
      .update(update)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });
