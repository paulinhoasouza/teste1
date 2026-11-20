import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "./globals.css";
import { SCRIPT_DE_TEMA } from "@/lib/tema";

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
};

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    // O script do tema muda atributos do <html> antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#efe8df" />
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DE_TEMA }} />
      </head>
      <body>
        <div className="ambiente" aria-hidden="true">
          <span className="luz-1" />
          <span className="luz-2" />
          <span className="luz-3" />
          <span className="halo-a" />
          <span className="halo-b" />
          <span className="feixes" />
          <span className="grao" />
        </div>
        {children}
      </body>
    </html>
  );
}
