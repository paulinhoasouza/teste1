"use client";

import { formatar } from "@/lib/dinheiro";
import type { Simulacao } from "@/lib/salario";

/** A conta do bruto ao líquido, linha por linha. */
export function QuadroSimulacao({ s, titulo = "Líquido simulado" }: { s: Simulacao; titulo?: string }) {
  return (
    <div className="caixa" aria-live="polite">
      <dl className="conta pequeno">
        <div><dt>Salário bruto</dt><dd className="num">{formatar(s.bruto)}</dd></div>
        {s.inss > 0 ? <div><dt>INSS</dt><dd className="num">−{formatar(s.inss)}</dd></div> : null}
        {s.inss > 0 || s.irrf > 0 ? (
          <div><dt>Imposto de renda</dt><dd className="num">{s.irrf > 0 ? `−${formatar(s.irrf)}` : "Isento"}</dd></div>
        ) : null}
        {s.outros > 0 ? <div><dt>Outros descontos</dt><dd className="num">−{formatar(s.outros)}</dd></div> : null}
        <div className="total"><dt>{titulo}</dt><dd className="num">{formatar(s.liquido)}</dd></div>
      </dl>
    </div>
  );
}
