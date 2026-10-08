
import streamlit as st

from database.client import (
    get_supabase,
    login,
    usuario_atual,
    logout,
)
from pages.clientes import tela_clientes

st.set_page_config(
    page_title="Zetta | Gestão Comercial",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
.block-container {
    padding-top: 2rem;
    padding-bottom: 2rem;
}
[data-testid="stSidebar"] {
    background-color: #101827;
}
[data-testid="stSidebar"] * {
    color: #f8fafc;
}
</style>
""", unsafe_allow_html=True)


def tela_login():
    st.markdown("## ZETTA")
    st.caption("Sistema interno de gestão comercial")

    esquerda, centro, direita = st.columns([1, 1.3, 1])

    with centro:
        st.subheader("Entrar na plataforma")
        st.write("Utilize suas credenciais da Zetta.")

        with st.form("form_login"):
            email = st.text_input(
                "E-mail",
                placeholder="seuemail@empresa.com",
            )
            senha = st.text_input(
                "Senha",
                type="password",
            )
            entrar = st.form_submit_button(
                "Entrar",
                use_container_width=True,
                type="primary",
            )

        if entrar:
            if not email.strip() or not senha:
                st.warning("Preencha o e-mail e a senha.")
                return

            try:
                with st.spinner("Autenticando..."):
                    login(email.strip(), senha)
                st.rerun()
            except Exception:
                st.error(
                    "Não foi possível entrar. "
                    "Verifique suas credenciais e a conexão."
                )


def dashboard():
    st.title("Dashboard Comercial")
    st.write("Visão geral das operações da Zetta.")
    st.info(
        "Na próxima etapa, conectaremos os indicadores "
        "às tabelas do Supabase."
    )


def clientes():
    tela_clientes()


def solicitacoes():
    st.title("Gestão de Solicitações")
    st.write("Acompanhe as demandas e oportunidades comerciais.")
    st.info("Módulo em desenvolvimento.")


def propostas():
    st.title("Gestão de Propostas")
    st.write("Criação, edição e acompanhamento de propostas.")
    st.info("Módulo em desenvolvimento.")


def relatorios():
    st.title("Relatórios Comerciais")
    st.write("Análise de propostas, conversões e faturamento.")
    st.info("Os relatórios serão conectados aos dados reais.")


def configuracoes():
    st.title("Configurações")
    st.write("Informações da conta e do sistema.")

    usuario = st.session_state.get("usuario", {})
    st.write("E-mail:", usuario.get("email", "Não informado"))


def main():
    try:
        # Verifica se a conexão foi configurada
        get_supabase()

        # Verifica a autenticação no Supabase
        usuario = usuario_atual()

    except KeyError:
        st.error(
            "Credenciais do Supabase não configuradas. "
            "Configure SUPABASE_URL e SUPABASE_KEY "
            "nos Secrets do Streamlit."
        )
        st.stop()

    except Exception:
        st.error(
            "Não foi possível verificar a conexão ou "
            "a sessão com o Supabase."
        )
        st.stop()

    if usuario is None:
        tela_login()
        st.stop()

    with st.sidebar:
        st.title("ZETTA")
        st.caption("Gestão comercial")
        st.divider()

        pagina = st.radio(
            "Navegação",
            [
                "Dashboard",
                "Clientes",
                "Solicitações",
                "Propostas",
                "Relatórios",
                "Configurações",
            ],
            label_visibility="collapsed",
        )

        st.divider()
        st.caption(f"Conectado: {usuario.email}")

        if st.button(
            "Sair da conta",
            use_container_width=True,
        ):
            try:
                logout()
                st.rerun()
            except Exception:
                st.error("Erro ao encerrar a sessão.")

    paginas = {
        "Dashboard": dashboard,
        "Clientes": clientes,
        "Solicitações": solicitacoes,
        "Propostas": propostas,
        "Relatórios": relatorios,
        "Configurações": configuracoes,
    }

    paginas[pagina]()


if __name__ == "__main__":
    main()
