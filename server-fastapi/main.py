from datetime import datetime, timedelta, timezone
from enum import Enum
import json
import os
from pathlib import Path
import re
from typing import Literal, Optional
from uuid import uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, PlainTextResponse, JSONResponse
import httpx
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel, Field, model_validator


#настройки JWT
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
SECRET_KEY = "secretkey"
REFRESH_SECRET_KEY = "refresh_secret"
ALGORITHM = "HS256"
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")
S3_REGION = os.getenv("S3_REGION", "us-east-1")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY")
S3_USE_SSL = os.getenv("S3_USE_SSL", "false").lower() == "true"

MAX_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_FILE_TYPES = {
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
}

s3_client = None


#объявление ролей(RBAC)
class Role(str, Enum):
    guest = "guest"
    user = "user"
    admin = "admin"


class Permission(str, Enum):
    medicines_read = "medicines:read"
    medicines_create = "medicines:create"
    medicines_take_own = "medicines:take:own"
    medicines_take_any = "medicines:take:any"
    medicines_delete_own = "medicines:delete:own"
    medicines_delete_any = "medicines:delete:any"
    profile_read = "profile:read"
    role_manage = "users:role:manage"


#матрица роль-разрешение
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.guest: {
        Permission.medicines_read,
    },
    Role.user: {
        Permission.medicines_read,
        Permission.medicines_create,
        Permission.medicines_take_own,
        Permission.medicines_delete_own,
        Permission.profile_read,
    },
    Role.admin: {
        Permission.medicines_read,
        Permission.medicines_create,
        Permission.medicines_take_any,
        Permission.medicines_delete_any,
        Permission.profile_read,
        Permission.role_manage,
    },
}


# Пути к JSON-хранилищам
ROOT_DIR = Path(__file__).resolve().parent.parent
# Позволяем переопределять пути через переменные среды для безопасного тестирования
USERS_PATH = Path(os.getenv("SERVER_USERS_PATH", str(ROOT_DIR / "server" / "data" / "users.json")))
MEDICINES_PATH = Path(os.getenv("SERVER_MEDICINES_PATH", str(ROOT_DIR / "server" / "data" / "medicines.json")))


#Pydantic схемы запросов
class RegisterPayload(BaseModel):
    username: str = Field(min_length=2)
    password: str = Field(min_length=3)


class LoginPayload(BaseModel):
    username: str
    password: str


class RefreshPayload(BaseModel):
    refreshToken: str


class MedicineCreatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    time: str = Field(pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")


class MedicineUpdatePayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    time: Optional[str] = Field(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$")
    taken: Optional[bool] = None

    @model_validator(mode="after")
    def validate_non_empty_update(self):
        if self.name is None and self.time is None and self.taken is None:
            raise ValueError("Нужно передать хотя бы одно поле для обновления")
        return self


class RoleUpdatePayload(BaseModel):
    role: Role


class TokenUser(BaseModel):
    id: int
    username: str
    role: Role


# работа с JSON
def load_json(path: Path) -> list:
    if path.exists():
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    return []


def save_json(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def normalize_user_roles() -> None:
    """
    - если role отсутствует -> role=user
    - если в базе нет ни одного admin -> делаем первого пользователя admin
    """
    users = load_json(USERS_PATH)
    changed = False

    for user in users:
        role = user.get("role")
        if role not in {r.value for r in Role}:
            user["role"] = Role.user.value
            changed = True

    if users and all(u.get("role") != Role.admin.value for u in users):
        users[0]["role"] = Role.admin.value
        changed = True

    if changed:
        save_json(USERS_PATH, users)


def normalize_medicines() -> None:
    medicines = load_json(MEDICINES_PATH)
    changed = False

    for medicine in medicines:
        if "createdAt" not in medicine:
            medicine["createdAt"] = datetime.now(timezone.utc).isoformat()
            changed = True
        if "files" not in medicine or not isinstance(medicine.get("files"), list):
            medicine["files"] = []
            changed = True

    if changed:
        save_json(MEDICINES_PATH, medicines)


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def parse_time_to_minutes(value: str) -> int:
    match = TIME_PATTERN.match(value)
    if not match:
        return -1
    hours = int(match.group(1))
    minutes = int(match.group(2))
    return hours * 60 + minutes


def medicine_sort_value(medicine: dict, sort_by: str):
    if sort_by == "time":
        return parse_time_to_minutes(str(medicine.get("time", "00:00")))
    if sort_by == "taken":
        return 1 if medicine.get("taken") else 0
    if sort_by == "createdAt":
        return str(medicine.get("createdAt", ""))
    return str(medicine.get("name", "")).lower()


def can_manage_medicine(user: TokenUser, medicine: dict) -> bool:
    can_take_any = user.role == Role.admin and has_permission(user.role, Permission.medicines_take_any)
    can_take_own = has_permission(user.role, Permission.medicines_take_own) and medicine.get("userId") == user.id
    return can_take_any or can_take_own


def can_delete_medicine(user: TokenUser, medicine: dict) -> bool:
    can_delete_any = user.role == Role.admin and has_permission(user.role, Permission.medicines_delete_any)
    can_delete_own = has_permission(user.role, Permission.medicines_delete_own) and medicine.get("userId") == user.id
    return can_delete_any or can_delete_own


def get_medicine_by_id(medicine_id: int) -> tuple[list, Optional[dict]]:
    medicines = load_json(MEDICINES_PATH)
    medicine = next((m for m in medicines if m.get("id") == medicine_id), None)
    return medicines, medicine


def get_s3_client():
    global s3_client
    if s3_client is not None:
        return s3_client

    if not S3_BUCKET or not S3_ACCESS_KEY_ID or not S3_SECRET_ACCESS_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 не настроен. Укажите S3_BUCKET, S3_ACCESS_KEY_ID и S3_SECRET_ACCESS_KEY",
        )

    s3_client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        use_ssl=S3_USE_SSL,
    )
    return s3_client


def ensure_bucket_exists() -> None:
    if not S3_BUCKET:
        return
    try:
        client = get_s3_client()
        client.head_bucket(Bucket=S3_BUCKET)
    except ClientError:
        client.create_bucket(Bucket=S3_BUCKET)


def delete_file_object_safe(object_key: str) -> None:
    if not S3_BUCKET:
        return
    try:
        client = get_s3_client()
        client.delete_object(Bucket=S3_BUCKET, Key=object_key)
    except (HTTPException, BotoCoreError, ClientError):
        pass



def create_token(payload: dict, secret: str, expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret, algorithm=ALGORITHM)


def decode_token(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недействительный токен",
        ) from error


def get_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1]



def get_optional_current_user(
    authorization: Optional[str] = Header(default=None), 
) -> Optional[TokenUser]:
    token = get_bearer_token(authorization)
    if not token: 
        return None

    payload = decode_token(token, SECRET_KEY)
    role_value = payload.get("role", Role.user.value)
    role = Role(role_value) if role_value in {r.value for r in Role} else Role.user

    return TokenUser(id=payload["id"], username=payload["username"], role=role)


def get_current_user(user: Optional[TokenUser] = Depends(get_optional_current_user)) -> TokenUser:
    """
    пользователь обязан быть авторизован.
    """
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Токен не предоставлен")
    return user


def require_permission(permission: Permission):
    """
    Универсальный guard для проверки конкретного права
    """

    def dependency(user: TokenUser = Depends(get_current_user)) -> TokenUser:
        if not has_permission(user.role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
        return user

    return dependency


#приложение
app = FastAPI(title="Medicines API (FastAPI + RBAC)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    #на старте привожу пользователей к новой модели ролей
    normalize_user_roles()
    normalize_medicines()
    ensure_bucket_exists()


@app.get("/")
def root() -> dict:
    return {"message": "FastAPI сервер работает"}


#Auth endpoints
@app.post("/api/auth/register")
def register(payload: RegisterPayload) -> dict:
    users = load_json(USERS_PATH) #создается автоматически только юзер при регистрации нового аккаунта

    if any(user["username"] == payload.username for user in users):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Такой пользователь уже существует")

    new_user = {
        "id": int(datetime.now().timestamp() * 1000),
        "username": payload.username,
        "password": payload.password,
        "refreshToken": None,
        "role": Role.user.value,
    }

    users.append(new_user)
    save_json(USERS_PATH, users)

    safe_user = {k: v for k, v in new_user.items() if k not in {"password", "refreshToken"}}
    return {"message": "Пользователь зарегистрирован", "user": safe_user}


@app.post("/api/auth/login")
def login(payload: LoginPayload) -> dict:
    users = load_json(USERS_PATH)
    user = next(
        (u for u in users if u["username"] == payload.username and u["password"] == payload.password),
        None,
    )

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные данные")

    role_value = user.get("role", Role.user.value)
    role = Role(role_value) if role_value in {r.value for r in Role} else Role.user

    token_payload = {
        "id": user["id"],
        "username": user["username"],
        "role": role.value,
    }

    access_token = create_token(
        payload=token_payload,
        secret=SECRET_KEY,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        payload=token_payload,
        secret=REFRESH_SECRET_KEY,
        expires_delta=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )

    user["refreshToken"] = refresh_token
    save_json(USERS_PATH, users)

    return {
        "message": "Успешный вход",
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "role": role.value,
        "permissions": [permission.value for permission in ROLE_PERMISSIONS[role]],
    }


@app.post("/api/auth/refresh")
def refresh(payload: RefreshPayload) -> dict:
    users = load_json(USERS_PATH)
    user = next((u for u in users if u.get("refreshToken") == payload.refreshToken), None)

    if user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Неверный refresh токен")

    decode_token(payload.refreshToken, REFRESH_SECRET_KEY)

    role_value = user.get("role", Role.user.value)
    role = Role(role_value) if role_value in {r.value for r in Role} else Role.user

    new_access_token = create_token(
        payload={"id": user["id"], "username": user["username"], "role": role.value},
        secret=SECRET_KEY,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"accessToken": new_access_token}


@app.post("/api/auth/logout")
def logout(user: TokenUser = Depends(get_current_user)) -> dict:
    """
    Отзываю refresh token пользователя
    """
    users = load_json(USERS_PATH)
    found = next((u for u in users if u["id"] == user.id), None)

    if found is not None:
        found["refreshToken"] = None
        save_json(USERS_PATH, users)

    return {"message": "Успешный выход"}


@app.get("/api/auth/profile")
def profile(user: TokenUser = Depends(require_permission(Permission.profile_read))) -> dict:
    users = load_json(USERS_PATH)
    found = next((u for u in users if u["id"] == user.id), None)

    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    role_value = found.get("role", Role.user.value)
    role = Role(role_value) if role_value in {r.value for r in Role} else Role.user

    safe_user = {
        "id": found["id"],
        "username": found["username"],
        "role": role.value,
        "permissions": [permission.value for permission in ROLE_PERMISSIONS[role]],
    }
    return {"user": safe_user}


# Medicines endpoints
@app.get("/api/medicines")
def list_medicines(
    search: str = Query(default="", max_length=120),
    taken: Optional[bool] = Query(default=None),
    time_from: Optional[str] = Query(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$"),
    time_to: Optional[str] = Query(default=None, pattern=r"^([01]\d|2[0-3]):([0-5]\d)$"),
    sort_by: Literal["name", "time", "taken", "createdAt"] = Query(default="createdAt"),
    sort_order: Literal["asc", "desc"] = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=5, ge=1, le=50),
    user: Optional[TokenUser] = Depends(get_optional_current_user),
) -> dict:
    # ЗАГРУЗКА данных
    medicines = load_json(MEDICINES_PATH)
    owned_medicines = [
        medicine
        for medicine in medicines
        if medicine.get("userId") is not None
    ]

    if user is None:
        return {"items": [], "total": 0, "page": page, "pageSize": page_size, "totalPages": 0}

    # админ видит все записи, обычный пользователь только свои
    if user.role == Role.admin:
        scoped_medicines = owned_medicines
    else:
        scoped_medicines = [
            medicine
            for medicine in owned_medicines
            if medicine.get("userId") == user.id
        ]

    filtered = scoped_medicines

    #ФИЛЬТРАЦИЯ 
    normalized_search = search.strip().lower()
    if normalized_search:
        filtered = [
            medicine
            for medicine in filtered
            if normalized_search in str(medicine.get("name", "")).lower()
            or normalized_search in str(medicine.get("time", "")).lower()
        ]

    #ФИЛЬТР ПО СТАТУСУ (принято/ожидание)
    if taken is not None:
        filtered = [medicine for medicine in filtered if bool(medicine.get("taken")) is taken]

    #ФИЛЬТР ПО ВРЕМЕНИ "ОТ"
    if time_from is not None:
        from_minutes = parse_time_to_minutes(time_from)
        filtered = [
            medicine
            for medicine in filtered
            if parse_time_to_minutes(str(medicine.get("time", "00:00"))) >= from_minutes
        ]

    #ФИЛЬТР ПО ВРЕМЕНИ "ДО"
    if time_to is not None:
        to_minutes = parse_time_to_minutes(time_to)
        filtered = [
            medicine
            for medicine in filtered
            if parse_time_to_minutes(str(medicine.get("time", "00:00"))) <= to_minutes
        ]

    #СОРТИРОВКА 
    reverse = sort_order == "desc"
    filtered.sort(key=lambda m: medicine_sort_value(m, sort_by), reverse=reverse)

    # ПАГИНАЦИЯ
    total = len(filtered)
    total_pages = (total + page_size - 1) // page_size

    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    page_items = filtered[start_index:end_index]

    return {
        "items": page_items,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
    }


@app.get("/api/medicines/{medicine_id}")
def get_medicine(medicine_id: int, user: TokenUser = Depends(get_current_user)) -> dict:
    _, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if user.role != Role.admin and medicine.get("userId") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    return medicine


@app.post("/api/medicines", status_code=status.HTTP_201_CREATED)
def create_medicine(
    payload: MedicineCreatePayload,
    user: TokenUser = Depends(require_permission(Permission.medicines_create)),
) -> dict:
    medicines = load_json(MEDICINES_PATH)

    duplicate = next(
        (
            m
            for m in medicines
            if m.get("userId") == user.id
            and str(m.get("name", "")).strip().lower() == payload.name.strip().lower()
            and m.get("time") == payload.time
        ),
        None,
    )

    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Такая запись уже существует")

    new_medicine = {
        "id": int(datetime.now().timestamp() * 1000),
        "userId": user.id,
        "name": payload.name.strip(),
        "time": payload.time,
        "taken": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": [],
    }

    medicines.append(new_medicine)
    save_json(MEDICINES_PATH, medicines)

    return new_medicine


@app.put("/api/medicines/{medicine_id}")
def update_medicine(
    medicine_id: int,
    payload: MedicineUpdatePayload,
    user: TokenUser = Depends(get_current_user),
) -> dict:
    medicines, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if not can_manage_medicine(user, medicine):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    next_name = payload.name.strip() if payload.name is not None else str(medicine.get("name", "")).strip()
    next_time = payload.time if payload.time is not None else medicine.get("time")

    duplicate = next(
        (
            m
            for m in medicines
            if m.get("id") != medicine_id
            and m.get("userId") == medicine.get("userId")
            and str(m.get("name", "")).strip().lower() == next_name.lower()
            and m.get("time") == next_time
        ),
        None,
    )
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Запись с такими данными уже существует")

    if payload.name is not None:
        medicine["name"] = next_name
    if payload.time is not None:
        medicine["time"] = payload.time
    if payload.taken is not None:
        medicine["taken"] = payload.taken

    save_json(MEDICINES_PATH, medicines)
    return medicine


@app.put("/api/medicines/{medicine_id}/take")
def take_medicine(medicine_id: int, user: TokenUser = Depends(get_current_user)) -> dict:
    medicines, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if not can_manage_medicine(user, medicine):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    medicine["taken"] = not medicine.get("taken", False)

    save_json(MEDICINES_PATH, medicines)
    return medicine


@app.delete("/api/medicines/{medicine_id}")
def delete_medicine(medicine_id: int, user: TokenUser = Depends(get_current_user)) -> dict:
    medicines, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if not can_delete_medicine(user, medicine):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    for file_meta in medicine.get("files", []):
        object_key = file_meta.get("objectKey")
        if object_key:
            delete_file_object_safe(object_key)

    updated_medicines = [m for m in medicines if m.get("id") != medicine_id]
    save_json(MEDICINES_PATH, updated_medicines)

    return {"message": "Удалено"}


@app.post("/api/medicines/{medicine_id}/files", status_code=status.HTTP_201_CREATED)
async def upload_medicine_file(
    medicine_id: int,
    file: UploadFile = File(...),
    user: TokenUser = Depends(get_current_user),
) -> dict:
    medicines, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if not can_manage_medicine(user, medicine):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый тип файла")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл превышает лимит 5 MB")

    file_id = uuid4().hex
    safe_filename = Path(file.filename or "file.bin").name
    object_key = f"medicines/{medicine_id}/{file_id}-{safe_filename}"

    try:
        client = get_s3_client()
        client.put_object(
            Bucket=S3_BUCKET,
            Key=object_key,
            Body=raw_bytes,
            ContentType=file.content_type,
        )
    except (HTTPException, BotoCoreError, ClientError) as error:
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ошибка загрузки файла") from error

    file_meta = {
        "id": file_id,
        "fileName": safe_filename,
        "size": len(raw_bytes),
        "contentType": file.content_type,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "objectKey": object_key,
    }
    medicine.setdefault("files", []).append(file_meta)
    save_json(MEDICINES_PATH, medicines)

    return file_meta


@app.get("/api/medicines/{medicine_id}/files/{file_id}/download")
def get_medicine_file_download_url(
    medicine_id: int,
    file_id: str,
    user: TokenUser = Depends(get_current_user),
) -> dict:
    _, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if user.role != Role.admin and medicine.get("userId") != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    file_meta = next((item for item in medicine.get("files", []) if item.get("id") == file_id), None)
    if file_meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    try:
        client = get_s3_client()
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": file_meta["objectKey"]},
            ExpiresIn=600,
        )
    except (HTTPException, BotoCoreError, ClientError) as error:
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ошибка получения ссылки") from error

    return {"url": url, "expiresIn": 600, "fileName": file_meta.get("fileName")}


@app.delete("/api/medicines/{medicine_id}/files/{file_id}")
def delete_medicine_file(
    medicine_id: int,
    file_id: str,
    user: TokenUser = Depends(get_current_user),
) -> dict:
    medicines, medicine = get_medicine_by_id(medicine_id)

    if medicine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лекарство не найдено")

    if not can_delete_medicine(user, medicine):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")

    files = medicine.get("files", [])
    file_meta = next((item for item in files if item.get("id") == file_id), None)
    if file_meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")

    delete_file_object_safe(file_meta.get("objectKey", ""))
    medicine["files"] = [item for item in files if item.get("id") != file_id]
    save_json(MEDICINES_PATH, medicines)

    return {"message": "Файл удален"}


#Admin endpoint управления ролями
@app.get("/api/admin/users")
def admin_list_users(_: TokenUser = Depends(require_permission(Permission.role_manage))) -> dict:
    users = load_json(USERS_PATH)
    cleaned_users = [
        {"id": user["id"], "username": user["username"], "role": user.get("role", Role.user.value)}
        for user in users
    ]
    return {"users": cleaned_users}


@app.patch("/api/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    payload: RoleUpdatePayload,
    _: TokenUser = Depends(require_permission(Permission.role_manage)),
) -> dict:
    users = load_json(USERS_PATH)
    user = next((u for u in users if u["id"] == user_id), None)

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user["role"] = payload.role.value
    save_json(USERS_PATH, users)

    return {
        "message": "Роль обновлена",
        "user": {"id": user["id"], "username": user["username"], "role": user["role"]},
    }


SITEMAP_ROUTES = ["/"]


@app.get("/sitemap.xml")
def sitemap() -> Response:
    base = os.getenv("SITE_BASE_URL", "http://localhost:3000")
    lastmod = datetime.now(timezone.utc).date().isoformat()
    items = "".join(
        f"<url><loc>{base}{path}</loc><lastmod>{lastmod}</lastmod></url>" for path in SITEMAP_ROUTES
    )
    xml = f"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">{items}</urlset>"
    return Response(content=xml, media_type="application/xml")


@app.get("/robots.txt")
def robots() -> PlainTextResponse:
    base = os.getenv("SITE_BASE_URL", "http://localhost:3000")
    txt = f"""User-agent: *
Disallow: /api/
Sitemap: {base}/sitemap.xml
"""
    return PlainTextResponse(content=txt)


# API integration
OPENWEATHER_KEY = os.getenv("OPENWEATHER_KEY", "")
OPENWEATHER_TIMEOUT = 5.0
OPENWEATHER_RETRIES = 2


def fetch_weather(city: str) -> dict:
    key = os.getenv("OPENWEATHER_KEY", OPENWEATHER_KEY)
    if not key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="External API key not configured")

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": key, "units": "metric", "lang": "ru"}
    last_error = None

    for attempt in range(OPENWEATHER_RETRIES + 1):
        try:
            resp = httpx.get(url, params=params, timeout=OPENWEATHER_TIMEOUT)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "city": data.get("name"),
                    "temp": data.get("main", {}).get("temp"),
                    "description": data.get("weather", [{}])[0].get("description"),
                    "raw": data,
                }
            elif resp.status_code == 404:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
            else:
                last_error = resp.text
        except httpx.RequestError as e:
            last_error = str(e)

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to fetch external API: {last_error or 'unknown'}")


@app.get("/api/external/weather")
def external_weather(city: str = Query(default="London")) -> dict:
    try:
        result = fetch_weather(city)
        return {"ok": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))