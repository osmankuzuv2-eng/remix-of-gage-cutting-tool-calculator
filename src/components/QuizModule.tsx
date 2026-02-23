import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";
import {
  Brain, Trophy, ArrowRight, CheckCircle2, XCircle, Loader2,
  RotateCcw, Star, Zap, Target, ChevronRight,
} from "lucide-react";

type Question = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type Level = "easy" | "medium" | "hard";

const LEVEL_CONFIG: Record<Level, { label: Record<string, string>; color: string; icon: typeof Star; minScore: number }> = {
  easy: { label: { tr: "Kolay", en: "Easy", fr: "Facile" }, color: "from-green-500 to-emerald-600", icon: Star, minScore: 3 },
  medium: { label: { tr: "Orta", en: "Medium", fr: "Moyen" }, color: "from-amber-500 to-orange-600", icon: Zap, minScore: 3 },
  hard: { label: { tr: "Zor", en: "Hard", fr: "Difficile" }, color: "from-red-500 to-rose-600", icon: Target, minScore: 4 },
};

const TOPICS: { key: string; label: Record<string, string> }[] = [
  { key: "", label: { tr: "Genel", en: "General", fr: "Général" } },
  { key: "kesme parametreleri", label: { tr: "Kesme Parametreleri", en: "Cutting Parameters", fr: "Paramètres de coupe" } },
  { key: "takım ömrü ve Taylor", label: { tr: "Takım Ömrü", en: "Tool Life", fr: "Durée de vie" } },
  { key: "CNC programlama G-code M-code", label: { tr: "CNC / G-Code", en: "CNC / G-Code", fr: "CNC / G-Code" } },
  { key: "malzeme bilgisi", label: { tr: "Malzeme Bilgisi", en: "Materials", fr: "Matériaux" } },
  { key: "tolerans ve yüzey pürüzlülüğü", label: { tr: "Tolerans & Yüzey", en: "Tolerance & Surface", fr: "Tolérance & Surface" } },
  { key: "diş açma", label: { tr: "Diş Açma", en: "Threading", fr: "Filetage" } },
];

const t_quiz: Record<string, Record<string, string>> = {
  title: { tr: "Talaşlı İmalat Quiz", en: "Machining Quiz", fr: "Quiz Usinage" },
  subtitle: { tr: "AI ile seviyeli ilerleme sistemi", en: "AI-powered leveled progression", fr: "Progression par niveaux IA" },
  start: { tr: "Quiz Başlat", en: "Start Quiz", fr: "Démarrer" },
  loading: { tr: "Sorular hazırlanıyor...", en: "Generating questions...", fr: "Préparation..." },
  question: { tr: "Soru", en: "Question", fr: "Question" },
  next: { tr: "Sonraki", en: "Next", fr: "Suivant" },
  finish: { tr: "Bitir", en: "Finish", fr: "Terminer" },
  score: { tr: "Puan", en: "Score", fr: "Score" },
  correct: { tr: "Doğru!", en: "Correct!", fr: "Correct !" },
  wrong: { tr: "Yanlış!", en: "Wrong!", fr: "Faux !" },
  levelUp: { tr: "Seviye Atladınız! 🎉", en: "Level Up! 🎉", fr: "Niveau supérieur ! 🎉" },
  tryAgain: { tr: "Tekrar Dene", en: "Try Again", fr: "Réessayer" },
  nextLevel: { tr: "Sonraki Seviye", en: "Next Level", fr: "Niveau suivant" },
  result: { tr: "Sonuç", en: "Result", fr: "Résultat" },
  passed: { tr: "Geçtiniz!", en: "Passed!", fr: "Réussi !" },
  failed: { tr: "Tekrar deneyin", en: "Try again", fr: "Réessayez" },
  topic: { tr: "Konu", en: "Topic", fr: "Sujet" },
  level: { tr: "Seviye", en: "Level", fr: "Niveau" },
  totalScore: { tr: "Toplam Skor", en: "Total Score", fr: "Score total" },
};

const QuizModule = () => {
  const { language } = useLanguage();
  const lang = language || "tr";

  const [level, setLevel] = useState<Level>("easy");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [answered, setAnswered] = useState(false);

  const tt = (key: string) => t_quiz[key]?.[lang] || t_quiz[key]?.tr || key;

  const startQuiz = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { level, language: lang, topic },
      });
      if (error) throw error;
      if (!data?.questions?.length) throw new Error("No questions");
      setQuestions(data.questions);
      setCurrentQ(0);
      setScore(0);
      setSelected(null);
      setAnswered(false);
      setShowResult(false);
      setPhase("quiz");
    } catch (err: any) {
      toast({ title: "Hata", description: err.message || "Quiz oluşturulamadı", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [level, lang, topic]);

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[currentQ].correct_index) {
      setScore((s) => s + 1);
      setTotalScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      setPhase("result");
    }
  };

  const levelConfig = LEVEL_CONFIG[level];
  const passed = score >= levelConfig.minScore;

  const handleNextLevel = () => {
    const levels: Level[] = ["easy", "medium", "hard"];
    const nextIdx = levels.indexOf(level) + 1;
    if (nextIdx < levels.length) {
      setLevel(levels[nextIdx]);
    }
    setPhase("setup");
  };

  const handleRetry = () => {
    setPhase("setup");
  };

  // Setup phase
  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Brain className="w-6 h-6 text-primary" /></div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {tt("title")}
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">AI</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">{tt("subtitle")}</p>
            </div>
            {totalScore > 0 && (
              <Badge className="ml-auto bg-primary/10 text-primary border-primary/30">
                <Trophy className="w-3 h-3 mr-1" /> {tt("totalScore")}: {totalScore}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-6 space-y-6">
            {/* Topic selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{tt("topic")}</label>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTopic(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      topic === t.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/30 border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    {t.label[lang] || t.label.tr}
                  </button>
                ))}
              </div>
            </div>

            {/* Level selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">{tt("level")}</label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(LEVEL_CONFIG) as Level[]).map((lv) => {
                  const cfg = LEVEL_CONFIG[lv];
                  const LvIcon = cfg.icon;
                  return (
                    <button
                      key={lv}
                      onClick={() => setLevel(lv)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        level === lv
                          ? `border-primary bg-primary/10 shadow-md scale-[1.02]`
                          : "border-border bg-card hover:border-primary/30 hover:scale-[1.01]"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cfg.color} flex items-center justify-center`}>
                        <LvIcon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{cfg.label[lang] || cfg.label.tr}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button onClick={startQuiz} disabled={isLoading} className="w-full" size="lg">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />{tt("loading")}</>
              ) : (
                <><Brain className="w-4 h-4 mr-2" />{tt("start")}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Result phase
  if (phase === "result") {
    return (
      <div className="space-y-4">
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${levelConfig.color} flex items-center justify-center`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{tt("result")}</h2>
            <div className="text-4xl font-mono font-bold text-primary">{score}/{questions.length}</div>
            <p className={`text-lg font-semibold ${passed ? "text-green-500" : "text-destructive"}`}>
              {passed ? tt("passed") : tt("failed")}
            </p>
            {passed && level !== "hard" && (
              <p className="text-sm text-muted-foreground">{tt("levelUp")}</p>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-2" />{tt("tryAgain")}
              </Button>
              {passed && level !== "hard" && (
                <Button onClick={handleNextLevel}>
                  {tt("nextLevel")}<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz phase
  const q = questions[currentQ];
  const progress = ((currentQ + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Badge className={`bg-gradient-to-r ${levelConfig.color} text-white border-0`}>
              {levelConfig.label[lang] || levelConfig.label.tr}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {tt("question")} {currentQ + 1}/{questions.length}
            </span>
            <Badge variant="outline" className="border-primary/40 text-primary">
              {tt("score")}: {score}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Question */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base leading-relaxed">{q.question}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.options.map((opt, idx) => {
            let cls = "border-border bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30";
            if (answered) {
              if (idx === q.correct_index) cls = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
              else if (idx === selected) cls = "border-destructive bg-destructive/10 text-destructive";
              else cls = "border-border bg-muted/20 opacity-50";
            }
            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={answered}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm flex items-center gap-3 ${cls}`}
              >
                <span className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{opt}</span>
                {answered && idx === q.correct_index && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                {answered && idx === selected && idx !== q.correct_index && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
              </button>
            );
          })}

          {/* Explanation */}
          {answered && (
            <div className={`mt-4 p-3 rounded-lg border text-sm ${
              selected === q.correct_index
                ? "border-green-500/30 bg-green-500/5 text-foreground"
                : "border-destructive/30 bg-destructive/5 text-foreground"
            }`}>
              <p className="font-semibold mb-1">
                {selected === q.correct_index ? `✅ ${tt("correct")}` : `❌ ${tt("wrong")}`}
              </p>
              <p className="text-muted-foreground">{q.explanation}</p>
            </div>
          )}

          {answered && (
            <Button onClick={handleNext} className="w-full mt-2">
              {currentQ < questions.length - 1 ? (
                <>{tt("next")}<ArrowRight className="w-4 h-4 ml-2" /></>
              ) : (
                <>{tt("finish")}<Trophy className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizModule;
