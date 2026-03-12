import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Language } from "@/i18n/translations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";

const languages: { code: Language; flag: string; label: string }[] = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
];

type Step = "email" | "password";

interface ProfileInfo {
  display_name: string | null;
  avatar_url: string | null;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const Auth = () => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsCheckingEmail(true);
    try {
      const { data, error } = await supabase.rpc("get_profile_by_email", {
        p_email: email.trim(),
      });
      if (!error && data && data.length > 0) {
        setProfile({ display_name: data[0].display_name, avatar_url: data[0].avatar_url });
        setStep("password");
      } else {
        toast({
          title: "Kullanıcı Bulunamadı",
          description: "Bu e-posta adresiyle kayıtlı bir kullanıcı bulunmuyor.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Hata",
        description: "Kullanıcı sorgulanırken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { error, data } = await signIn(email, password);
      if (error) {
        const message = error.message.includes("Invalid login credentials")
          ? t("auth", "invalidCredentials")
          : t("auth", "loginError");
        toast({ title: t("common", "error"), description: message, variant: "destructive" });
      } else {
        if (data?.user) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", data.user.id)
            .maybeSingle();
          await supabase.from("login_logs" as any).insert({
            user_id: data.user.id,
            display_name: profileData?.display_name ?? data.user.email,
            email: data.user.email,
            user_agent: navigator.userAgent,
          } as any);
        }
        toast({ title: t("auth", "welcome"), description: t("auth", "loginSuccess") });
      }
    } catch {
      toast({ title: t("common", "error"), description: t("auth", "loginError"), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const currentLang = languages.find((l) => l.code === language)!;
  const displayName = profile?.display_name || email.split("@")[0];
  const initials = getInitials(displayName);

  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center p-4 relative">
      {/* Language Selector */}
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm">
              <span className="text-lg leading-none">{currentLang.flag}</span>
              <span className="text-xs font-medium text-foreground">{currentLang.label}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border border-border z-50 min-w-[140px]">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`flex items-center gap-2 cursor-pointer ${language === lang.code ? "bg-primary/10 text-primary font-medium" : ""}`}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-2 rounded-lg glow-accent">
              <img src={logo} alt="GAGE Logo" className="w-16 h-16 object-contain" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            GAGE Confidence ToolSense
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("auth", "loginTitle")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* STEP 1: Email */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">{t("auth", "email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-background border-border"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isCheckingEmail || !email.trim()}>
                {isCheckingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ...
                  </>
                ) : (
                  <>
                    Devam Et
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* STEP 2: Profile preview + Password */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              {/* Profile preview */}
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="relative">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shadow-md">
                      <span className="text-2xl font-bold text-primary">{initials}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[hsl(142,71%,45%)] rounded-full border-2 border-card" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">{t("auth", "password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-background border-border"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-none"
                  onClick={() => { setStep("email"); setPassword(""); setProfile(null); }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t("auth", "loggingIn")}
                    </>
                  ) : (
                    t("auth", "login")
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
