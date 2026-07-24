import { createFileRoute } from "@tanstack/react-router";
import { DesignCalendar } from "@/components/talk/design-calendar";

export const Route = createFileRoute("/_authenticated/design")({
  head: () => ({
    meta: [
      { title: "Design — Talk" },
      { name: "description", content: "Calendário mensal de entregas do time de design." },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Design</h1>
        <p className="text-sm text-muted-foreground">
          Até 5 entregas por dia. Briefing, copy e referências. Salva automaticamente.
        </p>
      </div>
      <DesignCalendar />
    </div>
  );
}
