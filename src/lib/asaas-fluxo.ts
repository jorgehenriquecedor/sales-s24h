import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { buscarCliente, buscarPagamento, cancelarCheckout, criarCheckout, type PagamentoAsaas } from "./asaas";
import { dadosCompradorAsaas } from "./comprador-asaas";
import { BUCKET_COMPROVANTES } from "./comprovante";

type VendaCheckout = {
  id: string;
  turma_nome: string;
  valor: number;
  pagamento_status: string;
  modo_venda: string;
  asaas_checkout_id: string | null;
  asaas_checkout_reserva: string | null;
  updated_at: string;
};

/** Reserva uma tentativa para impedir dois cliques de criarem dois checkouts. */
export async function gerarCheckout(vendaId: string) {
  const admin = adminClient();
  const { data: venda, error } = await admin.from("vendas")
    .select("id, turma_nome, valor, pagamento_status, modo_venda, asaas_checkout_id, asaas_checkout_reserva, updated_at")
    .eq("id", vendaId).single();
  if (error || !venda) throw new Error("Venda não encontrada.");
  const atual = venda as VendaCheckout;
  if (atual.modo_venda !== "checkout") throw new Error("Esta venda foi registrada sem checkout.");
  if (atual.asaas_checkout_reserva) {
    if (Date.now() - Date.parse(atual.updated_at) < 5 * 60_000) {
      throw new Error("A geração do checkout desta venda já está em andamento.");
    }
    const { data: liberada } = await admin.from("vendas")
      .update({ asaas_checkout_reserva: null })
      .eq("id", vendaId).eq("asaas_checkout_reserva", atual.asaas_checkout_reserva)
      .select("id, updated_at").maybeSingle();
    if (!liberada) throw new Error("Outra tentativa de checkout já foi iniciada.");
    atual.updated_at = liberada.updated_at;
  }
  if (!(["nao_monitorado", "expirada", "pendente"].includes(atual.pagamento_status)) ||
      (atual.pagamento_status === "pendente" && atual.asaas_checkout_id)) {
    throw new Error("Esta venda já tem um checkout ativo ou foi aprovada.");
  }

  const reserva = crypto.randomUUID();
  let claim = admin.from("vendas")
    .update({ asaas_checkout_reserva: reserva })
    .eq("id", vendaId)
    .eq("pagamento_status", atual.pagamento_status)
    .eq("updated_at", atual.updated_at)
    .is("asaas_checkout_reserva", null);
  claim = atual.asaas_checkout_id
    ? claim.eq("asaas_checkout_id", atual.asaas_checkout_id)
    : claim.is("asaas_checkout_id", null);
  const { data: reservada, error: erroReserva } = await claim.select("id").maybeSingle();
  if (erroReserva || !reservada) throw new Error("Outra tentativa de checkout já foi iniciada.");

  let novoId: string | null = null;
  try {
    const { data: itens, error: erroItens } = await admin.from("venda_itens")
      .select("produto_id, produto_nome, preco_unitario")
      .eq("venda_id", vendaId).order("ordem", { ascending: true });
    if (erroItens || !itens?.length) throw new Error("A venda não possui produtos vinculados.");
    const checkout = await criarCheckout({
      vendaId,
      turmaNome: atual.turma_nome,
      valor: Number(atual.valor),
      itens: itens.map((item) => ({
        produtoId: item.produto_id,
        nome: item.produto_nome,
        preco: Number(item.preco_unitario),
      })),
    });
    novoId = checkout.id;
    const expiraEm = new Date(Date.now() + 1440 * 60_000).toISOString();
    const { error: erroTentativa } = await admin.from("asaas_checkouts").insert({
      id: checkout.id, venda_id: vendaId, expira_em: expiraEm,
    });
    if (erroTentativa) throw new Error(`Não foi possível vincular o checkout: ${erroTentativa.message}`);

    const { data: atualizada, error: erroUpdate } = await admin.from("vendas")
      .update({
        pagamento_status: "pendente",
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkout.url,
        asaas_checkout_expira_em: expiraEm,
        asaas_checkout_reserva: null,
      })
      .eq("id", vendaId).eq("asaas_checkout_reserva", reserva)
      .neq("pagamento_status", "aprovada")
      .select("id").maybeSingle();
    if (erroUpdate || !atualizada) throw new Error("A venda mudou durante a criação do checkout.");
    return checkout;
  } catch (falha) {
    if (novoId) {
      try { await cancelarCheckout(novoId); } catch (erro) { console.error("Falha ao cancelar checkout sem vínculo", erro); }
      await admin.from("asaas_checkouts").update({ status: "cancelada" }).eq("id", novoId);
    }
    await admin.from("vendas").update({
      asaas_checkout_reserva: null,
      pagamento_status: atual.pagamento_status,
    })
      .eq("id", vendaId).eq("asaas_checkout_reserva", reserva);
    throw falha;
  }
}

type EventoAsaas = {
  id: string;
  event: string;
  checkout?: { id?: string; customer?: string | null };
  payment?: PagamentoAsaas & { externalReference?: string | null };
};

async function sincronizarComprador(vendaId: string, clienteId?: string | null) {
  // Falhas ficam sem confirmação do evento para que o webhook possa tentar novamente.
  if (!clienteId) throw new Error("O Asaas ainda não disponibilizou o cliente do checkout.");
  const cliente = await buscarCliente(clienteId);
  if (cliente.id !== clienteId) throw new Error("Cliente retornado pelo Asaas não corresponde ao pagamento.");
  const { error } = await adminClient().from("vendas")
    .update(dadosCompradorAsaas(cliente)).eq("id", vendaId).eq("modo_venda", "checkout");
  if (error) throw error;
}

function reciboConfiavel(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "asaas.com" || parsed.hostname.endsWith(".asaas.com"));
  } catch { return false; }
}

async function vincularRecibo(vendaId: string, pagamento: PagamentoAsaas) {
  const admin = adminClient();
  const url = pagamento.transactionReceiptUrl;
  const campos = { asaas_pagamento_id: pagamento.id, ...(url && reciboConfiavel(url) ? { asaas_comprovante_url: url } : {}) };
  const { error } = await admin.from("vendas").update(campos)
    .eq("id", vendaId).eq("pagamento_status", "aprovada");
  if (error) throw error;
  if (!url || !reciboConfiavel(url)) return;
  const { data: venda } = await admin.from("vendas")
    .select("comprovante_path").eq("id", vendaId).single();
  if (venda?.comprovante_path) return;

  // O Asaas pode devolver uma página HTML. Só anexamos arquivo real aceito pelo Storage.
  const resposta = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
  if (!resposta.ok) return;
  const tipo = resposta.headers.get("content-type")?.split(";")[0] ?? "";
  const extensoes: Record<string, string> = {
    "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  };
  const ext = extensoes[tipo];
  const tamanho = Number(resposta.headers.get("content-length") ?? 0);
  if (!ext || tamanho > 20 * 1024 * 1024) return;
  const bytes = await resposta.arrayBuffer();
  if (bytes.byteLength > 20 * 1024 * 1024) return;
  const path = `${vendaId}/asaas-${pagamento.id}.${ext}`;
  const { error: erroUpload } = await admin.storage.from(BUCKET_COMPROVANTES)
    .upload(path, bytes, { contentType: tipo, upsert: true });
  if (erroUpload) throw erroUpload;
  const { error: erroAnexo } = await admin.from("vendas")
    .update({ comprovante_path: path, comprovante_nome: `Comprovante Asaas.${ext}` })
    .eq("id", vendaId).eq("pagamento_status", "aprovada");
  if (erroAnexo) throw erroAnexo;
}

export async function processarEventoAsaas(evento: EventoAsaas) {
  const admin = adminClient();
  if (!evento.id || !evento.event) throw new Error("Evento Asaas inválido.");
  const { data: anterior } = await admin.from("asaas_eventos").select("id")
    .eq("id", evento.id).maybeSingle();
  if (anterior) return;

  const checkoutId = evento.checkout?.id;
  const recursoId = checkoutId ?? evento.payment?.id;
  if (!recursoId) throw new Error("Evento sem identificador de recurso.");

  if (["CHECKOUT_PAID", "CHECKOUT_EXPIRED", "CHECKOUT_CANCELED"].includes(evento.event)) {
    if (!checkoutId) throw new Error("Evento de checkout sem ID.");
    const { data: tentativa } = await admin.from("asaas_checkouts")
      .select("venda_id").eq("id", checkoutId).maybeSingle();
    if (!tentativa) throw new Error("Checkout ainda não vinculado à venda.");

    if (evento.event === "CHECKOUT_PAID") {
      const pagamento = await buscarPagamento(checkoutId);
      await sincronizarComprador(tentativa.venda_id, pagamento?.customer || evento.checkout?.customer);
      const { data: vendaAtual } = await admin.from("vendas")
        .select("asaas_checkout_id").eq("id", tentativa.venda_id).single();
      const { error } = await admin.from("asaas_checkouts")
        .update({ status: "aprovada", pago_em: new Date().toISOString() })
        .eq("id", checkoutId);
      if (error) throw error;
      const { error: erroVenda } = await admin.from("vendas")
        .update({ pagamento_status: "aprovada", asaas_checkout_reserva: null })
        .eq("id", tentativa.venda_id);
      if (erroVenda) throw erroVenda;
      if (vendaAtual?.asaas_checkout_id && vendaAtual.asaas_checkout_id !== checkoutId) {
        try {
          await cancelarCheckout(vendaAtual.asaas_checkout_id);
          await admin.from("asaas_checkouts").update({ status: "cancelada" })
            .eq("id", vendaAtual.asaas_checkout_id).eq("status", "pendente");
        } catch (erroCancelamento) {
          console.error("Checkout concorrente precisa de cancelamento", erroCancelamento);
        }
      }
      if (pagamento) await vincularRecibo(tentativa.venda_id, pagamento);
    } else {
      const status = evento.event === "CHECKOUT_EXPIRED" ? "expirada" : "cancelada";
      const { error } = await admin.from("asaas_checkouts")
        .update({ status }).eq("id", checkoutId).neq("status", "aprovada");
      if (error) throw error;
      const { error: erroVenda } = await admin.from("vendas")
        .update({ pagamento_status: "expirada" })
        .eq("id", tentativa.venda_id).eq("asaas_checkout_id", checkoutId)
        .eq("pagamento_status", "pendente");
      if (erroVenda) throw erroVenda;
    }
  } else if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(evento.event) && evento.payment) {
    const pagamento = evento.payment;
    let tentativa: { venda_id: string } | null = null;
    if (pagamento.checkoutSession) {
      const { data } = await admin.from("asaas_checkouts").select("venda_id")
        .eq("id", pagamento.checkoutSession).maybeSingle();
      tentativa = data;
    }
    if (!tentativa) {
      const { data } = await admin.from("vendas").select("id")
        .eq("asaas_pagamento_id", pagamento.id).maybeSingle();
      if (data) tentativa = { venda_id: data.id };
    }
    if (!tentativa && pagamento.externalReference) {
      const { data } = await admin.from("vendas").select("id, asaas_checkout_id")
        .eq("id", pagamento.externalReference).maybeSingle();
      if (data?.asaas_checkout_id) {
        const conferido = await buscarPagamento(data.asaas_checkout_id);
        if (conferido?.id === pagamento.id) tentativa = { venda_id: data.id };
      }
    }
    if (!tentativa) return;
    await sincronizarComprador(tentativa.venda_id, pagamento.customer);
    const { error } = await admin.from("vendas").update({ pagamento_status: "aprovada" })
      .eq("id", tentativa.venda_id);
    if (error) throw error;
    await vincularRecibo(tentativa.venda_id, pagamento);
  } else {
    return;
  }

  const { error: erroEvento } = await admin.from("asaas_eventos")
    .upsert({ id: evento.id, evento: evento.event, recurso_id: recursoId }, { onConflict: "id" });
  if (erroEvento) throw erroEvento;
}
