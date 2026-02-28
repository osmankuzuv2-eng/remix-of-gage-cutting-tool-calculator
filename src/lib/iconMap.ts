import {
  Calculator, Clock, Database, DollarSign, History, GitCompare, Wrench, Circle,
  BotMessageSquare, FileImage, Ruler, Cpu, BarChart3, FolderOpen, Flame, Atom,
  Gem, Zap, Cog, Sparkles, Settings, BookOpen, Search, Target, Layers, Users,
  TrendingUp, Brain, TrendingDown, Video, FileText,
  type LucideIcon,
} from "lucide-react";

export const iconMap: Record<string, LucideIcon> = {
  Calculator, Clock, Database, DollarSign, History, GitCompare, Wrench, Circle,
  BotMessageSquare, FileImage, Ruler, Cpu, BarChart3, FolderOpen, Flame, Atom,
  Gem, Zap, Cog, Sparkles, Settings, BookOpen, Search, Target, Layers, Users, TrendingDown, Video, FileText,
};

export const getIcon = (name: string): LucideIcon => iconMap[name] || Sparkles;

// Module-specific icons
export const moduleIcons: Record<string, LucideIcon> = {
  "ai-learn": BotMessageSquare,
  "drawing": FileImage,
  "cutting": Calculator,
  "toollife": Clock,
  "threading": Wrench,
  "drilling": Circle,
  "tolerance": Ruler,
  "costcalc": DollarSign,
  "cost": DollarSign,
  "compare": GitCompare,
  "materials": Database,
  "history": History,
  "afkprice": DollarSign,
  "currency-tracker": TrendingUp,
  "maintenance": Wrench,
  "quiz": Brain,
  "time-improvements": TrendingDown,
  "video-training": Video,
  "toolroom-report": BarChart3,
};
