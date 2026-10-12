import pytest

from server_fastapi import main


def test_parse_time_to_minutes_valid():
    # тест парсинга времени в минуты (валидные значения)
    assert main.parse_time_to_minutes("00:00") == 0
    assert main.parse_time_to_minutes("01:30") == 90
    assert main.parse_time_to_minutes("23:59") == 23 * 60 + 59


def test_parse_time_to_minutes_invalid():
    # тест парсинга времени с невалидными значениями
    assert main.parse_time_to_minutes("24:00") == -1
    assert main.parse_time_to_minutes("abc") == -1


def test_medicine_sort_value():
    # тест сортировки лекарств по разным полям
    m = {"name": "b", "time": "09:00", "taken": True, "createdAt": "2020-01-01T00:00:00Z"}
    assert main.medicine_sort_value(m, "name") == "b"
    assert main.medicine_sort_value(m, "time") == main.parse_time_to_minutes("09:00")
    assert main.medicine_sort_value(m, "taken") == 1
    assert main.medicine_sort_value(m, "createdAt") == "2020-01-01T00:00:00Z"


def test_can_manage_and_delete():
    # тест проверки прав доступа к лекарствам
    user = main.TokenUser(id=2, username="user", role=main.Role.user)
    med_owned = {"id": 1, "userId": 2}  # лекарство пользователя
    med_other = {"id": 2, "userId": 1}  # лекарство другого пользователя
    assert main.can_manage_medicine(user, med_owned) is True
    assert main.can_manage_medicine(user, med_other) is False
    assert main.can_delete_medicine(user, med_owned) is True
    assert main.can_delete_medicine(user, med_other) is False


def test_medicine_update_payload_validator():
    # тест валидатора: обновление без полей должно быть ошибкой
    with pytest.raises(ValueError):
        main.MedicineUpdatePayload()  # нет полей
