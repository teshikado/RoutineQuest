"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { DynamicIcon } from "@/components/ui/icon";
import { ROUTINE_COLORS } from "@/lib/constants";

const GROUP_ICONS = ["Users", "Trophy", "Rocket", "Target", "Heart", "Star", "Flame", "Globe"];

export type GroupFormValues = {
  name: string;
  description: string;
  icon: string;
  color: string;
  maxMembers: string;
  isPrivate: boolean;
};

const DEFAULTS: GroupFormValues = {
  name: "",
  description: "",
  icon: "Users",
  color: ROUTINE_COLORS[0],
  maxMembers: "",
  isPrivate: true,
};

export function GroupForm({
  onSubmit,
  onCancel,
  submitLabel = "Gruppe erstellen",
  initialValues,
}: {
  onSubmit: (values: GroupFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  initialValues?: Partial<GroupFormValues>;
}) {
  const [values, setValues] = useState<GroupFormValues>({ ...DEFAULTS, ...initialValues });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (values.name.trim().length < 2) {
      setError("Der Gruppenname muss mindestens 2 Zeichen lang sein.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Etwas ist schiefgelaufen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="name">Gruppenname</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          maxLength={40}
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Beschreibung (optional)</Label>
        <textarea
          id="description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          rows={2}
          maxLength={200}
          className="w-full rounded-xl border border-[#dbeaf3] bg-white px-3.5 py-2.5 text-sm text-[#183B56] focus:outline-none focus:ring-2 focus:ring-[#4FA8D8]"
        />
      </div>
      <div>
        <Label>Icon</Label>
        <div className="grid grid-cols-8 gap-2">
          {GROUP_ICONS.map((icon) => (
            <button
              type="button"
              key={icon}
              onClick={() => setValues((v) => ({ ...v, icon }))}
              aria-pressed={values.icon === icon}
              className={clsx(
                "h-9 w-9 rounded-lg flex items-center justify-center border transition-colors",
                values.icon === icon
                  ? "border-[#4FA8D8] bg-[#EAF7FC] text-[#4FA8D8]"
                  : "border-transparent bg-[#F5F7FA] text-[#5b7a91] hover:bg-[#EAF7FC]"
              )}
            >
              <DynamicIcon name={icon} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Farbe</Label>
        <div className="flex gap-2 flex-wrap">
          {ROUTINE_COLORS.map((color) => (
            <button
              type="button"
              key={color}
              onClick={() => setValues((v) => ({ ...v, color }))}
              aria-pressed={values.color === color}
              className={clsx(
                "h-8 w-8 rounded-full border-2 transition-transform",
                values.color === color ? "border-[#183B56] scale-110" : "border-white"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxMembers">Max. Mitglieder (optional)</Label>
          <Input
            id="maxMembers"
            type="number"
            min={2}
            max={500}
            value={values.maxMembers}
            onChange={(e) => setValues((v) => ({ ...v, maxMembers: e.target.value }))}
            placeholder="unbegrenzt"
          />
        </div>
        <label className="flex items-center gap-2 mt-7 text-sm font-medium text-[#183B56]">
          <input
            type="checkbox"
            checked={values.isPrivate}
            onChange={(e) => setValues((v) => ({ ...v, isPrivate: e.target.checked }))}
            className="h-4 w-4 rounded accent-[#4FA8D8]"
          />
          Private Gruppe
        </label>
      </div>
      <FieldError>{error}</FieldError>
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Speichern…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
