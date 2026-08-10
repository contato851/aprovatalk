import { useRef } from "react";
import { Bold, Italic, List, ListOrdered, Strikethrough } from "lucide-react";

/**
 * Textarea com barra de formatação simples (markdown leve).
 * O conteúdo continua sendo texto puro: **negrito**, _itálico_, ~~riscado~~, listas.
 */
export function RichTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  readOnly = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = value.slice(start, end) || "texto";
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + sel.length);
    });
  }

  function prefixLines(make: (i: number) => string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", end) === -1 ? value.length : value.indexOf("\n", end);
    const block = value.slice(lineStart, lineEnd) || "";
    const next =
      value.slice(0, lineStart) +
      block
        .split("\n")
        .map((l, i) => (l.startsWith(make(i)) ? l : make(i) + l.replace(/^([-*]\s|\d+\.\s)/, "")))
        .join("\n") +
      value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => el.focus());
  }

  return (
    <div className={`overflow-hidden rounded-md border border-input bg-background ${className}`}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/40 px-1 py-1">
          <TBtn label="Negrito" onClick={() => wrap("**")}>
            <Bold className="h-3.5 w-3.5" />
          </TBtn>
          <TBtn label="Itálico" onClick={() => wrap("_")}>
            <Italic className="h-3.5 w-3.5" />
          </TBtn>
          <TBtn label="Riscado" onClick={() => wrap("~~")}>
            <Strikethrough className="h-3.5 w-3.5" />
          </TBtn>
          <TBtn label="Lista" onClick={() => prefixLines(() => "- ")}>
            <List className="h-3.5 w-3.5" />
          </TBtn>
          <TBtn label="Lista numerada" onClick={() => prefixLines((i) => `${i + 1}. `)}>
            <ListOrdered className="h-3.5 w-3.5" />
          </TBtn>
        </div>
      )}
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y bg-transparent px-3 py-2 text-sm focus:outline-none read-only:bg-muted/40"
      />
    </div>
  );
}

function TBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Renderiza o markdown leve produzido pelo RichTextArea. */
export function FormattedText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-1 text-sm ${className}`}>
      {text.split("\n").map((line, i) => {
        const bullet = /^[-*]\s+/.test(line);
        const numbered = /^\d+\.\s+/.test(line);
        const content = line.replace(/^([-*]\s+|\d+\.\s+)/, "");
        return (
          <p key={i} className={bullet || numbered ? "flex gap-2" : "break-words"}>
            {(bullet || numbered) && (
              <span className="shrink-0 text-muted-foreground">
                {bullet ? "•" : line.match(/^\d+/)?.[0] + "."}
              </span>
            )}
            <span className="min-w-0 break-words">{inline(content)}</span>
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|~~[^~]+~~)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^~~[^~]+~~$/.test(p)) return <s key={i}>{p.slice(2, -2)}</s>;
    return <span key={i}>{p}</span>;
  });
}
