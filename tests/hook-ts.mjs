// Deixa o Node resolver imports sem extensão (".../filtros" -> ".../filtros.ts"),
// que é o que o bundler do Next faz, para testar os arquivos-fonte de verdade.
export async function resolve(especificador, contexto, proximo) {
  try {
    return await proximo(especificador, contexto);
  } catch (erro) {
    if (especificador.startsWith(".") || especificador.startsWith("/")) {
      return await proximo(`${especificador}.ts`, contexto);
    }
    throw erro;
  }
}
