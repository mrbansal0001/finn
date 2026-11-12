"use client";

import { useState } from "react";
import { KIND_CHOICES, type Prefs } from "@/lib/prefs";
import { resetPrefs, savePrefs } from "./actions";
import { ColourToggle } from "./ColourToggle";

export type PreviewData = {
  windows: { key: "24h" | "7d"; since: string; until: string }[];
  moves: { s: string; at: string; p: number; v: number }[];
};

export function SettingsForm({ prefs, preview }: { prefs: Prefs; preview: PreviewData }) {
  const [price, setPrice] = useState(prefs.price_pct);
  const [vol, setVol] = useState(prefs.volume_x);
  const [leads, setLeads] = useState(prefs.leads);

  return (
    <form action={savePrefs} className="mt-6">
      <fieldset>
        <legend className="section-h w-full">Price and volume</legend>
        <Slider
          id="price_pct" label="Price move" min={1} max={15} step={0.5} value={price} onChange={setPrice}
          display={`±${price.toFixed(1)}%`}
          hint={`A close-to-close move of ${price.toFixed(1)}% or more is an alert, checked after the 15:30 close. It leads only if no filing came before it.`}
        />
        <Slider
          id="volume_x" label="Volume spike" min={1.2} max={6} step={0.1} value={vol} onChange={setVol}
          display={`${vol.toFixed(1)}×`}
          hint={`Volume at ${vol.toFixed(1)}× its 20-session average or more is an alert. FINN never guesses a cause.`}
        />
        <Preview data={preview} price={price} vol={vol} saved={prefs} />
      </fieldset>

      <fieldset className="mt-10">
        <legend className="section-h w-full">Announcement types</legend>
        <p className="mt-2 text-caption text-ink-3">Switched off: folded into “Routine, folded”, where you can still open them.</p>
        <ul className="hair mt-1">
          {KIND_CHOICES.map((k) => (
            <li key={k.kind}>
              <label className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                <span>
                  <span className="block text-body">{k.label}</span>
                  <span className="block text-caption text-ink-3">{k.hint}</span>
                </span>
                <input
                  type="checkbox" name="kind" value={k.kind} defaultChecked={!prefs.muted.includes(k.kind)}
                  className="size-5 accent-[var(--accent)]"
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="section-h w-full">Edition length</legend>
        <Slider id="leads" label="Lead items" min={1} max={5} step={1} value={leads} onChange={setLeads}
          display={String(leads)} hint="An edition starts, ranks, and ends. Everything else is counted, not shown." />
      </fieldset>

      <fieldset className="mt-10">
        <legend className="section-h w-full">Display</legend>
        <ColourToggle />
      </fieldset>

      <div className="mt-10 flex items-center gap-3">
        <button type="submit" className="min-h-12 rounded-lg bg-ink px-5 text-small font-medium text-paper">
          Save and return
        </button>
        <button type="submit" formAction={resetPrefs} className="min-h-[44px] px-2 text-small text-ink-2">
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

function Slider(props: {
  id: string; label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; display: string; hint: string;
}) {
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <label htmlFor={props.id} className="text-body">{props.label}</label>
        <output htmlFor={props.id} className="num text-body font-medium">{props.display}</output>
      </div>
      <input
        id={props.id} name={props.id} type="range" min={props.min} max={props.max} step={props.step}
        value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 h-8 w-full accent-[var(--accent)]"
      />
      <p className="text-caption text-ink-3">{props.hint}</p>
    </div>
  );
}

// export timestamps carry no offset and are IST
const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/** What these rules would have shown, on the sessions FINN actually recorded (creative review §9). Counts
 *  over past data, not a forecast of how many alerts are coming. */
function Preview({ data, price, vol, saved }: { data: PreviewData; price: number; vol: number; saved: Prefs }) {
  const hits = (w: PreviewData["windows"][number], pp: number, vv: number) =>
    data.moves.filter((m) => ist(m.at) > ist(w.since) && ist(m.at) <= ist(w.until) && (Math.abs(m.p) >= pp || m.v >= vv));
  const changed = price !== saved.price_pct || vol !== saved.volume_x;
  const week = data.windows.find((w) => w.key === "7d");
  const examples = week ? hits(week, price, vol).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3) : [];
  return (
    <div className="mt-2 rounded-lg bg-tint px-4 py-3" aria-live="polite">
      <p className="text-caption text-ink-3">With these rules, on the sessions FINN recorded</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-x-4">
        {data.windows.map((w) => {
          const now = hits(w, price, vol);
          const before = hits(w, saved.price_pct, saved.volume_x).length;
          const cos = new Set(now.map((m) => m.s)).size;
          return (
            <div key={w.key}>
              <dt className="text-caption text-ink-3">{w.key === "24h" ? "Latest 24 hours" : "Latest 7 days"}</dt>
              <dd className="text-small text-ink">
                <span className="num font-medium">{now.length}</span> alert{now.length === 1 ? "" : "s"}
                {now.length > 0 && <span className="text-ink-2">, {cos} {cos === 1 ? "company" : "companies"}</span>}
              </dd>
              {changed && now.length !== before && (
                <dd className="num text-caption text-ink-3">{now.length > before ? "+" : "−"}{Math.abs(now.length - before)} vs saved</dd>
              )}
            </div>
          );
        })}
      </dl>
      {examples.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-caption text-ink-2">
          {examples.map((m) => (
            <li key={m.s + m.at} className="flex justify-between gap-3">
              <span className="font-medium text-ink">{m.s}</span>
              <span className="num">
                {signed(m.p)}, {m.v.toFixed(1)}× vol, {new Date(ist(m.at)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-caption text-ink-3">Past sessions, not a forecast. Saving applies the rules to every edition.</p>
    </div>
  );
}
