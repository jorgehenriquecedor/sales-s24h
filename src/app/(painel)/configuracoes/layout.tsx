import { exigirAdministradorPagina } from "@/lib/administrador";

export default async function LayoutConfiguracoes({ children }: { children: React.ReactNode }) {
  await exigirAdministradorPagina();
  return children;
}
