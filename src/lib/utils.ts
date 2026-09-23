import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Props for a 10-digit mobile number box.
 *
 * Anything that is not a digit is dropped as it is typed or pasted, and the
 * box stops at ten. The cap lives here rather than in `maxLength`, which would
 * truncate a pasted "+91 98765 43210" to "+91 98765 " before it could be
 * cleaned; a pasted number with a 91 or 0 prefix keeps its own ten digits.
 */
export const mobileInputProps = {
  type: "tel",
  inputMode: "numeric",
  autoComplete: "tel-national",
  pattern: "[0-9]{10}",
  title: "10-digit mobile number",
  onInput: (ev: React.FormEvent<HTMLInputElement>) => {
    const el = ev.currentTarget;
    let d = el.value.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    d = d.slice(0, 10);
    if (d !== el.value) el.value = d;
  },
} as const;
