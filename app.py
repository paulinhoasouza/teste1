
import streamlit as st

# Configuração principal
st.set_page_config(
    page_title="Zetta | Gestão Comercial",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Estilos
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

# Menu lateral
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
            "Configurações"
        ],
        label_visibility="collapsed"
    )

    st.divider()
    st.caption("Zetta | Sistema interno")

# Dashboard
if pagina == "Dashboard":
    st.title("Dashboard Comercial")
    st.write("Visão geral das operações comerciais da Zetta.")
    st.info("Os indicadores aparecerão após conectarmos o banco de dados.")

# Clientes
elif pagina == "Clientes":
    st.title("Gestão de Clientes")
    st.write("Cadastre, consulte e edite os clientes da empresa.")
    st.info("Módulo de clientes em preparação.")

# Solicitações
elif pagina == "Solicitações":
    st.title("Gestão de Solicitações")
    st.write("Acompanhe as oportunidades comerciais e demandas recebidas.")
    st.info("Módulo de solicitações em preparação.")

# Propostas
elif pagina == "Propostas":
    st.title("Gestão de Propostas")
    st.write("Crie, edite e acompanhe suas propostas comerciais.")
    st.info("Módulo de propostas em preparação.")

# Relatórios
elif pagina == "Relatórios":
    st.title("Relatórios Comerciais")
    st.write("Analise o desempenho comercial e os resultados da empresa.")
    st.info("Os relatórios serão habilitados após a integração.")

# Configurações
elif pagina == "Configurações":
    st.title("Configurações")
    st.write("Gerencie as configurações do aplicativo.")
    st.info("Configurações ainda não implementadas.")
