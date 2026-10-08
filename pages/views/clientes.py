
import streamlit as st
import pandas as pd

from services.clientes import (
    listar_clientes,
    criar_cliente,
    atualizar_cliente,
    excluir_cliente,
)


def formulario_cliente(cliente=None):
    cliente = cliente or {}

    with st.form("form_cliente"):
        nome = st.text_input(
            "Nome ou razão social *",
            value=cliente.get("nome") or "",
        )

        c1, c2 = st.columns(2)

        with c1:
            documento = st.text_input(
                "CPF/CNPJ",
                value=cliente.get("documento") or "",
            )
            telefone = st.text_input(
                "Telefone",
                value=cliente.get("telefone") or "",
            )

        with c2:
            email = st.text_input(
                "E-mail",
                value=cliente.get("email") or "",
            )
            contato = st.text_input(
                "Pessoa de contato",
                value=cliente.get("contato") or "",
            )

        observacoes = st.text_area(
            "Observações",
            value=cliente.get("observacoes") or "",
        )

        salvar = st.form_submit_button(
            "Salvar cliente",
            type="primary",
            use_container_width=True,
        )

    if salvar:
        dados = {
            "nome": nome,
            "documento": documento,
            "email": email,
            "telefone": telefone,
            "contato": contato,
            "observacoes": observacoes,
        }

        try:
            if cliente.get("id"):
                atualizar_cliente(cliente["id"], dados)
            else:
                criar_cliente(dados)

            st.success("Cliente salvo com sucesso!")
            st.rerun()

        except Exception as erro:
            st.error(f"Erro ao salvar: {erro}")


def tela_clientes():
    st.title("Gestão de Clientes")
    st.caption("Cadastre e gerencie os clientes da Zetta.")

    try:
        clientes = listar_clientes()
    except Exception as erro:
        st.error(f"Erro ao carregar clientes: {erro}")
        return

    aba1, aba2, aba3 = st.tabs([
        "Consultar clientes",
        "Novo cliente",
        "Editar / Excluir",
    ])

    with aba1:
        busca = st.text_input(
            "Pesquisar cliente",
            placeholder="Nome, documento, contato ou e-mail",
        )

        filtrados = [
            c for c in clientes
            if not busca or any(
                busca.casefold() in str(
                    c.get(campo) or ""
                ).casefold()
                for campo in (
                    "nome", "documento", "email",
                    "contato", "telefone"
                )
            )
        ]

        st.metric("Clientes encontrados", len(filtrados))

        if filtrados:
            df = pd.DataFrame(filtrados)

            colunas = [
                "nome", "documento", "contato",
                "email", "telefone"
            ]

            st.dataframe(
                df[colunas].rename(columns={
                    "nome": "Cliente",
                    "documento": "CPF/CNPJ",
                    "contato": "Contato",
                    "email": "E-mail",
                    "telefone": "Telefone",
                }),
                use_container_width=True,
                hide_index=True,
            )

            selecionado = st.selectbox(
                "Visualizar informações",
                options=filtrados,
                format_func=lambda c: c["nome"],
                key="visualizar_cliente",
            )

            if selecionado:
                with st.expander(
                    "Informações completas",
                    expanded=True,
                ):
                    st.write(
                        "**Cliente:**",
                        selecionado["nome"]
                    )
                    st.write(
                        "**Documento:**",
                        selecionado.get("documento") or "-"
                    )
                    st.write(
                        "**Contato:**",
                        selecionado.get("contato") or "-"
                    )
                    st.write(
                        "**E-mail:**",
                        selecionado.get("email") or "-"
                    )
                    st.write(
                        "**Telefone:**",
                        selecionado.get("telefone") or "-"
                    )
                    st.write(
                        "**Observações:**",
                        selecionado.get("observacoes") or "-"
                    )
        else:
            st.info("Nenhum cliente encontrado.")

    with aba2:
        st.subheader("Cadastrar novo cliente")
        formulario_cliente()

    with aba3:
        st.subheader("Gerenciar cliente")

        if not clientes:
            st.info("Cadastre um cliente primeiro.")
        else:
            escolhido = st.selectbox(
                "Selecione o cliente",
                options=clientes,
                format_func=lambda c: c["nome"],
                key="editar_cliente",
            )

            st.write("### Editar informações")
            formulario_cliente(escolhido)

            st.divider()
            st.write("### Excluir cliente")

            confirmar = st.checkbox(
                "Confirmo que desejo excluir este cliente",
                key=f"confirmar_{escolhido['id']}",
            )

            if st.button(
                "Excluir cliente",
                disabled=not confirmar,
                type="secondary",
            ):
                try:
                    excluir_cliente(escolhido["id"])
                    st.success("Cliente excluído.")
                    st.rerun()
                except Exception as erro:
                    st.error(f"Não foi possível excluir: {erro}")
