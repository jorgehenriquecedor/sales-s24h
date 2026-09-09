import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--fonte-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--fonte-serif",
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Controle de Vendas | Prova Oral Suporte 24h",
  description:
    "Painel interno de controle de vendas, turmas e comprovantes de pagamento.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1626",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
