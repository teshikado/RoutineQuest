"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { DynamicIcon } from "@/components/ui/icon";
import { RoutineForm, type RoutineFormValues } from "@/components/routines/routine-form";
import { useToast } from "@/components/toast";
import { CATEGORY_META, DIFFICULTY_META, WEEKDAY_LABELS } from "@/lib/constants";
import type { Category, Difficulty, Routine } from "@prisma/client";

function RoutineCard({
  routine,
  onEdit,
  onArchiveToggle,
  onDelete,
}: {
  routine: Routine;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const catMeta = CATEGORY_META[routine.category as Category];
  const diffMeta = DIFFICULTY_META[routine.difficulty as Difficulty];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: routine.color + "22" }}
        >
          <DynamicIcon name={routine.icon} className="h-5 w-5" style={{ color: routine.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[#183B56] truncate">{routine.title}</div>
          <div className="text-xs text-[#5b7a91]">
            {catMeta.label} · <span style={{ color: diffMeta.color }}>{diffMeta.label} (+{diffMeta.xp} XP)</span>
          </div>
        </div>
      </div>

      {routine.description && <p className="text-sm text-[#5b7a91]">{routine.description}</p>}

      <div className="flex gap-1">
        {Object.entries(WEEKDAY_LABELS).map(([day, label]) => (
          <span
            key={day}
            className={clsx(
              "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
              routine.scheduledDays.includes(Number(day))
                ? "bg-[#4FA8D8] text-white"
                : "bg-[#F5F7FA] text-[#c8d6e0]"
            )}
          >
            {label[0]}
          </span>
        ))}
      </div>

      {routine.timeOfDay && <div className="text-xs text-[#5b7a91]">Uhrzeit: {routine.timeOfDay}</div>}

      <div className="flex justify-end gap-1 pt-1 border-t border-[#F5F7FA] mt-1">
        <button
          onClick={onEdit}
          aria-label="Bearbeiten"
          className="p-2 rounded-lg text-[#5b7a91] hover:bg-[#EAF7FC] hover:text-[#4FA8D8]"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onArchiveToggle}
          aria-label={routine.archived ? "Wiederherstellen" : "Archivieren"}
          className="p-2 rounded-lg text-[#5b7a91] hover:bg-[#EAF7FC] hover:text-[#4FA8D8]"
        >
          {routine.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
        <button
          onClick={onDelete}
          aria-label="Löschen"
          className="p-2 rounded-lg text-[#5b7a91] hover:bg-[#FFF0EE] hover:text-[#FF8A80]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

function RoutinesClientInner({ initialRoutines }: { initialRoutines: Routine[] }) {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [routines, setRoutines] = useState(initialRoutines);
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [deleting, setDeleting] = useState<Routine | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens the create modal from the ?create=1 query param
    if (searchParams.get("create") === "1") setFormOpen(true);
  }, [searchParams]);

  const visible = routines.filter((r) => r.archived === showArchived);

  async function handleCreate(values: RoutineFormValues) {
    const res = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, description: values.description || null, timeOfDay: values.timeOfDay || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Routine konnte nicht erstellt werden.");
    setRoutines((r) => [...r, data]);
    setFormOpen(false);
    showToast("Routine erstellt!", "success");
  }

  async function handleUpdate(values: RoutineFormValues) {
    if (!editing) return;
    const res = await fetch(`/api/routines/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, description: values.description || null, timeOfDay: values.timeOfDay || null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Routine konnte nicht aktualisiert werden.");
    setRoutines((r) => r.map((rt) => (rt.id === data.id ? data : rt)));
    setEditing(null);
    showToast("Routine aktualisiert!", "success");
  }

  async function handleArchiveToggle(routine: Routine) {
    const res = await fetch(`/api/routines/${routine.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !routine.archived }),
    });
    const data = await res.json();
    if (res.ok) {
      setRoutines((r) => r.map((rt) => (rt.id === data.id ? data : rt)));
      showToast(data.archived ? "Routine archiviert." : "Routine wiederhergestellt.", "success");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/routines/${deleting.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    if (res.ok) {
      setRoutines((r) => r.filter((rt) => rt.id !== deleting.id));
      showToast("Routine gelöscht.", "success");
      setDeleting(null);
    } else {
      showToast("Löschen fehlgeschlagen.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#183B56]">Meine Routinen</h1>
          <p className="text-[#5b7a91] mt-1">Verwalte deine wiederkehrenden Aufgaben und Gewohnheiten.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Neue Routine
        </Button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowArchived(false)}
          className={clsx(
            "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors",
            !showArchived ? "bg-[#4FA8D8] text-white" : "bg-white text-[#5b7a91] border border-[#EAF7FC]"
          )}
        >
          Aktiv ({routines.filter((r) => !r.archived).length})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={clsx(
            "px-3 py-1.5 rounded-full text-sm font-semibold transition-colors",
            showArchived ? "bg-[#4FA8D8] text-white" : "bg-white text-[#5b7a91] border border-[#EAF7FC]"
          )}
        >
          Archiviert ({routines.filter((r) => r.archived).length})
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={showArchived ? "Archive" : "Sparkles"}
          title={showArchived ? "Keine archivierten Routinen" : "Noch keine Routinen"}
          description={
            showArchived
              ? "Archivierte Routinen erscheinen hier."
              : "Erstelle deine erste Routine, um mit dem Sammeln von XP zu beginnen."
          }
          action={
            !showArchived && (
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Neue Routine
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onEdit={() => setEditing(routine)}
              onArchiveToggle={() => handleArchiveToggle(routine)}
              onDelete={() => setDeleting(routine)}
            />
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Neue Routine">
        <RoutineForm onSubmit={handleCreate} onCancel={() => setFormOpen(false)} submitLabel="Erstellen" />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Routine bearbeiten">
        {editing && (
          <RoutineForm
            initialValues={{
              title: editing.title,
              description: editing.description ?? "",
              category: editing.category,
              icon: editing.icon,
              color: editing.color,
              difficulty: editing.difficulty,
              scheduledDays: editing.scheduledDays,
              timeOfDay: editing.timeOfDay ?? "",
              reminderEnabled: editing.reminderEnabled,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Speichern"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Routine löschen?"
        description={`"${deleting?.title}" wird endgültig gelöscht. Bereits gesammelte Statistiken bleiben erhalten.`}
        loading={deleteLoading}
      />
    </div>
  );
}

export function RoutinesClient(props: { initialRoutines: Routine[] }) {
  return (
    <Suspense>
      <RoutinesClientInner {...props} />
    </Suspense>
  );
}
