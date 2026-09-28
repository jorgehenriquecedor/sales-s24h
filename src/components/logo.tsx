import Image from "next/image";

/** Marca oficial usada no painel e na página de acesso. */
export function Logo({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/logo.png"
        alt="Prova Oral"
        width={34}
        height={44}
        className="h-11 w-[34px] shrink-0 object-contain"
        priority
      />

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
