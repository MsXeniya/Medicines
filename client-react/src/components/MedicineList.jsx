import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import "../styles/MedicineList.css";

export default function MedicineList() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [medicines, setMedicines] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newMedicineName, setNewMedicineName] = useState("");
  const [newMedicineTime, setNewMedicineTime] = useState("09:00");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingTime, setEditingTime] = useState("09:00");
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploadingById, setUploadingById] = useState({});

  const search = searchParams.get("search") || "";
  const taken = searchParams.get("taken") || "all";
  const timeFrom = searchParams.get("time_from") || "";
  const timeTo = searchParams.get("time_to") || "";
  const sortBy = searchParams.get("sort_by") || "createdAt";
  const sortOrder = searchParams.get("sort_order") || "desc";
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("page_size") || "5");

  // какие права есть у текущего пользователя (в UI)
  const canCreate = hasPermission("medicines:create");
  const canTakeAny = hasPermission("medicines:take:any");
  const canTakeOwn = hasPermission("medicines:take:own");
  const canDeleteAny = hasPermission("medicines:delete:any");
  const canDeleteOwn = hasPermission("medicines:delete:own");

  // получение списка лекарств 
  const updateParams = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === "" || value === null || value === undefined) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (taken !== "all") query.set("taken", taken);
      if (timeFrom) query.set("time_from", timeFrom);
      if (timeTo) query.set("time_to", timeTo);
      query.set("sort_by", sortBy);
      query.set("sort_order", sortOrder);
      query.set("page", String(page));
      query.set("page_size", String(pageSize));

      const res = await api.get(`/medicines?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMedicines(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка при загрузке лекарств");
      }
    } catch (err) {
      console.error("Error fetching medicines:", err);
      setError("Ошибка при загрузке лекарств");
    } finally {
      setLoading(false);
    }
  }, [search, taken, timeFrom, timeTo, sortBy, sortOrder, page, pageSize]);

  // Загрузить лекарства 
  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleAddMedicine = async (e) => {
    e.preventDefault();

    // если права нет — действие блокируется
    if (!canCreate) {
      setError("Недостаточно прав для добавления лекарства");
      return;
    }

    if (!newMedicineName.trim()) {
      setError("Введите название лекарства");
      return;
    }

    try {
      const res = await api.post("/medicines", { name: newMedicineName, time: newMedicineTime });

      if (res.ok) {
        updateParams({ page: 1 });
        await fetchMedicines();
        setNewMedicineName("");
        setNewMedicineTime("09:00");
        setError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка при добавлении лекарства");
      }
    } catch (err) {
      console.error("Error adding medicine:", err);
      setError("Ошибка при добавлении лекарства");
    }
  };

  const startEditMedicine = (medicine) => {
    setEditingId(medicine.id);
    setEditingName(medicine.name);
    setEditingTime(medicine.time);
  };

  const cancelEditMedicine = () => {
    setEditingId(null);
    setEditingName("");
    setEditingTime("09:00");
  };

  const handleSaveEditMedicine = async (id) => {
    if (!editingName.trim()) {
      setError("Название лекарства не может быть пустым");
      return;
    }

    try {
      const res = await api.put(`/medicines/${id}`, {
        name: editingName,
        time: editingTime,
      });

      if (res.ok) {
        cancelEditMedicine();
        await fetchMedicines();
        setError(null);
      } else if (res.status === 403) {
        setError("Недостаточно прав");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка при редактировании лекарства");
      }
    } catch (err) {
      console.error("Error editing medicine:", err);
      setError("Ошибка при редактировании лекарства");
    }
  };

  // запрос на изменение статуса принятия лекарства
  const handleToggleTaken = async (id) => {
    try {
      const res = await api.put(`/medicines/${id}/take`, {});

      if (res.ok) {
        await fetchMedicines();
        setError(null);
      } else if (res.status === 403) {
        setError("Недостаточно прав");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка при обновлении лекарства");
      }
    } catch (err) {
      console.error("Error updating medicine:", err);
      setError("Ошибка при обновлении лекарства");
    }
  };

  // запрос на удаление лекарства
  const handleDeleteMedicine = async (id) => {
    if (!window.confirm("Вы уверены, что хотите удалить это лекарство?")) return;

    try {
      const res = await api.delete(`/medicines/${id}`);

      if (res.ok) {
        await fetchMedicines();
        setError(null);
      } else if (res.status === 403) {
        setError("Недостаточно прав");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || `Ошибка при удалении: ${res.status}`);
      }
    } catch (err) {
      console.error("Error deleting medicine:", err);
      setError("Ошибка при удалении лекарства");
    }
  };

  const handleFileChange = (medicineId, file) => {
    setSelectedFiles((prev) => ({ ...prev, [medicineId]: file || null }));
  };

  const handleUploadFile = async (medicineId) => {
    const file = selectedFiles[medicineId];
    if (!file) {
      setError("Сначала выберите файл");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingById((prev) => ({ ...prev, [medicineId]: true }));
    try {
      const res = await api.post(`/medicines/${medicineId}/files`, formData);
      if (res.ok) {
        setSelectedFiles((prev) => ({ ...prev, [medicineId]: null }));
        await fetchMedicines();
        setError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка загрузки файла");
      }
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Ошибка загрузки файла");
    } finally {
      setUploadingById((prev) => ({ ...prev, [medicineId]: false }));
    }
  };

  const handleDownloadFile = async (medicineId, fileId) => {
    try {
      const res = await api.get(`/medicines/${medicineId}/files/${fileId}/download`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка получения ссылки на файл");
        return;
      }

      const data = await res.json();
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error downloading file:", err);
      setError("Ошибка скачивания файла");
    }
  };

  const handleDeleteFile = async (medicineId, fileId) => {
    try {
      const res = await api.delete(`/medicines/${medicineId}/files/${fileId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Ошибка удаления файла");
        return;
      }

      await fetchMedicines();
      setError(null);
    } catch (err) {
      console.error("Error deleting file:", err);
      setError("Ошибка удаления файла");
    }
  };

  if (loading && medicines.length === 0) {
    return <div className="loading">Загрузка лекарств...</div>;
  }

  const canEditMedicine = (medicine) => {
    if (!user) return false;
    return canTakeAny || (canTakeOwn && medicine.userId === user.id);
  };

  const canDeleteMedicine = (medicine) => {
    if (!user) return false;
    return canDeleteAny || (canDeleteOwn && medicine.userId === user.id);
  };

  return (
    <div className="medicine-list-container">
      <div className="filters-card">
        <h2>Фильтры и поиск</h2>
        <div className="filters-grid">
          <input
            type="text"
            className="form-input"
            placeholder="Поиск по названию или времени"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
          />
          <select
            className="form-input"
            value={taken}
            onChange={(e) => updateParams({ taken: e.target.value, page: 1 })}
          >
            <option value="all">Статус: все</option>
            <option value="true">Только принятые</option>
            <option value="false">Только ожидающие</option>
          </select>
          <input
            type="time"
            className="form-input"
            title="От времени"
            placeholder="От"
            value={timeFrom}
            onChange={(e) => updateParams({ time_from: e.target.value, page: 1 })}
          />
          <input
            type="time"
            className="form-input"
            title="До времени"
            placeholder="До"
            value={timeTo}
            onChange={(e) => updateParams({ time_to: e.target.value, page: 1 })}
          />
          <select
            className="form-input"
            value={sortBy}
            onChange={(e) => updateParams({ sort_by: e.target.value, page: 1 })}
          >
            <option value="createdAt">Сортировка: по дате</option>
            <option value="name">Сортировка: по названию</option>
            <option value="time">Сортировка: по времени</option>
            <option value="taken">Сортировка: по статусу</option>
          </select>
          <select
            className="form-input"
            value={sortOrder}
            onChange={(e) => updateParams({ sort_order: e.target.value, page: 1 })}
          >
            <option value="asc">Порядок: по возрастанию</option>
            <option value="desc">Порядок: по убыванию</option>
          </select>
          <select
            className="form-input"
            value={pageSize}
            onChange={(e) => updateParams({ page_size: e.target.value, page: 1 })}
          >
            <option value="5">5 на странице</option>
            <option value="10">10 на странице</option>
            <option value="20">20 на странице</option>
          </select>
        </div>
      </div>

      {canCreate && (
        <div className="add-medicine-card">
          <h2>Добавить новое лекарство</h2>
          <form onSubmit={handleAddMedicine} className="add-medicine-form">
            <input
              type="text"
              placeholder="Название лекарства"
              value={newMedicineName}
              onChange={(e) => setNewMedicineName(e.target.value)}
              className="form-input"
            />
            <input
              type="time"
              value={newMedicineTime}
              onChange={(e) => setNewMedicineTime(e.target.value)}
              className="form-input"
            />
            <button type="submit" className="btn btn-success">
              Добавить
            </button>
          </form>
          {error && <div className="error-message">{error}</div>}
        </div>
      )}

      {!canCreate && error && <div className="error-message">{error}</div>}

      <div className="medicines-grid">
        {medicines.length === 0 ? (
          <div className="empty-state">
            <p>Нет лекарств</p>
            <p className="empty-subtitle">Попробуйте изменить фильтры или добавить запись</p>
          </div>
        ) : (
          medicines.map((medicine) => (
            <div
              key={medicine.id}
              className={`medicine-card ${medicine.taken ? "taken" : ""}`}
            >
              <div className="medicine-header">
                <h3 className="medicine-name">{medicine.name}</h3>
                <span className={`badge ${medicine.taken ? "badge-success" : "badge-warning"}`}>
                  {medicine.taken ? "Принято" : "Ожидание"}
                </span>
              </div>

              <div className="medicine-time">
                <strong>Время:</strong> {medicine.time}
              </div>

              <div className="medicine-editor">
                {editingId === medicine.id ? (
                  <>
                    <input
                      className="form-input"
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="time"
                      value={editingTime}
                      onChange={(e) => setEditingTime(e.target.value)}
                    />
                    <div className="medicine-actions">
                      <button
                        onClick={() => handleSaveEditMedicine(medicine.id)}
                        className="btn btn-success"
                        disabled={!canEditMedicine(medicine)}
                      >
                        Сохранить
                      </button>
                      <button onClick={cancelEditMedicine} className="btn btn-secondary">
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => startEditMedicine(medicine)}
                    disabled={!canEditMedicine(medicine)}
                    className="btn btn-secondary"
                  >
                    Редактировать
                  </button>
                )}
              </div>

              <div className="files-block">
                <p className="files-title">Файлы</p>
                <div className="file-upload-row">
                  <input
                    type="file"
                    onChange={(e) => handleFileChange(medicine.id, e.target.files?.[0])}
                    disabled={!canEditMedicine(medicine)}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUploadFile(medicine.id)}
                    disabled={!canEditMedicine(medicine) || uploadingById[medicine.id]}
                  >
                    {uploadingById[medicine.id] ? "Загрузка..." : "Загрузить"}
                  </button>
                </div>

                <div className="files-list">
                  {(medicine.files || []).length === 0 ? (
                    <p className="empty-subtitle">Файлов пока нет</p>
                  ) : (
                    (medicine.files || []).map((file) => (
                      <div className="file-item" key={file.id}>
                        <span className="file-name">{file.fileName}</span>
                        <div className="file-actions">
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDownloadFile(medicine.id, file.id)}
                          >
                            Скачать
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteFile(medicine.id, file.id)}
                            disabled={!canDeleteMedicine(medicine)}
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="medicine-actions">
                <button
                  onClick={() => handleToggleTaken(medicine.id)}
                  disabled={!canEditMedicine(medicine)}
                  className={`btn ${medicine.taken ? "btn-secondary" : "btn-primary"}`}
                >
                  {medicine.taken ? "Отменить" : "Принято"}
                </button>
                <button
                  onClick={() => handleDeleteMedicine(medicine.id)}
                  disabled={!canDeleteMedicine(medicine)}
                  className="btn btn-danger"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="pagination-block">
        <p>
          Всего: <strong>{total}</strong>
        </p>
        <div className="pagination-controls">
          <button
            className="btn btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => updateParams({ page: page - 1 })}
          >
            Назад
          </button>
          <span>
            Страница {page} из {Math.max(totalPages, 1)}
          </span>
          <button
            className="btn btn-secondary"
            disabled={loading || totalPages <= page}
            onClick={() => updateParams({ page: page + 1 })}
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}
