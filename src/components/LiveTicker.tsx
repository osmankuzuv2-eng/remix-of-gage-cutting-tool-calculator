import { useEffect, useState } from "react";
import { DollarSign, Euro, Thermometer } from "lucide-react";

interface TickerData {
  usdTry: number | null;
  eurTry: number | null;
  temperature: number | null;
  weatherDesc: string | null;
}

const LiveTicker = () => {
  const [data, setData] = useState<TickerData>({
    usdTry: null,
    eurTry: null,
    temperature: null,
    weatherDesc: null,
  });

  const fetchData = async () => {
    try {
      const [ratesRes, weatherRes] = await Promise.all([
        fetch("https://api.exchangerate-api.com/v4/latest/USD"),
        fetch("https://wttr.in/Armutlu,Izmir?format=j1"),
      ]);
      const rates = await ratesRes.json();
      const weather = await weatherRes.json();

      setData({
        usdTry: rates?.rates?.TRY ?? null,
        eurTry: rates?.rates?.TRY && rates?.rates?.EUR
          ? rates.rates.TRY / rates.rates.EUR
          : null,
        temperature: weather?.current_condition?.[0]?.temp_C
          ? Number(weather.current_condition[0].temp_C)
          : null,
        weatherDesc: weather?.current_condition?.[0]?.lang_tr?.[0]?.value
          || weather?.current_condition?.[0]?.weatherDesc?.[0]?.value
          || null,
      });
    } catch (err) {
      console.error("Ticker fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: "USD/TRY",
      value: data.usdTry?.toFixed(2) ?? "—",
      color: "text-green-400",
    },
    {
      icon: <Euro className="w-3.5 h-3.5" />,
      label: "EUR/TRY",
      value: data.eurTry?.toFixed(2) ?? "—",
      color: "text-blue-400",
    },
    {
      icon: <Thermometer className="w-3.5 h-3.5" />,
      label: "Armutlu",
      value: data.temperature !== null ? `${data.temperature}°C` : "—",
      extra: data.weatherDesc,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="w-full bg-card/80 backdrop-blur border-b border-border py-1.5">
      <div className="flex items-center justify-center gap-8 text-xs">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={item.color}>{item.icon}</span>
            <span className="text-muted-foreground font-medium">{item.label}:</span>
            <span className="text-foreground font-bold">{item.value}</span>
            {item.extra && (
              <span className="text-muted-foreground text-[10px]">({item.extra})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default LiveTicker;
