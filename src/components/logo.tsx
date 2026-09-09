/**
 * Marca "Prova Oral — Suporte 24h" usada no topo da sidebar.
 *
 * O arquivo original da logo não chegou junto com o briefing, então o símbolo
 * abaixo é uma reconstrução vetorial fiel ao painel de referência. Para trocar
 * pelo arquivo oficial, coloque-o em `public/logo.svg` e substitua o <svg> por
 * <img src="/logo.svg" alt="Prova Oral" className="h-8 w-8" />.
 */
export function Logo({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
        role="img"
        aria-label="Prova Oral"
      >
        <path
          d="M5 4h16.5a1.5 1.5 0 0 1 1.5 1.5V22a1.5 1.5 0 0 1-1.5 1.5H12l-7 5.5V4Z"
          fill="#ffffff"
        />
        <path d="M23 9.5h4v13.2L23 19.4V9.5Z" fill="#ffffff" opacity="0.55" />
      </svg>

      {!compacta && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight text-white">
            Prova Oral
          </span>
          <span className="mt-1 block text-[9.5px] font-medium tracking-[0.18em] text-navy-texto uppercase">
            Suporte 24h
          </span>
        </span>
      )}
    </div>
  );
}
