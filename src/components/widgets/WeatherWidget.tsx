import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { platformFetch as httpFetch } from '../../lib/http';
import { getItem, setItem } from '../../lib/storage';
import { Widget, EmptyWidget } from '../shared/Widget';
import type { WidgetCtx } from './context';

const ACCENT = '#a1bdc7';
const REFRESH_MS = 30 * 60 * 1000;

/** Map WMO weather codes to a human-readable label. */
function conditionLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 84) return 'Snow showers';
  return 'Thunderstorm';
}

interface WeatherData {
  temp: number;
  condition: string;
  windSpeed: number;
  city: string;
}

interface SavedLocation {
  lat: number;
  lon: number;
  city: string;
}

type Status = 'loading' | 'locating' | 'ready' | 'error' | 'needs-city';

export default function WeatherWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [showCityInput, setShowCityInput] = useState(false);
  const lastFetchRef = useRef(0);

  const fetchWeather = useCallback(async (lat: number, lon: number, city: string) => {
    try {
      const res = await httpFetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code`,
      );
      if (!res.ok) throw new Error(`Weather API: ${res.status}`);
      const data = (await res.json()) as {
        current: { temperature_2m: number; wind_speed_10m: number; weather_code: number };
      };
      setWeather({
        temp: Math.round(data.current.temperature_2m),
        windSpeed: Math.round(data.current.wind_speed_10m),
        condition: conditionLabel(data.current.weather_code),
        city,
      });
      lastFetchRef.current = Date.now();
      setStatus('ready');
      setError(null);
    } catch (e) {
      setError(String(e));
      setStatus('error');
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await httpFetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'AugCooker/1.0' } },
      );
      if (!res.ok) return 'Your location';
      const data = (await res.json()) as {
        address?: { city?: string; town?: string; village?: string; county?: string };
      };
      return (
        data.address?.city ??
        data.address?.town ??
        data.address?.village ??
        data.address?.county ??
        'Your location'
      );
    } catch {
      return 'Your location';
    }
  }, []);

  const searchCity = useCallback(async (cityName: string) => {
    setStatus('loading');
    setError(null);
    try {
      const res = await httpFetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`,
      );
      if (!res.ok) throw new Error(`Geocoding: ${res.status}`);
      const data = (await res.json()) as {
        results?: Array<{ latitude: number; longitude: number; name: string }>;
      };
      if (!data.results?.length) throw new Error(`City "${cityName}" not found`);
      const { latitude, longitude, name } = data.results[0];
      const loc: SavedLocation = { lat: latitude, lon: longitude, city: name };
      await setItem('weatherLocation', JSON.stringify(loc));
      await fetchWeather(latitude, longitude, name);
    } catch (e) {
      setError(String(e));
      setStatus('needs-city');
    }
  }, [fetchWeather]);

  const initFromGeolocation = useCallback(() => {
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const city = await reverseGeocode(lat, lon);
        const loc: SavedLocation = { lat, lon, city };
        await setItem('weatherLocation', JSON.stringify(loc));
        await fetchWeather(lat, lon, city);
      },
      () => {
        setStatus('needs-city');
      },
      { timeout: 10000 },
    );
  }, [reverseGeocode, fetchWeather]);

  // On mount: load saved location or ask for geolocation
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await getItem('weatherLocation');
      if (!mounted) return;
      if (saved?.value) {
        const loc = JSON.parse(saved.value) as SavedLocation;
        await fetchWeather(loc.lat, loc.lon, loc.city);
      } else {
        initFromGeolocation();
      }
    })();
    return () => { mounted = false; };
  }, [fetchWeather, initFromGeolocation]);

  // Auto-refresh every 30 min
  useEffect(() => {
    const id = setInterval(async () => {
      if (Date.now() - lastFetchRef.current < REFRESH_MS) return;
      const saved = await getItem('weatherLocation');
      if (saved?.value) {
        const loc = JSON.parse(saved.value) as SavedLocation;
        await fetchWeather(loc.lat, loc.lon, loc.city);
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchWeather]);

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.4rem 0.6rem', color: t.text, fontSize: '0.78rem',
    fontFamily: 'inherit', outline: 'none', flex: 1,
  };
  const btn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.4rem 0.7rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.72rem',
  };

  const CityForm = () => (
    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
      <input
        value={cityInput}
        onChange={e => setCityInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && cityInput.trim()) {
            searchCity(cityInput.trim());
            setShowCityInput(false);
          }
        }}
        placeholder="London, Tokyo…"
        style={inp}
      />
      <button
        onClick={() => {
          if (cityInput.trim()) {
            searchCity(cityInput.trim());
            setShowCityInput(false);
          }
        }}
        style={btn}
      >
        Go
      </button>
    </div>
  );

  return (
    <Widget t={t} accent={ACCENT}>

      {(status === 'loading' || status === 'locating') && (
        <EmptyWidget text={status === 'locating' ? 'Detecting location…' : 'Loading weather…'} t={t} />
      )}

      {status === 'needs-city' && (
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ fontSize: '0.75rem', color: t.textMuted, marginBottom: '0.4rem' }}>
            Enter your city to get started:
          </div>
          <CityForm />
          {error && (
            <div style={{ fontSize: '0.68rem', color: t.alert, marginTop: '0.4rem' }}>{error}</div>
          )}
        </div>
      )}

      {status === 'error' && weather === null && (
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ fontSize: '0.72rem', color: t.alert }}>{error}</div>
          <button
            onClick={() => { setStatus('needs-city'); setError(null); }}
            style={{ ...btn, marginTop: '0.5rem' }}
          >
            Try a city name
          </button>
        </div>
      )}

      {status === 'ready' && weather && (
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: 200, color: t.text, lineHeight: 1 }}>
              {weather.temp}°
            </span>
            <span style={{ fontSize: '0.82rem', color: t.textMuted }}>{weather.condition}</span>
          </div>
          <button
            onClick={() => setShowCityInput(s => !s)}
            title="Change city"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.45rem', opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >
            <MapPin size={11} strokeWidth={1.5} color={t.textDim} />
            <span style={{ fontSize: '0.72rem', color: t.textDim }}>{weather.city}</span>
            <span style={{ fontSize: '0.68rem', color: t.textDim, marginLeft: '0.1rem' }}>· {weather.windSpeed} km/h</span>
          </button>
          {showCityInput && <CityForm />}
        </div>
      )}
    </Widget>
  );
}
