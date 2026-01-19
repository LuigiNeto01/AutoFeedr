import google.generativeai as genai
from Escritor.src.utils import conectar_gemini, gerar_resposta


def main() -> None:
    # Pergunta basica para validar o modelo configurado.
    prompt = "O que e Python? Responda em uma frase curta."
    modelo = conectar_gemini()
    resposta = gerar_resposta(modelo, prompt)
    if not resposta:
        print("Falha ao obter resposta do Gemini.")
        print("Modelos disponiveis com generateContent:")
        for model in genai.list_models():
            if "generateContent" in model.supported_generation_methods:
                print(f"- {model.name}")
        return
    print("Resposta do Gemini:")
    print(resposta)


if __name__ == "__main__":
    main()
