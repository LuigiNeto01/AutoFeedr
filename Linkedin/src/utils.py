import json
import os

def atualizar_dict_recursivo(destino, origem):
    """Atualiza um dicionário de forma recursiva, sem sobrescrever subníveis inteiros."""
    for chave, valor in origem.items():
        if isinstance(valor, dict) and isinstance(destino.get(chave), dict):
            atualizar_dict_recursivo(destino[chave], valor)
        else:
            destino[chave] = valor

def json_data(novos_dados, nome_arquivo="dados.json"):
    """
    Atualiza ou cria um JSON mantendo campos antigos,
    atualizando apenas o que foi passado.
    """
    try:
        print(f"Atualizando arquivo JSON: {nome_arquivo}")
        if os.path.exists(nome_arquivo):            
            with open(nome_arquivo, "r", encoding="utf-8") as f:
                dados = json.load(f)
        else:            
            dados = {}

        for chave, valor in novos_dados.items():
            if chave in dados and isinstance(dados[chave], dict) and isinstance(valor, dict):
                atualizar_dict_recursivo(dados[chave], valor)                
            else:
                dados[chave] = valor                

        with open(nome_arquivo, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=4)
        print("Arquivo JSON atualizado com sucesso.")
        
    except Exception as e:
        print(f"Falha ao atualizar JSON '{nome_arquivo}': {e}")
        raise

def ler_json(nome_arquivo="dados.json"):
    """Lê o arquivo JSON e retorna os dados. Se não existir, retorna um dicionário vazio."""
    if not os.path.exists(nome_arquivo):
        print(f"Arquivo JSON nao encontrado: {nome_arquivo}")
        return {}

    with open(nome_arquivo, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            print(f"Arquivo JSON carregado: {nome_arquivo}")
            return data
        except json.JSONDecodeError:
            print(f"Arquivo JSON invalido: {nome_arquivo}")
            return {}
