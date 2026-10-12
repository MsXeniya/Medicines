import json


def get_tokens_for(client, username, password):
    # получить токены для пользователя
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200
    data = r.json()
    return data["accessToken"], data.get("refreshToken")


def auth_headers(token: str) -> dict:
    # заголовки авторизации с Bearer токеном
    return {"Authorization": f"Bearer {token}"}


def test_list_medicines_no_auth_returns_empty(client):
    # без авторизации список лекарств должен быть пуст
    r = client.get("/api/medicines")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0


def test_admin_can_list_all(client):
    # администратор может видеть все лекарства
    access, _ = get_tokens_for(client, "admin", "admin")
    r = client.get("/api/medicines", headers=auth_headers(access))
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1


def test_get_medicine_forbidden_for_other_user(client):
    # пользователь (id=2) владеет лекарством 100; попытка получить 101 должна быть запрещена
    access_user, _ = get_tokens_for(client, "user", "user")
    r = client.get("/api/medicines/101", headers=auth_headers(access_user))
    assert r.status_code == 403


def test_create_duplicate_medicine_conflict(client):
    access_user, _ = get_tokens_for(client, "user", "user")
    # создать дубликат существующего Aspirin в 08:00
    r = client.post("/api/medicines", json={"name": "Aspirin", "time": "08:00"}, headers=auth_headers(access_user))
    assert r.status_code == 409


def test_upload_file_without_s3_config_returns_503(client):
    # без конфигурации S3 загрузка должна вернуть 503
    access_admin, _ = get_tokens_for(client, "admin", "admin")
    files = {"file": ("test.txt", b"hello", "text/plain")}
    r = client.post("/api/medicines/101/files", files=files, headers=auth_headers(access_admin))
    assert r.status_code == 503


def test_external_weather_no_key_returns_503(client):
    # без API ключа запрос к внешнему API должен вернуть 503
    r = client.get("/api/external/weather?city=Noname")
    assert r.status_code == 503


def test_upload_and_download_flow_with_mocked_s3(client, monkeypatch):
    # активировать конфигурацию S3 и предоставить фейковый клиент
    monkeypatch.setenv("S3_BUCKET", "test-bucket")

    class FakeS3:
        def __init__(self):
            self.objects = {}

        def put_object(self, Bucket, Key, Body, ContentType):
            self.objects[Key] = {"Body": Body, "ContentType": ContentType}

        def generate_presigned_url(self, ClientMethod, Params, ExpiresIn):
            return f"https://s3.test/{Params['Key']}"

        def delete_object(self, Bucket, Key):
            self.objects.pop(Key, None)

    fake = FakeS3()

    def fake_get_s3_client():
        return fake

    monkeypatch.setattr("server_fastapi.main.get_s3_client", lambda: fake)
    monkeypatch.setattr("server_fastapi.main.S3_BUCKET", "test-bucket")

    access_admin, _ = get_tokens_for(client, "admin", "admin")
    files = {"file": ("test.txt", b"hello world", "text/plain")}
    r = client.post("/api/medicines/101/files", files=files, headers=auth_headers(access_admin))
    assert r.status_code == 201
    file_meta = r.json()
    assert file_meta["fileName"] == "test.txt"

    # получить ссылку для скачивания
    file_id = file_meta["id"]
    r = client.get(f"/api/medicines/101/files/{file_id}/download", headers=auth_headers(access_admin))
    assert r.status_code == 200
    data = r.json()
    assert data["url"].startswith("https://s3.test/")


def test_external_weather_success_monkeypatch(client, monkeypatch):
    # подменить OPENWEATHER_KEY и httpx.get
    monkeypatch.setenv("OPENWEATHER_KEY", "key")

    class FakeResp:
        def __init__(self, status_code, json_data):
            self.status_code = status_code
            self._json = json_data

        def json(self):
            return self._json

    def fake_get(url, params, timeout):
        return FakeResp(200, {"name": "TestCity", "main": {"temp": 10}, "weather": [{"description": "clear"}]})

    monkeypatch.setattr("server_fastapi.main.httpx.get", fake_get)

    r = client.get("/api/external/weather?city=TestCity")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["data"]["city"] == "TestCity"
