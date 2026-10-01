/**
 * Ícones em traço fino, no mesmo peso visual do painel de referência.
 * Todos herdam `currentColor` e o tamanho vem do className.
 */
type Props = { className?: string };

function Base({ children, className }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? "h-[18px] w-[18px]"}
    >
      {children}
    </svg>
  );
}

export const IconePainel = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
);

export const IconeVendas = (p: Props) => (
  <Base {...p}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M17 7h4v4" />
  </Base>
);

export const IconeProduto = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7Z" />
    <path d="M3.5 8.5 12 13l8.5-4.5M12 13v7" />
  </Base>
);

export const IconeTurma = (p: Props) => (
  <Base {...p}>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 5.2a3.2 3.2 0 0 1 0 5.6" />
  </Base>
);

export const IconeDinheiro = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 12h.01M18 12h.01" />
  </Base>
);

export const IconeTicket = (p: Props) => (
  <Base {...p}>
    <path d="m3 16 5.5-5.5 3.5 3.5L21 5" />
    <path d="M15 5h6v6" />
  </Base>
);

export const IconeAlerta = (p: Props) => (
  <Base {...p}>
    <path d="M12 3.5 21 19H3l9-15.5Z" />
    <path d="M12 10v4M12 16.5h.01" />
  </Base>
);

export const IconeRecibo = (p: Props) => (
  <Base {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
    <path d="M9.5 8h5M9.5 12h5" />
  </Base>
);

export const IconeAnexo = (p: Props) => (
  <Base {...p}>
    <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.4-7.4" />
  </Base>
);

export const IconeBaixar = (p: Props) => (
  <Base {...p}>
    <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 20h16" />
  </Base>
);

export const IconeMais = (p: Props) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const IconeVoltar = (p: Props) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const IconeSair = (p: Props) => (
  <Base {...p}>
    <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
    <path d="M15 16.5 19.5 12 15 7.5M19.5 12H9" />
  </Base>
);

export const IconeConfiguracoes = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.5h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.5v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.5h-.1a1.7 1.7 0 0 0-1.6 1Z" />
  </Base>
);

export const IconeCadeado = (p: Props) => (
  <Base {...p}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Base>
);

export const IconePlug = (p: Props) => (
  <Base {...p}><path d="M9 7v5M15 7v5M7 12h10M12 12v8M8 20h8" /><path d="M7 4v3M17 4v3" /></Base>
);

export const IconeLixeira = (p: Props) => (
  <Base {...p}>
    <path d="M4 6.5h16M9.5 6.5V4.8A.8.8 0 0 1 10.3 4h3.4a.8.8 0 0 1 .8.8v1.7" />
    <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
  </Base>
);

export const IconeEditar = (p: Props) => (
  <Base {...p}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6.5 3 3" />
  </Base>
);

export const IconeArquivar = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
    <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
    <path d="M10 12.5h4" />
  </Base>
);

export const IconeFunil = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 5h17l-6.6 7.8v5.6l-3.8 2.2v-7.8L3.5 5Z" />
  </Base>
);

export const IconeVazio = (p: Props) => (
  <Base {...p}>
    <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5v-7Z" opacity="0.45" />
    <path d="M8.5 11.5h7" />
  </Base>
);
