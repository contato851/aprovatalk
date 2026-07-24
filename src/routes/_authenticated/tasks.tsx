import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listTasks,
  listTeamMembers,
  createTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  getCurrentUserId,
  type TeamMember,
} from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Circle, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import biaAvatar from "@/assets/team/bia.jpg.asset.json";
import johnnyAvatar from "@/assets/team/johnny.jpg.asset.json";
import diandraAvatar from "@/assets/team/diandra.jpg.asset.json";

const AVATAR_BY_EMAIL: Record<string, string> = {
  "bia@talk.local": biaAvatar.url,
  "johnny@talk.local": johnnyAvatar.url,
  "diandra@talk.local": diandraAvatar.url,
};

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tarefas — Talk" },
      { name: "description", content: "Tarefas internas da equipe Talk" },
    ],
  }),
  component: TasksPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  start_time: string;
  end_time: string;
  participants: string[];
  status: "pending" | "done";
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_by: string | null;
};

type Filter = "all" | "pending" | "done";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatTime(t: string) {
  return t.slice(0, 5);
}

function isOverdue(t: Task) {
  if (t.status === "done") return false;
  const now = new Date();
  const [y, m, d] = t.task_date.split("-").map(Number);
  const [hh, mm] = t.end_time.split(":").map(Number);
  const end = new Date(y, m - 1, d, hh, mm);
  return end.getTime() < now.getTime();
}

function TasksPage() {
  const listTasksFn = useServerFn(listTasks);
  const listTeamFn = useServerFn(listTeamMembers);
  const qc = useQueryClient();

  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => listTasksFn() });
  const teamQ = useQuery({ queryKey: ["team-members"], queryFn: () => listTeamFn() });

  const [filter, setFilter] = useState<Filter>("all");
  const [participantFilter, setParticipantFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const setStatusFn = useServerFn(setTaskStatus);
  const deleteFn = useServerFn(deleteTask);

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: "pending" | "done" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
    },
  });

  const team = teamQ.data ?? [];
  const teamById = useMemo(
    () => Object.fromEntries(team.map((m) => [m.id, m])) as Record<string, TeamMember>,
    [team],
  );

  const filtered = useMemo(() => {
    const all = (tasksQ.data ?? []) as Task[];
    return all.filter((t) => {
      if (filter === "pending" && t.status !== "pending") return false;
      if (filter === "done" && t.status !== "done") return false;
      if (participantFilter !== "all" && !t.participants.includes(participantFilter))
        return false;
      return true;
    });
  }, [tasksQ.data, filter, participantFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Lista de tarefas internas da equipe.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="rounded-full"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "done"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "Todas" : f === "pending" ? "Pendentes" : "Concluídas"}
          </button>
        ))}
        <div className="ml-2 w-56">
          <Select value={participantFilter} onValueChange={setParticipantFilter}>
            <SelectTrigger className="h-8 rounded-full">
              <SelectValue placeholder="Participante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os participantes</SelectItem>
              {team.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {tasksQ.isLoading && (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        )}
        {!tasksQ.isLoading && filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa por aqui.
          </div>
        )}
        {filtered.map((t) => {
          const overdue = isOverdue(t);
          const rowClass =
            t.status === "done"
              ? "border-green-500/30 bg-green-500/10"
              : overdue
                ? "border-red-500/30 bg-red-500/10"
                : "border-yellow-500/30 bg-yellow-500/10";
          return (
            <div
              key={t.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between ${rowClass}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() =>
                    statusMut.mutate({
                      id: t.id,
                      status: t.status === "done" ? "pending" : "done",
                    })
                  }
                  disabled={statusMut.isPending}
                  className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                    t.status === "done"
                      ? "border-green-600/40 bg-green-600/10 text-green-700 hover:bg-green-600/20"
                      : "border-border text-muted-foreground hover:border-green-600/40 hover:bg-green-600/10 hover:text-green-700"
                  }`}
                  title={t.status === "done" ? "Reabrir tarefa" : "Marcar como concluída"}
                >
                  {t.status === "done" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Concluída
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" /> Concluir
                    </>
                  )}
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-semibold ${
                        t.status === "done"
                          ? "text-muted-foreground line-through"
                          : overdue
                            ? "text-orange-700"
                            : "text-foreground"
                      }`}
                    >
                      {t.title}
                    </h3>
                    {overdue && (
                      <Badge variant="outline" className="border-orange-500 text-orange-700">
                        Atrasada
                      </Badge>
                    )}
                    {t.status === "done" && t.completed_by_name && (
                      <span className="text-xs text-muted-foreground">
                        Concluída por {t.completed_by_name}
                        {t.completed_at
                          ? ` · ${new Date(t.completed_at).toLocaleDateString("pt-BR")}`
                          : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(t.task_date)} · {formatTime(t.start_time)}–
                    {formatTime(t.end_time)}
                  </div>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {t.participants.map((pid) => {
                    const m = teamById[pid];
                    if (!m) return null;
                    const avatar = AVATAR_BY_EMAIL[m.email.toLowerCase()];
                    return (
                      <div
                        key={pid}
                        title={m.name}
                        className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-foreground"
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={m.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials(m.name)
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    setEditing(t);
                    setDialogOpen(true);
                  }}
                  className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Excluir esta tarefa?")) deleteMut.mutate(t.id);
                  }}
                  className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={team}
        editing={editing}
      />
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  team,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team: TeamMember[];
  editing: Task | null;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [date, setDate] = useState(
    editing?.task_date ?? new Date().toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState(editing?.start_time?.slice(0, 5) ?? "09:00");
  const [endTime, setEndTime] = useState(editing?.end_time?.slice(0, 5) ?? "10:00");
  const [participants, setParticipants] = useState<string[]>(editing?.participants ?? []);

  // reset when opening for a new/different task
  useMemo(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setDescription(editing?.description ?? "");
      setDate(editing?.task_date ?? new Date().toISOString().slice(0, 10));
      setStartTime(editing?.start_time?.slice(0, 5) ?? "09:00");
      setEndTime(editing?.end_time?.slice(0, 5) ?? "10:00");
      setParticipants(editing?.participants ?? []);
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description?.trim() || null,
        task_date: date,
        start_time: startTime,
        end_time: endTime,
        participants,
      };
      if (editing) {
        return updateFn({ data: { id: editing.id, ...payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(editing ? "Tarefa atualizada" : "Tarefa criada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function toggleParticipant(id: string) {
    setParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Início</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Fim</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Convidados / Participantes</Label>
            <div className="mt-2 space-y-2 rounded-md border border-border p-3">
              {team.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum membro encontrado.</p>
              )}
              {team.map((m) => {
                const avatar = AVATAR_BY_EMAIL[m.email.toLowerCase()];
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={participants.includes(m.id)}
                      onCheckedChange={() => toggleParticipant(m.id)}
                    />
                    <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold">
                      {avatar ? (
                        <img src={avatar} alt={m.name} className="h-full w-full object-cover" />
                      ) : (
                        initials(m.name)
                      )}
                    </div>
                    <span>{m.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!title.trim() || saveMut.isPending}
          >
            {saveMut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
