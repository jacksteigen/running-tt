"use client";

import { COUNTRIES, PINNED_COUNTRIES } from "@/lib/countries";

/**
 * Country picker with the usual Running TT countries pinned to the top.
 * Pass the same input class the surrounding form uses so it matches.
 */
export default function CountrySelect({
  id,
  value,
  onChange,
  className = "",
  required = false,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const rest = COUNTRIES.filter(
    (c) => !(PINNED_COUNTRIES as readonly string[]).includes(c)
  );

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-label={ariaLabel}
      autoComplete="country-name"
      className={className}
    >
      <option value="">Choose a country</option>
      <optgroup label="Most common">
        {PINNED_COUNTRIES.map((c) => (
          <option key={`p-${c}`} value={c}>
            {c}
          </option>
        ))}
      </optgroup>
      <optgroup label="All countries">
        {rest.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
