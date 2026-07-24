import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PostForm } from "@/components/talk/post-form";

const searchSchema = z.object({
  status: z.enum(["planning", "pending"]).default("pending"),
});

export const Route = createFileRoute("/_authenticated/clients/$clientId/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: NewPostPage,
});

function NewPostPage() {
  const { clientId } = Route.useParams();
  const { status } = Route.useSearch();
  const navigate = useNavigate();
  const isPlanning = status === "planning";
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">
        {isPlanning ? "Novo post em planejamento" : "Novo post"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isPlanning
          ? "Cadastre um rascunho — os campos podem ficar incompletos."
          : "Envie a mídia para aprovação do cliente."}
      </p>
      <div className="mt-8">
        <PostForm
          mode="create"
          clientId={clientId}
          initialStatus={status}
          onSaved={() =>
            navigate({
              to: "/clients/$clientId",
              params: { clientId },
              search: isPlanning ? { tab: "planning" } : { tab: "approval" },
            })
          }
        />
      </div>
    </div>
  );
}
