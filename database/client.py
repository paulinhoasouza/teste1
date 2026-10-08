
import streamlit as st
from supabase import create_client, Client


def get_supabase() -> Client:
    """Cria uma conexão isolada por sessão Streamlit."""
    if "supabase_client" not in st.session_state:
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]

        st.session_state.supabase_client = create_client(
            url,
            key
        )

    return st.session_state.supabase_client


def login(email: str, senha: str):
    """Autentica um integrante da equipe."""
    cliente = get_supabase()

    resposta = cliente.auth.sign_in_with_password({
        "email": email,
        "password": senha
    })

    if not resposta.user or not resposta.session:
        raise ValueError("Não foi possível autenticar.")

    st.session_state.usuario = {
        "id": resposta.user.id,
        "email": resposta.user.email
    }

    return resposta.user


def usuario_atual():
    """Valida a sessão e obtém o usuário atual."""
    cliente = get_supabase()
    sessao = cliente.auth.get_session()

    if not sessao:
        st.session_state.pop("usuario", None)
        return None

    usuario = cliente.auth.get_user().user

    if usuario:
        st.session_state.usuario = {
            "id": usuario.id,
            "email": usuario.email
        }
        return usuario

    return None


def logout():
    """Encerra a sessão do usuário."""
    cliente = get_supabase()
    cliente.auth.sign_out()

    st.session_state.pop("usuario", None)
    st.session_state.pop("supabase_client", None)
