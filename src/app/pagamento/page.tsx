import Link from "next/link";

export default async function RetornoPagamento({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const mensagens: Record<string, string> = {
    concluido: "O pagamento foi enviado. A confirmação aparecerá no painel após o aviso do Asaas.",
    cancelado: "O checkout foi cancelado. Entre em contato com o vendedor para receber um novo link.",
    expirado: "Este checkout expirou. Solicite ao vendedor um novo link para a mesma venda.",
  };
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 text-center">
      <h1 className="serif text-3xl text-tinta">Pagamento</h1>
      <p className="mt-4 text-neutro">{mensagens[estado ?? ""] ?? "Consulte o vendedor sobre o pagamento."}</p>
      <Link className="mt-6 text-brasa underline" href="/login">Acessar painel</Link>
    </main>
  );
}
