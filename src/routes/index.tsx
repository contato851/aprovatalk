import { createFileRoute, Link } from "@tanstack/react-router";
import { TalkStar } from "@/components/talk/star";
import talkLogoAsset from "@/assets/talk-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-screen bg-background overflow-hidden">
      <TalkStar className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 text-brand-orange-soft" />
      <TalkStar className="pointer-events-none absolute bottom-[-8rem] left-[-6rem] h-80 w-80 text-brand-chartreuse-soft" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center">
          <img
            src={talkLogoAsset.url}
            alt="Talk"
            className="h-8 w-auto"
          />
        </div>
        <Link
          to="/auth"
          className="rounded-full border border-border bg-white/70 px-5 py-2 text-sm font-medium backdrop-blur hover:bg-white"
        >
          Entrar
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center md:py-32">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-orange/30 bg-brand-orange-soft px-4 py-1.5 text-xs font-medium text-brand-orange">
          <TalkStar className="h-3 w-3" />
          Aprovação de conteúdo
        </span>
        <h1 className="font-display text-5xl font-bold tracking-tight text-balance md:text-6xl">
          Posicionamento digital que passa pelo{" "}
          <span className="text-brand-purple">sim</span> do cliente.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          A Talk envia. O cliente aprova pelo celular. Tudo num feed limpo, com
          o mesmo cuidado do Instagram real.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/10 transition hover:bg-primary/90"
          >
            Acessar como Talk
          </Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Cliente? Acesse pelo link enviado pela sua consultoria.
        </p>
      </section>
    </main>
  );
}
