import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Saint Michel Construtora",
  description: "Cadastre seu interesse e receba atendimento da Saint Michel Construtora.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
