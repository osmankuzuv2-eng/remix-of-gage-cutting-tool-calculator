import { useEffect, useState } from "react";
import { DollarSign, Euro, Thermometer, Clock } from "lucide-react";

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

  const [now, setNow] = useState(new Date());

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
    const dataInterval = setInterval(fetchData, 5 * 60 * 1000);
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
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
    <div className="w-full bg-card/80 backdrop-blur border-b border-border py-1.5 px-4">
      <div className="flex items-center justify-between text-xs">
        <div className="flex-1" />
        <div className="flex items-center gap-8">
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
        <div className="flex-1 flex justify-end">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">
              {now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
            <span className="font-bold text-foreground">
              {now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveTicker;
