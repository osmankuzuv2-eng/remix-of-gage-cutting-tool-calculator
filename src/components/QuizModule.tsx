import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Brain, Trophy, ArrowRight, CheckCircle2, XCircle, Loader2,
  RotateCcw, Star, Zap, Target, ChevronRight, BarChart3, Clock,
  TrendingUp, Award, Calendar,
} from "lucide-react";

type Question = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type Level = "easy" | "medium" | "hard";

type QuizResult = {
  id: string;
  level: string;
  topic: string | null;
  score: number;
  total_questions: number;
  passed: boolean;
  duration_seconds: number | null;
  created_at: string;
};

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
  quizTab: { tr: "Quiz", en: "Quiz", fr: "Quiz" },
  statsTab: { tr: "İstatistikler", en: "Statistics", fr: "Statistiques" },
  totalQuizzes: { tr: "Toplam Quiz", en: "Total Quizzes", fr: "Total Quiz" },
  avgScore: { tr: "Ort. Başarı", en: "Avg. Score", fr: "Moy. Score" },
  passRate: { tr: "Geçme Oranı", en: "Pass Rate", fr: "Taux réussite" },
  bestStreak: { tr: "En İyi Seri", en: "Best Streak", fr: "Meilleure série" },
  recentResults: { tr: "Son Sonuçlar", en: "Recent Results", fr: "Résultats récents" },
  noStats: { tr: "Henüz quiz çözmediniz", en: "No quizzes taken yet", fr: "Aucun quiz passé" },
  duration: { tr: "Süre", en: "Duration", fr: "Durée" },
  saved: { tr: "Sonuç kaydedildi", en: "Result saved", fr: "Résultat sauvegardé" },
  byLevel: { tr: "Seviyeye Göre", en: "By Level", fr: "Par niveau" },
  byTopic: { tr: "Konuya Göre", en: "By Topic", fr: "Par sujet" },
};

const QuizModule = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const lang = language || "tr";

  const [level, setLevel] = useState<Level>("easy");
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<"setup" | "quiz" | "result">("setup");
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("quiz");

  // Stats
  const [stats, setStats] = useState<QuizResult[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Timer
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tt = (key: string) => t_quiz[key]?.[lang] || t_quiz[key]?.tr || key;

  const loadStats = useCallback(async () => {
    if (!user) return;
    setStatsLoading(true);
    const { data } = await supabase
      .from("quiz_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setStats(data as QuizResult[]);
    setStatsLoading(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === "stats") loadStats();
  }, [activeTab, loadStats]);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => () => stopTimer(), []);

  const saveResult = useCallback(async (finalScore: number, didPass: boolean) => {
    if (!user) return;
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    stopTimer();
    try {
      await supabase.from("quiz_results").insert({
        user_id: user.id,
        level,
        topic: topic || null,
        score: finalScore,
        total_questions: questions.length,
        passed: didPass,
        questions: questions as any,
        answers: answers as any,
        duration_seconds: duration,
      } as any);
      toast({ title: "✅", description: tt("saved") });
    } catch (err) {
      console.error("Save error:", err);
    }
  }, [user, level, topic, questions, answers]);

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
      setAnswers([]);
      setPhase("quiz");
      startTimer();
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
    setAnswers(prev => [...prev, idx]);
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
      const finalScore = score;
      const didPass = finalScore >= LEVEL_CONFIG[level].minScore;
      saveResult(finalScore, didPass);
      setPhase("result");
    }
  };

  const levelConfig = LEVEL_CONFIG[level];
  const passed = score >= levelConfig.minScore;

  const handleNextLevel = () => {
    const levels: Level[] = ["easy", "medium", "hard"];
    const nextIdx = levels.indexOf(level) + 1;
    if (nextIdx < levels.length) setLevel(levels[nextIdx]);
    setPhase("setup");
  };

  const handleRetry = () => setPhase("setup");

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Computed stats
  const totalQuizzes = stats.length;
  const avgScore = totalQuizzes > 0 ? Math.round(stats.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / totalQuizzes) : 0;
  const passRate = totalQuizzes > 0 ? Math.round((stats.filter(r => r.passed).length / totalQuizzes) * 100) : 0;
  const bestStreak = (() => {
    let max = 0, cur = 0;
    for (const r of [...stats].reverse()) { if (r.passed) { cur++; max = Math.max(max, cur); } else cur = 0; }
    return max;
  })();

  const levelStats = (["easy", "medium", "hard"] as Level[]).map(lv => {
    const filtered = stats.filter(r => r.level === lv);
    const count = filtered.length;
    const avg = count > 0 ? Math.round(filtered.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / count) : 0;
    return { level: lv, count, avg };
  });

  const topicStats = TOPICS.filter(t => t.key).map(t => {
    const filtered = stats.filter(r => r.topic === t.key);
    const count = filtered.length;
    const avg = count > 0 ? Math.round(filtered.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / count) : 0;
    return { topic: t, count, avg };
  }).filter(t => t.count > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
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

      {phase === "setup" && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="quiz" className="flex-1"><Brain className="w-4 h-4 mr-1" />{tt("quizTab")}</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1"><BarChart3 className="w-4 h-4 mr-1" />{tt("statsTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="quiz">
            <Card className="border-border bg-card">
              <CardContent className="p-6 space-y-6">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{tt("topic")}</label>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button key={t.key} onClick={() => setTopic(t.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          topic === t.key ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/30 border-border text-foreground hover:border-primary/40"
                        }`}>{t.label[lang] || t.label.tr}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">{tt("level")}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(LEVEL_CONFIG) as Level[]).map((lv) => {
                      const cfg = LEVEL_CONFIG[lv]; const LvIcon = cfg.icon;
                      return (
                        <button key={lv} onClick={() => setLevel(lv)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                            level === lv ? "border-primary bg-primary/10 shadow-md scale-[1.02]" : "border-border bg-card hover:border-primary/30 hover:scale-[1.01]"
                          }`}>
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
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{tt("loading")}</> : <><Brain className="w-4 h-4 mr-2" />{tt("start")}</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            {statsLoading ? (
              <Card className="border-border bg-card"><CardContent className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></CardContent></Card>
            ) : stats.length === 0 ? (
              <Card className="border-border bg-card"><CardContent className="p-8 text-center text-muted-foreground"><BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>{tt("noStats")}</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard icon={Brain} label={tt("totalQuizzes")} value={totalQuizzes.toString()} />
                  <StatCard icon={TrendingUp} label={tt("avgScore")} value={`%${avgScore}`} />
                  <StatCard icon={Award} label={tt("passRate")} value={`%${passRate}`} />
                  <StatCard icon={Trophy} label={tt("bestStreak")} value={bestStreak.toString()} />
                </div>

                {/* By level */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{tt("byLevel")}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {levelStats.map(ls => {
                      const cfg = LEVEL_CONFIG[ls.level];
                      return (
                        <div key={ls.level} className="flex items-center gap-3">
                          <Badge className={`bg-gradient-to-r ${cfg.color} text-white border-0 min-w-[60px] justify-center`}>
                            {cfg.label[lang] || cfg.label.tr}
                          </Badge>
                          <div className="flex-1">
                            <Progress value={ls.avg} className="h-2" />
                          </div>
                          <span className="text-sm font-mono text-muted-foreground w-16 text-right">%{ls.avg} ({ls.count})</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* By topic */}
                {topicStats.length > 0 && (
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{tt("byTopic")}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {topicStats.map(ts => (
                        <div key={ts.topic.key} className="flex items-center gap-3">
                          <span className="text-sm text-foreground min-w-[120px]">{ts.topic.label[lang] || ts.topic.label.tr}</span>
                          <div className="flex-1"><Progress value={ts.avg} className="h-2" /></div>
                          <span className="text-sm font-mono text-muted-foreground w-16 text-right">%{ts.avg} ({ts.count})</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Recent results */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{tt("recentResults")}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.slice(0, 15).map(r => {
                        const cfg = LEVEL_CONFIG[r.level as Level] || LEVEL_CONFIG.easy;
                        const topicLabel = TOPICS.find(t => t.key === r.topic)?.label[lang] || TOPICS.find(t => t.key === r.topic)?.label.tr || tt("topic");
                        return (
                          <div key={r.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20 border border-border/50">
                            {r.passed ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                            <Badge className={`bg-gradient-to-r ${cfg.color} text-white border-0 text-[10px]`}>
                              {cfg.label[lang] || cfg.label.tr}
                            </Badge>
                            {r.topic && <span className="text-xs text-muted-foreground">{topicLabel}</span>}
                            <span className="text-sm font-mono font-semibold text-foreground ml-auto">{r.score}/{r.total_questions}</span>
                            {r.duration_seconds && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(r.duration_seconds)}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{new Date(r.created_at).toLocaleDateString(lang === "tr" ? "tr-TR" : lang === "fr" ? "fr-FR" : "en-US")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Result phase */}
      {phase === "result" && (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${levelConfig.color} flex items-center justify-center`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{tt("result")}</h2>
            <div className="text-4xl font-mono font-bold text-primary">{score}/{questions.length}</div>
            {elapsed > 0 && (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><Clock className="w-4 h-4" />{tt("duration")}: {formatDuration(elapsed)}</p>
            )}
            <p className={`text-lg font-semibold ${passed ? "text-green-500" : "text-destructive"}`}>
              {passed ? tt("passed") : tt("failed")}
            </p>
            {passed && level !== "hard" && <p className="text-sm text-muted-foreground">{tt("levelUp")}</p>}
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={handleRetry}><RotateCcw className="w-4 h-4 mr-2" />{tt("tryAgain")}</Button>
              {passed && level !== "hard" && (
                <Button onClick={handleNextLevel}>{tt("nextLevel")}<ChevronRight className="w-4 h-4 ml-1" /></Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quiz phase */}
      {phase === "quiz" && (() => {
        const q = questions[currentQ];
        const progress = ((currentQ + (answered ? 1 : 0)) / questions.length) * 100;
        return (
          <>
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={`bg-gradient-to-r ${levelConfig.color} text-white border-0`}>
                    {levelConfig.label[lang] || levelConfig.label.tr}
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />{formatDuration(elapsed)}
                  </span>
                  <span className="text-sm text-muted-foreground">{tt("question")} {currentQ + 1}/{questions.length}</span>
                  <Badge variant="outline" className="border-primary/40 text-primary">{tt("score")}: {score}</Badge>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="text-base leading-relaxed">{q.question}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {q.options.map((opt, idx) => {
                  let cls = "border-border bg-secondary/20 hover:bg-secondary/40 hover:border-primary/30";
                  if (answered) {
                    if (idx === q.correct_index) cls = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                    else if (idx === selected) cls = "border-destructive bg-destructive/10 text-destructive";
                    else cls = "border-border bg-muted/20 opacity-50";
                  }
                  return (
                    <button key={idx} onClick={() => handleSelect(idx)} disabled={answered}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm flex items-center gap-3 ${cls}`}>
                      <span className="w-7 h-7 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {answered && idx === q.correct_index && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                      {answered && idx === selected && idx !== q.correct_index && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                    </button>
                  );
                })}
                {answered && (
                  <div className={`mt-4 p-3 rounded-lg border text-sm ${
                    selected === q.correct_index ? "border-green-500/30 bg-green-500/5 text-foreground" : "border-destructive/30 bg-destructive/5 text-foreground"
                  }`}>
                    <p className="font-semibold mb-1">{selected === q.correct_index ? `✅ ${tt("correct")}` : `❌ ${tt("wrong")}`}</p>
                    <p className="text-muted-foreground">{q.explanation}</p>
                  </div>
                )}
                {answered && (
                  <Button onClick={handleNext} className="w-full mt-2">
                    {currentQ < questions.length - 1 ? <>{tt("next")}<ArrowRight className="w-4 h-4 ml-2" /></> : <>{tt("finish")}<Trophy className="w-4 h-4 ml-2" /></>}
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        );
      })()}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) => (
  <Card className="border-border bg-card">
    <CardContent className="p-4 text-center">
      <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
      <div className="text-2xl font-mono font-bold text-primary">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </CardContent>
  </Card>
);

export default QuizModule;
