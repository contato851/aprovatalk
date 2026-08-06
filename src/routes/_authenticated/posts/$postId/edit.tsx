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
              search: { tab: "approval" },
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
          <p className="mt-1 whitespace-pre-line text-sm text-brand-purple">{post.client_comment}</p>
        </div>
      )}

      {post.type === "video" && (post.adjustment_points ?? []).length > 0 && (
        <div className="mt-6 rounded-xl border border-brand-orange/30 bg-brand-orange-soft p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-orange">
            Pontos de ajuste ({post.adjustment_points.length})
          </div>
          <ul className="mt-3 space-y-3">
            {post.adjustment_points.map((pt: any) => {
              const s = Math.max(0, Math.floor(Number(pt.time_seconds)));
              const mm = String(Math.floor(s / 60)).padStart(2, "0");
              const ss = String(s % 60).padStart(2, "0");
              return (
                <li
                  key={pt.id}
                  className="flex gap-3 rounded-lg border border-brand-orange/20 bg-background p-2"
                >
                  {pt.frame_signed_url ? (
                    <img
                      src={pt.frame_signed_url}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-brand-orange">
                      {mm}:{ss}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm">{pt.note}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}


      <div className="mt-8">
        <PostForm
          mode="edit"
          postId={postId}
          initial={post}
          onSaved={(status) =>
            navigate({
              to: "/clients/$clientId",
              params: { clientId: post.client.id },
              search: { tab: status === "planning" ? "planning" : "approval" },
            })
          }
        />
      </div>
    </div>
  );
}
