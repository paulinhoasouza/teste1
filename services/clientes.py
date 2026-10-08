
from database.client import get_supabase


def listar_clientes():
    db = get_supabase()

    resultado = (
        db.table("clientes")
        .select("*")
        .order("nome")
        .execute()
    )

    return resultado.data or []


def buscar_cliente(cliente_id):
    db = get_supabase()

    resultado = (
        db.table("clientes")
        .select("*")
        .eq("id", cliente_id)
        .single()
        .execute()
    )

    return resultado.data


def criar_cliente(dados):
    nome = (dados.get("nome") or "").strip()

    if not nome:
        raise ValueError("O nome do cliente é obrigatório.")

    payload = {
        "nome": nome,
        "documento": (dados.get("documento") or "").strip(),
        "email": (dados.get("email") or "").strip(),
        "telefone": (dados.get("telefone") or "").strip(),
        "contato": (dados.get("contato") or "").strip(),
        "observacoes": (dados.get("observacoes") or "").strip(),
    }

    db = get_supabase()

    resultado = (
        db.table("clientes")
        .insert(payload)
        .execute()
    )

    return resultado.data


def atualizar_cliente(cliente_id, dados):
    nome = (dados.get("nome") or "").strip()

    if not nome:
        raise ValueError("O nome do cliente é obrigatório.")

    payload = {
        "nome": nome,
        "documento": (dados.get("documento") or "").strip(),
        "email": (dados.get("email") or "").strip(),
        "telefone": (dados.get("telefone") or "").strip(),
        "contato": (dados.get("contato") or "").strip(),
        "observacoes": (dados.get("observacoes") or "").strip(),
    }

    db = get_supabase()

    resultado = (
        db.table("clientes")
        .update(payload)
        .eq("id", cliente_id)
        .execute()
    )

    return resultado.data


def excluir_cliente(cliente_id):
    db = get_supabase()

    # Evita excluir clientes com solicitações vinculadas.
    vinculadas = (
        db.table("solicitacoes")
        .select("id")
        .eq("cliente_id", cliente_id)
        .limit(1)
        .execute()
    )

    if vinculadas.data:
        raise ValueError(
            "Este cliente possui solicitações vinculadas "
            "e não pode ser excluído."
        )

    resultado = (
        db.table("clientes")
        .delete()
        .eq("id", cliente_id)
        .execute()
    )

    return resultado.data
