import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "A dois", template: "%s · A dois" },
  description: "Controle financeiro do casal: gastos, contas fixas e quem deve a quem.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "A dois", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f5f7",
};

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
