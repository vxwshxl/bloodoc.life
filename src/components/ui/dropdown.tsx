"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DropdownOption = { value: string; label: string; disabled?: boolean };

/**
 * The app's one dropdown.
 *
 * Every choice control in the app goes through here, and that uniformity is
 * the point rather than a nicety: a native `<select>` and a Radix one look
 * nothing alike — different height, different focus ring, a system-drawn menu
 * against a themed one — and the app had both, sometimes in the same form.
 * Somebody filling in their profile met three visually different controls
 * asking the same kind of question.
 *
 * Radix rather than native, because a native menu cannot be styled to match
 * the rest of the console on any platform and renders as a grey system sheet
 * on a phone. The cost is that it needs JavaScript, which is acceptable
 * everywhere it is used — all of them sit behind a sign-in.
 *
 * It still submits through ordinary FormData: `name` is passed to Radix's own
 * hidden input, so a server action reads it exactly as it would a native
 * select.
 */
export function Dropdown({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  invalid,
  id,
  className,
}: {
  name?: string;
  options: readonly DropdownOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id ?? name}
        aria-invalid={invalid || undefined}
        // `text-base md:text-sm`: anything under 16px makes iOS Safari zoom
        // the page when the control is focused, and it never zooms back.
        className={cn("h-10 w-full text-base md:text-sm", className)}
      >
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
