import { Casca } from "@/componentes/casca";
import { Provedor } from "@/componentes/provedor";
import { Marca } from "@/componentes/ui";
import { carregar, quemEstaUsando } from "@/lib/servidor/acesso";
import { ErroDeConfiguracao, exigeLogin } from "@/lib/servidor/ambiente";

export const dynamic = "force-dynamic";

export default async function LayoutDoApp({ children }: { children: React.ReactNode }) {
  let problema = "";
  try {
    const { dados } = await carregar();
    return (
      <Provedor inicial={dados} quemInicial={await quemEstaUsando()} temLogin={exigeLogin()}>
        <Casca>{children}</Casca>
      </Provedor>
    );
  } catch (e) {
    if (!(e instanceof ErroDeConfiguracao)) console.error("Falha ao abrir o app", e);
    problema =
      e instanceof ErroDeConfiguracao
        ? e.message
        : "Não foi possível ler os dados agora. Tente de novo em instantes.";
  }

  return (
    <main className="centro">
      <div className="centro-cartao">
        <Marca tamanho={48} />
        <div>
          <h1>Falta um ajuste para abrir</h1>
          <p className="mudo" style={{ marginTop: 8 }}>{problema}</p>
        </div>
        <p className="pequeno mudo">
          As variáveis ficam no painel da Vercel, em Settings, Environment Variables. Depois de mudar, faça um novo deploy.
        </p>
        <a className="botao primario alto largo" href="/">Tentar de novo</a>
      </div>
    </main>
  );
}
