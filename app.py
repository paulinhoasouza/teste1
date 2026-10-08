import streamlit as st
import pandas as pd
from datetime import datetime

# Configuração da página
st.set_page_config(page_title="Gestão de Orçamentos", page_icon="📊", layout="wide")

# Inicialização do estado da sessão (banco de dados em memória)
if "propostas" not in st.session_state:
    st.session_state.propostas = pd.DataFrame(
        columns=["ID", "Cliente", "Serviço/Produto", "Valor (R$)", "Status", "Data Emissão"]
    )

st.title("📊 Gestão de Orçamentos e Propostas")

# --- BARRA LATERAL: NOVO CADASTRO ---
st.sidebar.header("➕ Nova Proposta")
with st.sidebar.form("form_proposta", clear_on_submit=True):
    cliente = st.text_input("Nome do Cliente")
    servico = st.text_input("Serviço / Produto")
    valor = st.number_input("Valor Total (R$)", min_value=0.0, format="%.2f")
    status = st.selectbox("Status Inicial", ["Em Aberto", "Aprovado", "Recusado"])
    data_emissao = st.date_input("Data de Emissão", datetime.today())
    
    submitted = st.form_submit_button("Cadastrar Proposta")
    if submitted:
        if cliente and servico:
            novo_id = len(st.session_state.propostas) + 1
            nova_linha = {
                "ID": novo_id,
                "Cliente": cliente,
                "Serviço/Produto": servico,
                "Valor (R$)": valor,
                "Status": status,
                "Data Emissão": data_emissao.strftime("%Y-%m-%d")
            }
            st.session_state.propostas = pd.concat(
                [st.session_state.propostas, pd.DataFrame([nova_linha])], ignore_index=True
            )
            st.sidebar.success("Proposta cadastrada com sucesso!")
        else:
            st.sidebar.error("Preencha os campos de Cliente e Serviço.")

# --- PAINEL PRINCIPAL: MÉTRICAS ---
if not st.session_state.propostas.empty:
    df = st.session_state.propostas
    
    total_propostas = len(df)
    total_valor = df["Valor (R$)"].sum()
    aprovadas = df[df["Status"] == "Aprovado"]
    taxa_conversao = (len(aprovadas) / total_propostas) * 100 if total_propostas > 0 else 0

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total de Propostas", total_propostas)
    col2.metric("Valor Total", f"R$ {total_valor:,.2f}")
    col3.metric("Aprovadas", len(aprovadas))
    col4.metric("Taxa de Conversão", f"{taxa_conversao:.1f}%")

    st.markdown("---")

    # --- LISTAGEM E ATUALIZAÇÃO ---
    st.subheader("📋 Lista de Propostas")
    
    # Filtro por Status
    filtro_status = st.multiselect(
        "Filtrar por Status", 
        options=["Em Aberto", "Aprovado", "Recusado"],
        default=["Em Aberto", "Aprovado", "Recusado"]
    )
    
    df_filtrado = df[df["Status"].isin(filtro_status)]
    
    # Tabela editável (permite alterar o status diretamente)
    df_editado = st.data_editor(
        df_filtrado,
        column_config={
            "Status": st.column_config.SelectboxColumn(
                "Status",
                options=["Em Aberto", "Aprovado", "Recusado"],
                required=True
            )
        },
        disabled=["ID", "Cliente", "Serviço/Produto", "Valor (R$)", "Data Emissão"],
        hide_index=True,
        use_container_width=True
    )
    
    # Atualiza os dados alterados na tabela
    st.session_state.propostas.update(df_editado)

else:
    st.info("Nenhuma proposta cadastrada ainda. Utilize o menu lateral para adicionar a primeira.")
