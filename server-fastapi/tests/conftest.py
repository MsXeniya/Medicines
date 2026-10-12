import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import server_fastapi.main as main


@pytest.fixture(autouse=True)
def isolate_filesystem(tmp_path, monkeypatch):
    # Перенаправить хранилище данных во временные файлы для тестов
    users_path = tmp_path / "users.json"
    medicines_path = tmp_path / "medicines.json"

    # инициализировать минимальные данные: один админ и один пользователь
    users = [
        {"id": 1, "username": "admin", "password": "admin", "refreshToken": None, "role": "admin"},
        {"id": 2, "username": "user", "password": "user", "refreshToken": None, "role": "user"},
    ]
    medicines = [
        {"id": 100, "userId": 2, "name": "Aspirin", "time": "08:00", "taken": False, "createdAt": "2020-01-01T00:00:00Z", "files": []},
        {"id": 101, "userId": 1, "name": "AdminMed", "time": "09:00", "taken": True, "createdAt": "2020-01-02T00:00:00Z", "files": []},
    ]

    users_path.write_text(json.dumps(users, ensure_ascii=False, indent=2))
    medicines_path.write_text(json.dumps(medicines, ensure_ascii=False, indent=2))

    # Заменить пути в модуле
    monkeypatch.setattr(main, "USERS_PATH", Path(str(users_path)))
    monkeypatch.setattr(main, "MEDICINES_PATH", Path(str(medicines_path)))

    # Отключить S3 по умолчанию, чтобы избежать внешних вызовов
    monkeypatch.setenv("S3_BUCKET", "")

    yield


@pytest.fixture()
def client():
    from server_fastapi.main import app

    return TestClient(app)
