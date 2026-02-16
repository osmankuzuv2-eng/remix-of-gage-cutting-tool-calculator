import { Settings, LogOut, ShieldCheck, KeyRound } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Language } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const FlagTR = () => (
  <svg viewBox="0 0 1200 800" className="w-5 h-3.5 rounded-sm flex-shrink-0">
    <rect width="1200" height="800" fill="#E30A17" />
    <circle cx="425" cy="400" r="200" fill="#fff" />
    <circle cx="475" cy="400" r="160" fill="#E30A17" />
    <polygon fill="#fff" points="583,400 530,430 545,380 510,350 560,350" transform="rotate(18, 583, 400)" />
  </svg>
);

const FlagGB = () => (
  <svg viewBox="0 0 60 30" className="w-5 h-3.5 rounded-sm flex-shrink-0">
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
    <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
    <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

const FlagFR = () => (
  <svg viewBox="0 0 900 600" className="w-5 h-3.5 rounded-sm flex-shrink-0">
    <rect width="300" height="600" fill="#002395" />
    <rect x="300" width="300" height="600" fill="#fff" />
    <rect x="600" width="300" height="600" fill="#ED2939" />
  </svg>
);

const flagComponents: Record<Language, React.FC> = { tr: FlagTR, en: FlagGB, fr: FlagFR };

const languages: { code: Language; label: string }[] = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

interface HeaderProps {
  isAdmin?: boolean;
  onAdminClick?: () => void;
  adminActive?: boolean;
}

const Header = ({ isAdmin, onAdminClick, adminActive }: HeaderProps) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const current = languages.find((l) => l.code === language)!;
  const CurrentFlag = flagComponents[language];

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: t("auth", "passwordTooShort"), variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: t("auth", "passwordMismatch"), variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth", "passwordChanged") });
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <>
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1 rounded-lg glow-accent">
              <img src={logo} alt="GAGE Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {t("header", "title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("header", "subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm">
                  <CurrentFlag />
                  <span className="text-xs font-medium text-foreground hidden sm:inline">{current.label}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border z-50 min-w-[140px]">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex items-center gap-2 cursor-pointer ${language === lang.code ? "bg-primary/10 text-primary font-medium" : ""}`}
                  >
                    {(() => { const F = flagComponents[lang.code]; return <F />; })()}
                    <span>{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {user && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
                {isAdmin ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">Admin</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Personel</Badge>
                )}
                {isAdmin && onAdminClick && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={adminActive ? "default" : "ghost"}
                          size="icon"
                          onClick={onAdminClick}
                          className="relative"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <Badge variant="destructive" className="absolute -top-1.5 -right-1.5 px-1 py-0 text-[10px] leading-tight animate-pulse border-none shadow-sm">
                            Admin
                          </Badge>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("admin", "title")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPasswordDialog(true)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{t("auth", "changePassword")}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  title={t("auth", "logout")}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/20 border border-success/30">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              <span className="text-xs font-medium text-success">{t("common", "active")}</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    {/* Password Change Dialog */}
    <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("auth", "changePassword")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("auth", "newPassword")}</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("auth", "confirmPassword")}</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword} className="w-full">
            {changingPassword ? "..." : t("auth", "changePassword")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Header;
