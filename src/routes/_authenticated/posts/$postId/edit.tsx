import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPost, deletePost } from "@/lib/admin.functions";
import { PostForm } from "@/components/talk/post-form";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/posts/$postId/edit")({
  component: EditPostPage,
});

function EditPostPage() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const getPostFn = useServerFn(getPost);
  const deleteFn = useServerFn(deletePost);

  const q = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPostFn({ data: { id: postId } }),
  });

  if (!q.data) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const post = q.data as any;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Editar post</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ao salvar, o post volta ao status pendente.
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={async () => {
            if (!confirm("Excluir este post?")) return;
            await deleteFn({ data: { id: postId } });
            toast.success("Post excluído.");
            navigate({
              to: "/clients/$clientId",
              params: { clientId: post.client.id },
            });
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {post.status === "rejected" && post.client_comment && (
        <div className="mt-6 rounded-xl border border-brand-purple/30 bg-brand-purple-soft p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
            Comentário do cliente
          </div>
          <p className="mt-1 text-sm text-brand-purple">{post.client_comment}</p>
        </div>
      )}

      <div className="mt-8">
        <PostForm
          mode="edit"
          postId={postId}
          initial={post}
          onSaved={() =>
            navigate({
              to: "/clients/$clientId",
              params: { clientId: post.client.id },
            })
          }
        />
      </div>
    </div>
  );
}
