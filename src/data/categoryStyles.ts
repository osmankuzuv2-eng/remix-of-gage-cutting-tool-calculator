import { Cog, Zap, Gem, Flame, Atom, Sparkles, CircleDot } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CategoryStyle {
  icon: LucideIcon;
  gradient: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  badgeClass: string;
}

export const categoryStyles: Record<string, CategoryStyle> = {
  "Çelik": {
    icon: Cog,
    gradient: "from-blue-500 to-blue-700",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/30",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  },
  "Hafif Metal": {
    icon: Zap,
    gradient: "from-gray-300 to-gray-500",
    bgColor: "bg-gray-400/10",
    textColor: "text-gray-300",
    borderColor: "border-gray-400/30",
    badgeClass: "bg-gray-400/20 text-gray-200 border-gray-400/40",
  },
  "Bakır Alaşımı": {
    icon: Flame,
    gradient: "from-orange-400 to-yellow-600",
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/30",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  },
  "Demir": {
    icon: CircleDot,
    gradient: "from-slate-500 to-slate-700",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  "Özel Metal": {
    icon: Gem,
    gradient: "from-purple-500 to-violet-700",
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
    borderColor: "border-purple-500/30",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  "Süper Alaşım": {
    icon: Atom,
    gradient: "from-indigo-500 to-indigo-800",
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-400",
    borderColor: "border-indigo-500/30",
    badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  },
};

export const getDefaultStyle = (): CategoryStyle => ({
  icon: Sparkles,
  gradient: "from-emerald-500 to-teal-700",
  bgColor: "bg-emerald-500/10",
  textColor: "text-emerald-400",
  borderColor: "border-emerald-500/30",
  badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
});

export const getCategoryStyle = (category: string): CategoryStyle => {
  return categoryStyles[category] || getDefaultStyle();
};
