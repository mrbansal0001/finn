"use client";

import { useState } from "react";
import { KIND_CHOICES, type Prefs } from "@/lib/prefs";
import { resetPrefs, savePrefs } from "./actions";

export function SettingsForm({ prefs }: { prefs: Prefs }) {
  const [price, setPrice] = useState(prefs.price_pct);
  const [vol, setVol] = useState(prefs.volume_x);
  const [leads, setLeads] = useState(prefs.leads);

  return (
    <form action={savePrefs} className="mt-6">
      <fieldset>
        <legend className="kicker w-full border-b border-ink pb-2">Price and volume</legend>
        <Slider
          id="price_pct" label="Price move" min={1} max={15} step={0.5} value={price} onChange={setPrice}
          display={`±${price.toFixed(1)}%`}
          hint={`A close-to-close move of ${price.toFixed(1)}% or more becomes a lead. Checked after the 15:30 close on NSE's bhavcopy.`}
        />
        <Slider
          id="volume_x" label="Volume spike" min={1.2} max={6} step={0.1} value={vol} onChange={setVol}
          display={`${vol.toFixed(1)}×`}
          hint={`Volume at ${vol.toFixed(1)}× its 20-session average gets flagged. If no filing explains the move, FINN says so instead of guessing.`}
        />
      </fieldset>

      <fieldset className="mt-8">
        <legend className="kicker w-full border-b border-ink pb-2">Announcement types</legend>
        <p className="mt-2 text-[0.8125rem] text-ink-3">Switched off: folded into the routine row, never deleted.</p>
        <ul className="hair mt-1">
          {KIND_CHOICES.map((k) => (
            <li key={k.kind}>
              <label className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                <span>
                  <span className="block text-[0.9375rem]">{k.label}</span>
                  <span className="block text-[0.75rem] text-ink-3">{k.hint}</span>
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

      <fieldset className="mt-8">
        <legend className="kicker w-full border-b border-ink pb-2">Edition length</legend>
        <Slider id="leads" label="Lead items" min={1} max={5} step={1} value={leads} onChange={setLeads}
          display={String(leads)} hint="An edition starts, ranks, and ends. Everything else is counted, not shown." />
      </fieldset>

      <div className="mt-8 flex items-center gap-3">
        <button type="submit" className="min-h-[44px] rounded-md bg-ink px-5 text-[0.9375rem] text-paper">
          Save and return
        </button>
        <button type="submit" formAction={resetPrefs} className="min-h-[44px] px-2 text-[0.875rem] text-ink-2">
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
        <label htmlFor={props.id} className="text-[0.9375rem]">{props.label}</label>
        <output htmlFor={props.id} className="num text-[0.9375rem]">{props.display}</output>
      </div>
      <input
        id={props.id} name={props.id} type="range" min={props.min} max={props.max} step={props.step}
        value={props.value} onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 h-8 w-full accent-[var(--accent)]"
      />
      <p className="text-[0.8125rem] leading-snug text-ink-3">{props.hint}</p>
    </div>
  );
}
