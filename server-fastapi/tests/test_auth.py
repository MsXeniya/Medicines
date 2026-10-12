def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json().get("message") == "FastAPI сервер работает"


def test_register_and_login_flow(client):
    # регистрация
    r = client.post("/api/auth/register", json={"username": "newuser", "password": "pwd"})
    assert r.status_code == 200
    data = r.json()
    assert data["message"] == "Пользователь зарегистрирован"
    assert data["user"]["username"] == "newuser"

    # вход
    r = client.post("/api/auth/login", json={"username": "newuser", "password": "pwd"})
    assert r.status_code == 200
    data = r.json()
    assert "accessToken" in data and "refreshToken" in data


def test_profile_requires_auth(client):
    r = client.get("/api/auth/profile")
    assert r.status_code == 401
