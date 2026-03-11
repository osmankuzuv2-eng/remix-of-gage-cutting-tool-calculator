import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, RotateCcw, Minus, Plus, Trophy, Zap } from "lucide-react";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣", "🍀", "🎰"];
const REEL_COUNT = 5;
const INITIAL_CREDITS = 10000;

const PAYOUTS: Record<string, number> = {
  "7️⃣": 50,
  "💎": 30,
  "⭐": 20,
  "🔔": 15,
  "🍀": 12,
  "🎰": 10,
  "🍒": 8,
  "🍋": 5,
};

const getRandomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

const generateReelStrip = (size = 20) =>
  Array.from({ length: size }, () => getRandomSymbol());

const SlotMachine = () => {
  const [credits, setCredits] = useState(INITIAL_CREDITS);
  const [bet, setBet] = useState(10);
  const [lines, setLines] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[][]>(
    Array.from({ length: REEL_COUNT }, () => [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()])
  );
  const [winAmount, setWinAmount] = useState(0);
  const [winLines, setWinLines] = useState<number[]>([]);
  const [lastWin, setLastWin] = useState<{ amount: number; symbol: string } | null>(null);
  const [totalBet, setTotalBet] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);

  const totalBetAmount = bet * lines;

  const adjustBet = (delta: number) => {
    setBet((prev) => Math.max(1, Math.min(500, prev + delta)));
  };

  const adjustLines = (delta: number) => {
    setLines((prev) => Math.max(1, Math.min(9, prev + delta)));
  };

  // Check for wins across lines
  const checkWins = useCallback((finalReels: string[][]) => {
    let totalWin = 0;
    const winningLines: number[] = [];
    let bestWin: { amount: number; symbol: string } | null = null;

    // Lines are rows: row 0 = top, row 1 = middle, row 2 = bottom
    // Plus diagonals for lines > 3
    const linePatterns: number[][] = [
      [1, 1, 1, 1, 1], // middle
      [0, 0, 0, 0, 0], // top
      [2, 2, 2, 2, 2], // bottom
      [0, 1, 2, 1, 0], // V shape
      [2, 1, 0, 1, 2], // inverted V
      [0, 0, 1, 2, 2], // diagonal down
      [2, 2, 1, 0, 0], // diagonal up
      [1, 0, 0, 0, 1], // U shape top
      [1, 2, 2, 2, 1], // U shape bottom
    ];

    for (let l = 0; l < Math.min(lines, linePatterns.length); l++) {
      const pattern = linePatterns[l];
      const lineSymbols = pattern.map((row, col) => finalReels[col][row]);
      
      // Count consecutive from left
      const firstSym = lineSymbols[0];
      let count = 1;
      for (let i = 1; i < lineSymbols.length; i++) {
        if (lineSymbols[i] === firstSym) count++;
        else break;
      }

      if (count >= 3) {
        const multiplier = PAYOUTS[firstSym] || 5;
        const lineWin = bet * multiplier * (count - 2); // 3=x1, 4=x2, 5=x3
        totalWin += lineWin;
        winningLines.push(l);
        if (!bestWin || lineWin > bestWin.amount) {
          bestWin = { amount: lineWin, symbol: firstSym };
        }
      }
    }

    return { totalWin, winningLines, bestWin };
  }, [bet, lines]);

  const spin = useCallback(() => {
    if (spinning || credits < totalBetAmount) return;

    setCredits((prev) => prev - totalBetAmount);
    setTotalBet((prev) => prev + totalBetAmount);
    setSpinning(true);
    setWinAmount(0);
    setWinLines([]);
    setLastWin(null);

    // Generate final positions
    const finalReels = Array.from({ length: REEL_COUNT }, () => [
      getRandomSymbol(),
      getRandomSymbol(),
      getRandomSymbol(),
    ]);

    // Staggered stop animation
    const newReels = [...reels];
    const delays = [300, 500, 700, 900, 1100];

    delays.forEach((delay, i) => {
      setTimeout(() => {
        newReels[i] = finalReels[i];
        setReels([...newReels]);

        // On last reel stop
        if (i === REEL_COUNT - 1) {
          setTimeout(() => {
            const result = checkWins(finalReels);
            if (result.totalWin > 0) {
              setCredits((prev) => prev + result.totalWin);
              setWinAmount(result.totalWin);
              setWinLines(result.winningLines);
              setLastWin(result.bestWin);
              setTotalWon((prev) => prev + result.totalWin);
            }
            setSpinning(false);
          }, 200);
        }
      }, delay);
    });

    // Animate intermediate spins
    const animInterval = setInterval(() => {
      setReels((prev) =>
        prev.map((reel, i) => {
          const elapsed = Date.now();
          // Keep already-stopped reels
          if (newReels[i] === finalReels[i]) return newReels[i];
          return [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
        })
      );
    }, 80);

    setTimeout(() => clearInterval(animInterval), 1200);
  }, [spinning, credits, totalBetAmount, reels, checkWins]);

  const reset = () => {
    setCredits(INITIAL_CREDITS);
    setTotalBet(0);
    setTotalWon(0);
    setWinAmount(0);
    setWinLines([]);
    setLastWin(null);
  };

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spinning) {
        e.preventDefault();
        spin();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [spin, spinning]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg">
                <span className="text-xl">🎰</span>
              </div>
              Slot Machine
              <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400">
                <Zap className="w-3 h-3 mr-1" /> GAME
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground hover:text-foreground">
              <RotateCcw className="w-4 h-4 mr-1" /> Sıfırla
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Credits Display */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-muted-foreground">Kredi</span>
            </div>
            <p className={`text-2xl font-mono font-bold ${credits < 100 ? "text-destructive" : "text-yellow-400"}`}>
              {credits.toLocaleString("tr-TR")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Bahis</span>
            </div>
            <p className="text-2xl font-mono font-bold text-primary">
              {totalBetAmount.toLocaleString("tr-TR")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Kazanç</span>
            </div>
            <p className={`text-2xl font-mono font-bold ${winAmount > 0 ? "text-emerald-400 animate-pulse" : "text-muted-foreground"}`}>
              {winAmount > 0 ? `+${winAmount.toLocaleString("tr-TR")}` : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Slot Reels */}
      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="relative rounded-2xl border-2 border-purple-500/30 bg-gradient-to-b from-background to-muted/30 p-4">
            {/* Win overlay */}
            {winAmount > 0 && !spinning && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-2xl animate-in fade-in duration-300">
                <div className="text-center">
                  <p className="text-4xl mb-2">{lastWin?.symbol}</p>
                  <p className="text-3xl font-mono font-bold text-emerald-400 animate-pulse">
                    +{winAmount.toLocaleString("tr-TR")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {winLines.length} hat kazandı!
                  </p>
                </div>
              </div>
            )}

            {/* Reels */}
            <div className="flex gap-2 justify-center">
              {reels.map((reel, reelIdx) => (
                <div
                  key={reelIdx}
                  className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/80 overflow-hidden"
                >
                  {reel.map((symbol, rowIdx) => (
                    <div
                      key={rowIdx}
                      className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl transition-all duration-150 ${
                        spinning
                          ? "scale-90 opacity-70"
                          : winLines.length > 0
                          ? "scale-100"
                          : ""
                      }`}
                    >
                      {symbol}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Line indicators */}
            <div className="flex justify-center gap-1 mt-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i < lines
                      ? winLines.includes(i)
                        ? "bg-emerald-400 scale-125 animate-pulse"
                        : "bg-purple-400"
                      : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Bet Control */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 text-center">Bahis Miktarı</p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustBet(-5)}
                disabled={spinning || bet <= 1}
                className="h-8 w-8"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xl font-mono font-bold text-foreground w-16 text-center">
                {bet}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustBet(5)}
                disabled={spinning || bet >= 500}
                className="h-8 w-8"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lines Control */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2 text-center">Hat Sayısı</p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustLines(-1)}
                disabled={spinning || lines <= 1}
                className="h-8 w-8"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xl font-mono font-bold text-foreground w-16 text-center">
                {lines}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustLines(1)}
                disabled={spinning || lines >= 9}
                className="h-8 w-8"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spin Button */}
      <Button
        onClick={spin}
        disabled={spinning || credits < totalBetAmount}
        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        {spinning ? (
          <span className="animate-pulse">Dönüyor...</span>
        ) : credits < totalBetAmount ? (
          "Yetersiz Kredi"
        ) : (
          <>🎰 ÇEVİR (Space)</>
        )}
      </Button>

      {/* Paytable */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-3 font-semibold">Ödeme Tablosu (3+ eşleşme)</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(PAYOUTS)
              .sort((a, b) => b[1] - a[1])
              .map(([sym, mult]) => (
                <div
                  key={sym}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40"
                >
                  <span className="text-xl">{sym}</span>
                  <span className="text-xs font-mono text-primary font-bold">x{mult}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span>Toplam Bahis: <strong className="text-foreground">{totalBet.toLocaleString("tr-TR")}</strong></span>
        <span>Toplam Kazanç: <strong className="text-emerald-400">{totalWon.toLocaleString("tr-TR")}</strong></span>
        <span>Net: <strong className={totalWon - totalBet >= 0 ? "text-emerald-400" : "text-destructive"}>{(totalWon - totalBet).toLocaleString("tr-TR")}</strong></span>
      </div>
    </div>
  );
};

export default SlotMachine;
