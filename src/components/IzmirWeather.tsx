import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets, Thermometer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface DayForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  precipitation: number;
  windSpeed: number;
  humidity: number;
}

// Open-Meteo WMO weather codes to label
const getWeatherLabel = (code: number): string => {
  if (code === 0) return "Açık";
  if (code <= 3) return "Az Bulutlu";
  if (code <= 49) return "Sisli";
  if (code <= 67) return "Yağmurlu";
  if (code <= 77) return "Karlı";
  if (code <= 82) return "Sağanak";
  if (code <= 99) return "Fırtınalı";
  return "Değişken";
};

const WeatherIcon = ({ code, className }: { code: number; className?: string }) => {
  if (code === 0) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 49) return <Cloud className={className} />;
  if (code <= 67) return <CloudRain className={className} />;
  if (code <= 77) return <CloudSnow className={className} />;
  if (code <= 82) return <CloudRain className={className} />;
  if (code <= 99) return <CloudLightning className={className} />;
  return <Cloud className={className} />;
};

const getWeatherGradient = (code: number): string => {
  if (code === 0) return "from-amber-500/20 to-orange-500/10";
  if (code <= 3) return "from-sky-500/20 to-blue-500/10";
  if (code <= 67) return "from-blue-600/20 to-slate-500/10";
  if (code <= 77) return "from-sky-200/20 to-blue-300/10";
  if (code <= 99) return "from-slate-600/20 to-zinc-500/10";
  return "from-sky-500/20 to-blue-500/10";
};

const IzmirWeather = () => {
  const [forecasts, setForecasts] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=38.4189&longitude=27.1287&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_max&timezone=Europe/Istanbul&forecast_days=5"
        );
        const data = await res.json();
        const days: DayForecast[] = data.daily.time.map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(data.daily.temperature_2m_max[i]),
          minTemp: Math.round(data.daily.temperature_2m_min[i]),
          weatherCode: data.daily.weather_code[i],
          precipitation: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
          windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
          humidity: data.daily.relative_humidity_2m_max[i],
        }));
        setForecasts(days);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  if (loading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-6 flex justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm animate-pulse">
            <Cloud className="w-4 h-4" />
            <span>Hava durumu yükleniyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent className="py-6 flex justify-center">
          <p className="text-muted-foreground text-sm">Hava durumu bilgisi alınamadı.</p>
        </CardContent>
      </Card>
    );
  }

  const today = forecasts[0];

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Sun className="w-4 h-4 text-sky-400" />
          </div>
          <span>İzmir Hava Durumu</span>
          <span className="ml-auto text-xs text-muted-foreground font-normal">5 Günlük Tahmin</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {/* Today hero */}
        {today && (
          <div className={`rounded-xl p-4 mb-4 bg-gradient-to-br ${getWeatherGradient(today.weatherCode)} border border-border/40`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Bugün — {format(new Date(today.date), "dd MMMM yyyy", { locale: tr })}
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-foreground">{today.maxTemp}°</span>
                  <span className="text-xl text-muted-foreground mb-1">/ {today.minTemp}°</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{getWeatherLabel(today.weatherCode)}</p>
              </div>
              <WeatherIcon code={today.weatherCode} className="w-16 h-16 text-sky-400 opacity-80" />
            </div>
            <div className="flex gap-4 mt-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Droplets className="w-3 h-3 text-blue-400" />
                {today.humidity}%
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wind className="w-3 h-3 text-slate-400" />
                {today.windSpeed} km/s
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CloudRain className="w-3 h-3 text-blue-400" />
                {today.precipitation} mm
              </span>
            </div>
          </div>
        )}

        {/* Next 4 days */}
        <div className="grid grid-cols-4 gap-2">
          {forecasts.slice(1).map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {format(new Date(day.date), "EEE", { locale: tr })}
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                {format(new Date(day.date), "dd MMM", { locale: tr })}
              </p>
              <WeatherIcon code={day.weatherCode} className="w-6 h-6 text-sky-400" />
              <p className="text-[10px] text-center text-muted-foreground/70">{getWeatherLabel(day.weatherCode)}</p>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-foreground">{day.maxTemp}°</span>
                <span className="text-[10px] text-muted-foreground">{day.minTemp}°</span>
              </div>
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Droplets className="w-2.5 h-2.5 text-blue-400" />
                {day.humidity}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default IzmirWeather;
