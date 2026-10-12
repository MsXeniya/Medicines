import React, { useState, useEffect } from "react";
import { api } from "../utils/api";

export default function ExternalWeather({ city = "London" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/external/weather?city=${encodeURIComponent(city)}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.detail || "Внешний сервис недоступен");
        } else {
          const d = await res.json();
          if (mounted) setData(d.data || null);
        }
      } catch (err) {
        setError("Ошибка запроса к внешнему сервису");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => (mounted = false);
  }, [city]);

  if (loading) return <div className="external-weather">Загрузка погоды...</div>;
  if (error) return <div className="external-weather error">{error}</div>;
  if (!data) return <div className="external-weather">Данных нет</div>;

  return (
    <div className="external-weather">
      <strong>Погода в {data.city}:</strong> {data.temp}°C, {data.description}
    </div>
  );
}
