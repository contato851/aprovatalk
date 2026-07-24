import { createFileRoute } from "@tanstack/react-router";
import { FluxoCalendar } from "@/components/talk/fluxo-calendar";

export const Route = createFileRoute("/_authenticated/fluxo")({
  head: () => ({
    meta: [
      { title: "Edição — Talk" },
      { name: "description", content: "Calendário mensal de entregas do editor de vídeo." },
    ],
  }),
  component: FluxoPage,
});

function FluxoPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Edição</h1>
        <p className="text-sm text-muted-foreground">
          Até 5 entregas por dia. Alterações salvam automaticamente.
        </p>
      </div>
      <FluxoCalendar />
    </div>
  );
}
