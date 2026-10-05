import { useState, type FormEvent, type ReactNode } from "react";
import { UserPlus, X, Check, LoaderCircle, Globe, User, Hash, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/constants";
import { addAndCheckIn } from "@/lib/store";
import type { CheckinResult, PassType } from "@/lib/types";
import { PASS_TYPES } from "@/lib/types";
import { normalizeId } from "@/lib/utils";

export function NewEntryForm({
  initialId,
  onCancel,
  onDone,
}: {
  initialId: string;
  onCancel: () => void;
  onDone: (result: CheckinResult) => void;
}) {
  const [id, setId] = useState(normalizeId(initialId));
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [passType, setPassType] = useState<PassType>("Both Days");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const cleanedId = normalizeId(id);
    if (!cleanedId || !name.trim() || !country.trim()) {
      setError("ID, attendee name, and country are required.");
      return;
    }
    setBusy(true);
    const result = await addAndCheckIn({
      id: cleanedId,
      name: name.trim(),
      country: country.trim(),
      passType,
    });
    setBusy(false);
    if (result.kind === "error") {
      setError(result.message);
      return;
    }
    onDone(result);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-[28px] border border-border/80 bg-card p-5 shadow-2xl transition-all"
    >
      <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <UserPlus className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              New Attendee Walk-up Registration
            </h2>
            <p className="text-xs text-muted-foreground">
              Direct entry for unregistered attendees with instant check-in.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Field label="Attendee ID (Code 128)" icon={<Hash className="size-3.5 text-primary" />}>
          <Input
            value={id}
            autoCapitalize="characters"
            spellCheck={false}
            className="h-11 font-mono text-base font-semibold tracking-wider"
            placeholder="e.g. NRB20260099"
            onChange={(event) => setId(event.target.value.toUpperCase())}
            required
          />
        </Field>

        <Field label="Full Name" icon={<User className="size-3.5 text-primary" />}>
          <Input
            value={name}
            autoComplete="name"
            placeholder="Enter attendee full name"
            className="h-11 text-base font-medium"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country / Origin" icon={<Globe className="size-3.5 text-primary" />}>
            <Input
              value={country}
              list="gateflow-countries"
              placeholder="Select or type country"
              className="h-11 text-base font-medium"
              onChange={(event) => setCountry(event.target.value)}
              required
            />
            <datalist id="gateflow-countries">
              {COUNTRIES.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>

          <Field label="Pass Category" icon={<Ticket className="size-3.5 text-primary" />}>
            <select
              value={passType}
              onChange={(e) => setPassType(e.target.value as PassType)}
              className="h-11 w-full rounded-xl border border-border/80 bg-muted px-3 text-sm font-semibold shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PASS_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt === "Both Days" ? "Both Days (All Access)" : pt}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {error ? (
        <p className="mt-3.5 rounded-xl bg-rose-500/15 p-3 text-sm font-semibold text-rose-400 border border-rose-500/30">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-12 font-semibold"
          onClick={onCancel}
          disabled={busy}
        >
          <X className="mr-1.5 size-4" />
          Cancel
        </Button>
        <Button type="submit" size="lg" className="h-12 font-bold shadow-md" disabled={busy}>
          {busy ? (
            <>
              <LoaderCircle className="mr-2 size-4 animate-spin" />
              Checking In…
            </>
          ) : (
            <>
              <Check className="mr-1.5 size-4" />
              Register & Check In
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        {icon}
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
      </div>
      {children}
    </label>
  );
}
