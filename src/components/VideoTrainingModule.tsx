import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Search, BookOpen, Clock, Youtube, ExternalLink, Plus, Trash2,
  FileText, StickyNote, Globe, X, Download, Link2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────── */
interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnail_url: string | null;
  operation_type: string;
  difficulty: string;
  duration_minutes: number | null;
  author: string | null;
  view_count: number;
  subtitle_languages: string[];
  pdf_docs: { name: string; url: string }[];
  created_at: string;
  created_by: string | null;
}

interface VideoNote {
  id: string;
  video_id: string;
  user_id: string;
  timestamp_seconds: number;
  note: string;
  created_at: string;
}

/* ─── Constants (keys only, labels resolved via t()) ─── */
const OPERATION_TYPE_VALUES = ["all", "turning", "milling", "grinding", "drilling", "threading", "programming", "measurement", "maintenance", "other"] as const;
const OPERATION_TYPE_KEYS: Record<string, string> = {
  all: "opAll", turning: "opTurning", milling: "opMilling", grinding: "opGrinding",
  drilling: "opDrilling", threading: "opThreading", programming: "opProgramming",
  measurement: "opMeasurement", maintenance: "opMaintenance", other: "opOther",
};

const DIFFICULTY_LEVELS_CONFIG = [
  { value: "beginner", key: "diffBeginner", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { value: "intermediate", key: "diffIntermediate", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "advanced", key: "diffAdvanced", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
];

const SUBTITLE_LANGS = [
  { value: "tr", label: "🇹🇷 Türkçe" },
  { value: "en", label: "🇬🇧 English" },
  { value: "fr", label: "🇫🇷 Français" },
];

/* ─── Helpers ────────────────────────────────────────── */
const getYoutubeThumbnail = (url: string) => {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};

const getEmbedUrl = (url: string, subtitleLang?: string): string => {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) {
    const base = `https://www.youtube.com/embed/${ytMatch[1]}?enablejsapi=1&cc_load_policy=1`;
    return subtitleLang ? `${base}&cc_lang_pref=${subtitleLang}&hl=${subtitleLang}` : base;
  }
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    const base = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return subtitleLang ? `${base}?texttrack=${subtitleLang}` : base;
  }
  return url;
};

const detectPlatform = (url: string) => {
  if (url.match(/youtube\.com|youtu\.be/)) return "youtube";
  if (url.match(/vimeo\.com/)) return "vimeo";
  return "other";
};

const formatSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/* ─── Component ──────────────────────────────────────── */
export default function VideoTrainingModule() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const OPERATION_TYPES = OPERATION_TYPE_VALUES.map(v => ({ value: v, label: t("video", OPERATION_TYPE_KEYS[v] || "opOther") }));
  const DIFFICULTY_LEVELS = DIFFICULTY_LEVELS_CONFIG.map(d => ({ ...d, label: t("video", d.key) }));

  /* state */
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOp, setFilterOp] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [prevFilterOp, setPrevFilterOp] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  /* watch dialog state */
  const [subtitleLang, setSubtitleLang] = useState("tr");
  const [notes, setNotes] = useState<VideoNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteTime, setNoteTime] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* add form */
  const emptyForm = {
    title: "", description: "", url: "", operation_type: "turning",
    difficulty: "beginner", duration_minutes: "", author: "",
    subtitle_languages: [] as string[],
    pdf_docs: [] as { name: string; url: string }[],
    pdfName: "", pdfUrl: "",
  };
  const [form, setForm] = useState(emptyForm);

  /* ─── Load ── */
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(data?.some(r => r.role === "admin") ?? false);
    });
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("training_videos").select("*").order("created_at", { ascending: false });
    if (data) setVideos(data as TrainingVideo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadNotes = useCallback(async (videoId: string) => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("video_notes").select("*")
      .eq("video_id", videoId).eq("user_id", user.id)
      .order("timestamp_seconds");
    if (data) setNotes(data as VideoNote[]);
  }, [user]);

  /* ─── Watch ── */
  const handleWatch = async (video: TrainingVideo) => {
    setSelectedVideo(video);
    setSubtitleLang("tr");
    setNoteText("");
    setNoteTime(0);
    loadNotes(video.id);
    await (supabase as any).from("training_videos")
      .update({ view_count: video.view_count + 1 }).eq("id", video.id);
  };

  /* ─── Notes ── */
  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedVideo || !user) return;
    const { error } = await (supabase as any).from("video_notes").insert({
      video_id: selectedVideo.id, user_id: user.id,
      timestamp_seconds: noteTime, note: noteText.trim(),
    });
    if (error) { toast.error("Not eklenemedi."); return; }
    setNoteText("");
    loadNotes(selectedVideo.id);
    toast.success("Not eklendi.");
  };

  const handleDeleteNote = async (noteId: string) => {
    await (supabase as any).from("video_notes").delete().eq("id", noteId);
    if (selectedVideo) loadNotes(selectedVideo.id);
  };

  /* ─── Add video ── */
  const handleAdd = async () => {
    if (!form.title || !form.url) return toast.error("Başlık ve URL zorunludur.");
    const thumbnail = getYoutubeThumbnail(form.url) || null;
    const { error } = await (supabase as any).from("training_videos").insert({
      title: form.title, description: form.description || null, url: form.url,
      thumbnail_url: thumbnail, operation_type: form.operation_type,
      difficulty: form.difficulty,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      author: form.author || null, created_by: user?.id,
      subtitle_languages: form.subtitle_languages,
      pdf_docs: form.pdf_docs,
    });
    if (error) { toast.error("Video eklenemedi."); return; }
    toast.success("Video eklendi!");
    setShowAddDialog(false);
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("training_videos").delete().eq("id", id);
    toast.success(t("video", "deleteSuccess"));
    load();
  };

  /* ─── Filter ── */
  const filtered = videos.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = v.title.toLowerCase().includes(q) ||
      (v.description || "").toLowerCase().includes(q) ||
      (v.author || "").toLowerCase().includes(q);
    const matchOp = filterOp === "all" || v.operation_type === filterOp;
    const matchDiff = filterDiff === "all" || v.difficulty === filterDiff;
    return matchSearch && matchOp && matchDiff;
  });

  const getDiff = (val: string) => DIFFICULTY_LEVELS.find(d => d.value === val);
  const getOpLabel = (val: string) => OPERATION_TYPES.find(o => o.value === val)?.label || val;

  /* ─── Render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-violet-400" />
            {t("video", "title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{t("video", "subtitle")}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddDialog(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            <Plus className="w-4 h-4" /> {t("video", "addVideo")}
          </Button>
        )}
      </div>

      {/* Operation category pill buttons */}
      <div className="flex flex-wrap gap-2">
        {OPERATION_TYPES.map(op => {
          const count = videos.filter(v => op.value === "all" ? true : v.operation_type === op.value).length;
          const isActive = filterOp === op.value;
          return (
            <button
              key={op.value}
              onClick={() => setFilterOp(op.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                isActive
                  ? "bg-violet-600 text-white border-violet-600 shadow-md scale-[1.04]"
                  : "bg-card border-border text-muted-foreground hover:border-violet-500/50 hover:text-foreground hover:scale-[1.02]"
              }`}
            >
              {op.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? "bg-white/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t("video", "searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterDiff} onValueChange={setFilterDiff}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("video", "level")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("video", "allLevels")}</SelectItem>
            {DIFFICULTY_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("video", "totalVideos"), value: videos.length },
          { label: t("video", "operations"), value: [...new Set(videos.map(v => v.operation_type))].length },
          { label: t("video", "views"), value: videos.reduce((s, v) => s + v.view_count, 0) },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-violet-400">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t("video", "loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Youtube className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">{videos.length === 0 ? t("video", "noVideos") : t("video", "noResults")}</p>
          {isAdmin && videos.length === 0 && (
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> {t("video", "addFirstVideo")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(video => {
            const diff = getDiff(video.difficulty);
            const platform = detectPlatform(video.url);
            return (
              <div key={video.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-violet-500/40 hover:shadow-lg transition-all duration-200 group">
                <div className="relative aspect-video bg-muted cursor-pointer" onClick={() => handleWatch(video)}>
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-14 h-14 bg-violet-600 rounded-full flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-white ml-1" />
                    </div>
                  </div>
                  {video.duration_minutes && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {video.duration_minutes} dk
                    </div>
                  )}
                  {/* Platform badge */}
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {platform === "vimeo" ? "Vimeo" : platform === "youtube" ? "YT" : "Video"}
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 flex-1">{video.title}</h3>
                    {isAdmin && (
                      <button onClick={() => handleDelete(video.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-400 border-violet-500/30">{getOpLabel(video.operation_type)}</Badge>
                    {diff && <Badge variant="outline" className={`text-xs ${diff.cls}`}>{diff.label}</Badge>}
                    {video.subtitle_languages?.length > 0 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground gap-1"><Globe className="w-3 h-3" />{video.subtitle_languages.join(", ").toUpperCase()}</Badge>
                    )}
                  </div>
                  {video.description && <p className="text-xs text-muted-foreground line-clamp-2">{video.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-2">
                      <span>{video.author || "Anonim"}</span>
                      {video.pdf_docs?.length > 0 && (
                        <span className="flex items-center gap-0.5 text-violet-400">
                          <FileText className="w-3 h-3" />{video.pdf_docs.length}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {video.view_count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Watch Dialog ── */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Play className="w-5 h-5 text-violet-400" />
              {selectedVideo?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              {/* Subtitle selector */}
              {(selectedVideo.subtitle_languages?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Altyazı:</span>
                  <div className="flex gap-1.5">
                    {selectedVideo.subtitle_languages.map(lang => {
                      const sl = SUBTITLE_LANGS.find(s => s.value === lang);
                      return (
                        <button
                          key={lang}
                          onClick={() => setSubtitleLang(lang)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${subtitleLang === lang ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:border-violet-500/50"}`}
                        >
                          {sl?.label || lang.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Player */}
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                <iframe
                  ref={iframeRef}
                  key={`${selectedVideo.id}-${subtitleLang}`}
                  src={getEmbedUrl(selectedVideo.url, subtitleLang)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>

              {/* Tags + external link */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30">{getOpLabel(selectedVideo.operation_type)}</Badge>
                {getDiff(selectedVideo.difficulty) && (
                  <Badge variant="outline" className={getDiff(selectedVideo.difficulty)!.cls}>{getDiff(selectedVideo.difficulty)!.label}</Badge>
                )}
                {selectedVideo.duration_minutes && (
                  <Badge variant="outline" className="text-muted-foreground"><Clock className="w-3 h-3 mr-1" />{selectedVideo.duration_minutes} {t("video", "durationMin")}</Badge>
                )}
                <a href={selectedVideo.url} target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs text-violet-400 hover:underline">
                  <ExternalLink className="w-3 h-3" />
                  {detectPlatform(selectedVideo.url) === "vimeo" ? t("video", "openOnVimeo") : t("video", "openOnYoutube")}
                </a>
              </div>

              {/* PDF Docs */}
              {selectedVideo.pdf_docs?.length > 0 && (
                <div className="border border-border rounded-xl p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" /> {t("video", "attachments")}
                  </h4>
                  <div className="space-y-1.5">
                    {selectedVideo.pdf_docs.map((doc, i) => (
                      <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-foreground hover:text-violet-400 transition-colors group/doc">
                        <Download className="w-4 h-4 text-muted-foreground group-hover/doc:text-violet-400" />
                        {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamped Notes */}
              {user && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-violet-400" /> {t("video", "timestampedNotes")}
                  </h4>

                  {/* Add note */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 bg-muted border border-border rounded-lg px-2 py-1 min-w-[80px]">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <input
                        type="number" min={0} max={9999}
                        value={noteTime}
                        onChange={e => setNoteTime(Number(e.target.value))}
                        className="bg-transparent w-12 text-xs text-foreground outline-none"
                        placeholder={t("video", "seconds")}
                      />
                      <span className="text-xs text-muted-foreground">{t("video", "seconds")}</span>
                    </div>
                    <Input
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder={t("video", "addNote")}
                      className="flex-1 text-sm"
                      onKeyDown={e => { if (e.key === "Enter") handleAddNote(); }}
                    />
                    <Button size="sm" onClick={handleAddNote} className="bg-violet-600 hover:bg-violet-700 shrink-0">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Notes list */}
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">{t("video", "noNotes")}</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {notes.map(n => (
                        <div key={n.id} className="flex items-start gap-2 group/note">
                          <button
                            onClick={() => {
                              // Reload iframe at timestamp
                              const embedUrl = getEmbedUrl(selectedVideo.url, subtitleLang);
                              const withStart = embedUrl.includes("?")
                                ? `${embedUrl}&start=${n.timestamp_seconds}`
                                : `${embedUrl}?start=${n.timestamp_seconds}`;
                              if (iframeRef.current) iframeRef.current.src = withStart;
                            }}
                            className="shrink-0 font-mono text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2 py-0.5 rounded hover:bg-violet-500/30 transition-colors"
                          >
                            {formatSeconds(n.timestamp_seconds)}
                          </button>
                          <span className="text-sm text-foreground flex-1">{n.note}</span>
                          <button
                            onClick={() => handleDeleteNote(n.id)}
                            className="opacity-0 group-hover/note:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedVideo.description && (
                <p className="text-sm text-muted-foreground border-t border-border pt-3">{selectedVideo.description}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("video", "newVideoDialog")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("video", "titleLabel")}</label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("video", "titlePlaceholder")} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("video", "urlLabel")}</label>
              <Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder={t("video", "urlPlaceholder")} />
              {form.url && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("video", "platform")} <span className="text-violet-400 capitalize">{detectPlatform(form.url)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("video", "descriptionLabel")}</label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t("video", "descriptionPlaceholder")} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("video", "operation")}</label>
                <Select value={form.operation_type} onValueChange={v => setForm(p => ({ ...p, operation_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OPERATION_TYPES.filter(o => o.value !== "all").map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("video", "difficulty")}</label>
                <Select value={form.difficulty} onValueChange={v => setForm(p => ({ ...p, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DIFFICULTY_LEVELS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("video", "durationLabel")}</label>
                <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} placeholder="15" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t("video", "authorLabel")}</label>
                <Input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder={t("video", "authorPlaceholder")} />
              </div>
            </div>

            {/* Subtitle languages */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                <Globe className="w-3 h-3" /> {t("video", "subtitleLangs")}
              </label>
              <div className="flex gap-2">
                {SUBTITLE_LANGS.map(sl => (
                  <button
                    key={sl.value}
                    type="button"
                    onClick={() => {
                      const has = form.subtitle_languages.includes(sl.value);
                      setForm(p => ({ ...p, subtitle_languages: has ? p.subtitle_languages.filter(l => l !== sl.value) : [...p.subtitle_languages, sl.value] }));
                    }}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${form.subtitle_languages.includes(sl.value) ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:border-violet-500/50"}`}
                  >
                    {sl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF Docs */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                <FileText className="w-3 h-3" /> Ek PDF Dökümanlar
              </label>
              {form.pdf_docs.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{doc.name}</span>
                  <button onClick={() => setForm(p => ({ ...p, pdf_docs: p.pdf_docs.filter((_, j) => j !== i) }))}
                    className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <Input value={form.pdfName} onChange={e => setForm(p => ({ ...p, pdfName: e.target.value }))} placeholder="Döküman adı" className="text-xs h-8" />
                <Input value={form.pdfUrl} onChange={e => setForm(p => ({ ...p, pdfUrl: e.target.value }))} placeholder="PDF URL" className="text-xs h-8" />
                <Button size="sm" variant="outline" className="h-8 shrink-0"
                  onClick={() => {
                    if (!form.pdfName || !form.pdfUrl) return;
                    setForm(p => ({ ...p, pdf_docs: [...p.pdf_docs, { name: p.pdfName, url: p.pdfUrl }], pdfName: "", pdfUrl: "" }));
                  }}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleAdd} className="flex-1 bg-violet-600 hover:bg-violet-700">Ekle</Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>İptal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
