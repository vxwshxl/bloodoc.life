import { z } from "zod";

export const BLOOD_GROUPS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown",
] as const;

export const DONOR_KINDS = [
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "other", label: "Other" },
] as const;

export const SEXES = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

/** Indian mobile numbers, with or without +91 and separators. */
const phone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => /^(\+?91)?[6-9]\d{9}$/.test(s), "Enter a 10-digit mobile number.");

const optionalPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => s === "" || /^(\+?91)?[6-9]\d{9}$/.test(s), "Enter a 10-digit mobile number.")
  .transform((s) => (s === "" ? null : s));

/** "" → null, for every optional text box on the form. */
const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((s) => (s === "" ? null : s));

/**
 * Numbers arrive from a form as strings, and an empty box is "" rather than
 * undefined. `z.coerce.number()` turns "" into 0, which would silently record a
 * blood pressure of zero — so emptiness is handled before coercion, not after.
 */
const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine(
      (n) => n === null || (Number.isFinite(n) && n >= min && n <= max),
      `${label} should be between ${min} and ${max}.`,
    );

export const donorRegistrationSchema = z
  .object({
    // --- About you ---
    fullName: z.string().trim().min(2, "Tell us your name.").max(120),
    sex: z.enum(["male", "female", "other"]),
    dateOfBirth: z
      .string()
      .trim()
      .transform((s) => (s === "" ? null : s))
      .refine(
        (s) => s === null || !Number.isNaN(Date.parse(s)),
        "That date does not look right.",
      ),
    age: optionalNumber(16, 120, "Age"),
    fatherName: optionalText,
    motherName: optionalText,

    // --- What you do ---
    kind: z.enum(["student", "faculty", "staff", "other"]),
    occupation: optionalText,
    department: optionalText,

    // --- Reaching you ---
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    phone,
    altPhone: optionalPhone,
    address: optionalText,

    // --- As a donor ---
    bloodGroup: z.enum(BLOOD_GROUPS),
    firstTime: z.enum(["yes", "no"]),
    priorDonations: optionalNumber(0, 200, "Number of donations"),

    // --- On the day ---
    heightCm: optionalNumber(100, 250, "Height"),
    weightKg: optionalNumber(30, 300, "Weight"),
    bpSystolic: optionalNumber(60, 260, "Systolic pressure"),
    bpDiastolic: optionalNumber(30, 160, "Diastolic pressure"),
    // The range is deliberately wider than the donation cutoff (12.5 g/dL in
    // India). A donor who is turned away for a low reading still has that
    // reading recorded, and a field that refused to hold it would be a field
    // that only works for people who pass.
    hemoglobin: optionalNumber(3, 25, "Haemoglobin"),
    medications: optionalText,

    // --- Which camp ---
    campId: z.string().uuid("Pick a camp."),
    consent: z.literal("on", { message: "Please confirm you have read the eligibility note." }),
  })
  .superRefine((v, ctx) => {
    // Age or date of birth — one of them, because the medical officer needs to
    // know the donor is over 18 and neither field alone is always supplied.
    if (v.age === null && v.dateOfBirth === null) {
      ctx.addIssue({
        code: "custom",
        path: ["age"],
        message: "Give your age or your date of birth.",
      });
    }
    // A first-time donor with a donation count is a contradiction, and the two
    // boxes sit next to each other on the paper form precisely because people
    // fill them both in without thinking.
    if (v.firstTime === "yes" && (v.priorDonations ?? 0) > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["priorDonations"],
        message: "You marked yourself a first-time donor — leave this blank, or untick that.",
      });
    }
    // Blood pressure is a pair. One half of it is not a reading.
    if ((v.bpSystolic === null) !== (v.bpDiastolic === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["bpDiastolic"],
        message: "Enter both numbers, or neither.",
      });
    }
    if (v.bpSystolic !== null && v.bpDiastolic !== null && v.bpDiastolic >= v.bpSystolic) {
      ctx.addIssue({
        code: "custom",
        path: ["bpDiastolic"],
        message: "The lower number should be below the upper one.",
      });
    }
    // Which of the two boxes is asked for depends on `kind`, and only the one
    // that was shown is required. "Other" is the catch-all — a shopkeeper has
    // an occupation and no department, and asking them for one is how a form
    // tells somebody it was not written for them.
    if (v.kind !== "other" && !v.department) {
      ctx.addIssue({
        code: "custom",
        path: ["department"],
        message:
          v.kind === "student" ? "Which department?" : "Which faculty or department?",
      });
    }
    if (v.kind === "other" && !v.occupation) {
      ctx.addIssue({
        code: "custom",
        path: ["occupation"],
        message: "What do you do?",
      });
    }
  });

export type DonorRegistrationInput = z.infer<typeof donorRegistrationSchema>;
