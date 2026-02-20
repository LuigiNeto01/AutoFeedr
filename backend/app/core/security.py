from cryptography.fernet import Fernet


def build_fernet(token_encryption_key: str) -> Fernet:
    key = (token_encryption_key or "").strip()
    if not key:
        raise ValueError("TOKEN_ENCRYPTION_KEY nao configurada.")
    return Fernet(key.encode("utf-8"))


def encrypt_text(fernet: Fernet, value: str) -> str:
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_text(fernet: Fernet, encrypted_value: str) -> str:
    return fernet.decrypt(encrypted_value.encode("utf-8")).decode("utf-8")
