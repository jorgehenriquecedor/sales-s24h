export type ClienteAsaas = {
  id: string;
  name?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  phone?: string | null;
};

/** Converte os dados do cliente vinculado ao pagamento, sem inventar informações. */
export function dadosCompradorAsaas(cliente: ClienteAsaas) {
  const nome = cliente.name?.trim();
  if (!nome) throw new Error("O Asaas ainda não disponibilizou o nome do comprador.");
  return {
    comprador_nome: nome,
    comprador_email: cliente.email?.trim() ?? "",
    comprador_telefone: cliente.mobilePhone?.trim() || cliente.phone?.trim() || "",
  };
}
