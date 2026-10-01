/** ID da conta proprietária no projeto Sales-S24H. Não usa metadados editáveis. */
export function administrador(usuario: { id: string } | null) {
  return usuario?.id === (process.env.PAINEL_ADMIN_ID || "3c3b6215-7203-4c92-9fbb-d5b9c33447f8");
}
