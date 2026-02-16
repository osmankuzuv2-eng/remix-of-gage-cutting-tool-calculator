import { Settings, LogOut, ShieldCheck } from "lucide-react";
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

const languages: { code: Language; flag: string; label: string }[] = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
];

interface HeaderProps {
  isAdmin?: boolean;
  onAdminClick?: () => void;
  adminActive?: boolean;
}

const Header = ({ isAdmin, onAdminClick, adminActive }: HeaderProps) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const current = languages.find((l) => l.code === language)!;

  return (
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
                  <span className="text-lg leading-none">{current.flag}</span>
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
                    <span className="text-lg leading-none">{lang.flag}</span>
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
  );
};

export default Header;
