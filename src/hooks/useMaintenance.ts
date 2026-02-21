import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MaintenancePhoto {
  url: string;
  type: "before" | "after";
  caption: string;
  uploaded_at: string;
}

export interface MaintenanceRecord {
  id: string;
  machine_id: string;
  maintenance_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  technician_name: string | null;
  cost: number;
  duration_minutes: number;
  parts_used: any[];
  photos: MaintenancePhoto[];
  notes: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  machine_id: string;
  title: string;
  maintenance_type: string;
  interval_hours: number | null;
  interval_days: number | null;
  last_performed_at: string | null;
  last_performed_hours: number;
  current_hours: number;
  next_due_date: string | null;
  is_active: boolean;
  checklist: ChecklistItem[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  item: string;
  checked: boolean;
  note?: string;
}

export interface ChecklistLog {
  id: string;
  schedule_id: string;
  machine_id: string;
  completed_by: string;
  completed_by_name: string | null;
  checklist_results: ChecklistItem[];
  completion_date: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

export const useMaintenance = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [checklistLogs, setChecklistLogs] = useState<ChecklistLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_records" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRecords(data as any[]);
  }, []);

  const loadSchedules = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_schedules" as any)
      .select("*")
      .order("next_due_date", { ascending: true });
    if (data) setSchedules(data as any[]);
  }, []);

  const loadChecklistLogs = useCallback(async () => {
    const { data } = await supabase
      .from("maintenance_checklist_logs" as any)
      .select("*")
      .order("completion_date", { ascending: false })
      .limit(50);
    if (data) setChecklistLogs(data as any[]);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadRecords(), loadSchedules(), loadChecklistLogs()]);
    setLoading(false);
  }, [loadRecords, loadSchedules, loadChecklistLogs]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // CRUD for records
  const addRecord = useCallback(async (record: Partial<MaintenanceRecord>) => {
    if (!user) return;
    const { error } = await supabase
      .from("maintenance_records" as any)
      .insert({ ...record, created_by: user.id } as any);
    if (!error) await loadRecords();
    return error;
  }, [user, loadRecords]);

  const updateRecord = useCallback(async (id: string, updates: Partial<MaintenanceRecord>) => {
    const { error } = await supabase
      .from("maintenance_records" as any)
      .update(updates as any)
      .eq("id", id);
    if (!error) await loadRecords();
    return error;
  }, [loadRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("maintenance_records" as any)
      .delete()
      .eq("id", id);
    if (!error) await loadRecords();
    return error;
  }, [loadRecords]);

  // CRUD for schedules
  const addSchedule = useCallback(async (schedule: Partial<MaintenanceSchedule>) => {
    if (!user) return;
    const { error } = await supabase
      .from("maintenance_schedules" as any)
      .insert({ ...schedule, created_by: user.id } as any);
    if (!error) await loadSchedules();
    return error;
  }, [user, loadSchedules]);

  const updateSchedule = useCallback(async (id: string, updates: Partial<MaintenanceSchedule>) => {
    const { error } = await supabase
      .from("maintenance_schedules" as any)
      .update(updates as any)
      .eq("id", id);
    if (!error) await loadSchedules();
    return error;
  }, [loadSchedules]);

  const deleteSchedule = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("maintenance_schedules" as any)
      .delete()
      .eq("id", id);
    if (!error) await loadSchedules();
    return error;
  }, [loadSchedules]);

  // Complete checklist
  const completeChecklist = useCallback(async (
    scheduleId: string,
    machineId: string,
    results: ChecklistItem[],
    durationMinutes: number,
    notes?: string
  ) => {
    if (!user) return;
    const userName = user.user_metadata?.display_name || user.email || "Bilinmiyor";
    
    const { error } = await supabase
      .from("maintenance_checklist_logs" as any)
      .insert({
        schedule_id: scheduleId,
        machine_id: machineId,
        completed_by: user.id,
        completed_by_name: userName,
        checklist_results: results,
        duration_minutes: durationMinutes,
        notes,
      } as any);

    if (!error) {
      // Update schedule's last performed
      await supabase
        .from("maintenance_schedules" as any)
        .update({
          last_performed_at: new Date().toISOString(),
          next_due_date: (() => {
            const schedule = schedules.find(s => s.id === scheduleId);
            if (schedule?.interval_days) {
              const next = new Date();
              next.setDate(next.getDate() + schedule.interval_days);
              return next.toISOString().split("T")[0];
            }
            return null;
          })(),
        } as any)
        .eq("id", scheduleId);

      await Promise.all([loadSchedules(), loadChecklistLogs()]);
    }
    return error;
  }, [user, schedules, loadSchedules, loadChecklistLogs]);

  // Alerts: schedules that are overdue or near due
  const getAlerts = useCallback(() => {
    const now = new Date();
    const alerts: { schedule: MaintenanceSchedule; type: "overdue" | "warning" | "hours_warning" }[] = [];

    for (const s of schedules) {
      if (!s.is_active) continue;

      // Date-based check
      if (s.next_due_date) {
        const dueDate = new Date(s.next_due_date);
        if (dueDate < now) {
          alerts.push({ schedule: s, type: "overdue" });
        } else {
          const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 7) {
            alerts.push({ schedule: s, type: "warning" });
          }
        }
      }

      // Hours-based check
      if (s.interval_hours && s.current_hours > 0) {
        const hoursSinceLast = s.current_hours - s.last_performed_hours;
        if (hoursSinceLast >= s.interval_hours) {
          alerts.push({ schedule: s, type: "overdue" });
        } else if (hoursSinceLast >= s.interval_hours * 0.9) {
          alerts.push({ schedule: s, type: "hours_warning" });
        }
      }
    }

    return alerts;
  }, [schedules]);

  return {
    records,
    schedules,
    checklistLogs,
    loading,
    addRecord,
    updateRecord,
    deleteRecord,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    completeChecklist,
    getAlerts,
    reload: loadAll,
  };
};
