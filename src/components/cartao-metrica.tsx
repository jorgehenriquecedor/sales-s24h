import type { ReactNode } from "react";

type Tom = "azul" | "verde" | "roxo" | "vermelho";

const BLOBS: Record<Tom, string> = {
  azul: "bg-blob-azul",
  verde: "bg-blob-verde",
  roxo: "bg-blob-roxo",
  vermelho: "bg-blob-vermelho",
};

export function CartaoMetrica({
  icone,
  rotulo,
  valor,
  apoio,
  tom,
}: {
  icone: ReactNode;
  rotulo: string;
  valor: string;
  apoio: string;
  tom: Tom;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-borda bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full ${BLOBS[tom]}`}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-neutro">
          <span className="text-neutro-fraco">{icone}</span>
          <span className="rotulo-metrica">{rotulo}</span>
        </div>
        <p className="serif mt-2.5 text-[2rem] leading-none text-tinta tabular-nums">
          {valor}
        </p>
        <p className="mt-2 text-[13px] text-neutro">{apoio}</p>
      </div>
    </div>
  );
}
