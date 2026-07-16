import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PostForm } from "@/components/talk/post-form";

export const Route = createFileRoute("/_authenticated/clients/$clientId/new")({
  component: NewPostPage,
});

function NewPostPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Novo post</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Envie a mídia para aprovação do cliente.
      </p>
      <div className="mt-8">
        <PostForm
          mode="create"
          clientId={clientId}
          onSaved={() =>
            navigate({
              to: "/clients/$clientId",
              params: { clientId },
            })
          }
        />
      </div>
    </div>
  );
}
