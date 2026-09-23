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

/**
 * A form box that may be missing from the submission entirely.
 *
 * An input that is not mounted posts no key at all, so the server sees
 * `undefined` rather than "". The medication box is only rendered on "yes",
 * and treating its absence as a type error failed every registration that
 * answered "no" — with the message attached to a field that was not on screen.
 */
const box = z
  .string()
  .optional()
  .transform((s) => (s ?? "").trim());

/** Indian mobile numbers, with or without +91 and separators. */
const phone = z
  .string({ message: "Enter a 10-digit mobile number." })
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => /^(\+?91)?[6-9]\d{9}$/.test(s), "Enter a 10-digit mobile number.");

const optionalPhone = box
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .refine((s) => s === "" || /^(\+?91)?[6-9]\d{9}$/.test(s), "Enter a 10-digit mobile number.")
  .transform((s) => (s === "" ? null : s));

/** "" or missing → null, for every optional text box on the form. */
const optionalText = box
  .refine((s) => s.length <= 500, "Keep this under 500 characters.")
  .transform((s) => (s === "" ? null : s));

/**
 * Numbers arrive from a form as strings, and an empty box is "" rather than
 * undefined. `z.coerce.number()` turns "" into 0, which would silently record a
 * blood pressure of zero — so emptiness is handled before coercion, not after.
 */
const optionalNumber = (min: number, max: number, label: string) =>
  box
    .transform((s) => (s === "" ? null : Number(s)))
    .refine(
      (n) => n === null || (Number.isFinite(n) && n >= min && n <= max),
      `${label} should be between ${min} and ${max}.`,
    );

const optionalDate = box
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || !Number.isNaN(Date.parse(s)), "That date does not look right.");

/**
 * Questions that are optional unless a camp asks for them.
 *
 * The camp editor offers exactly these as "also require" ticks, and
 * `registerDonor` enforces whichever the camp chose. The keys are the form's
 * input names and must match the check constraint in migration 0019.
 */
export const CONFIGURABLE_FIELDS = [
  { key: "fatherName", label: "Father's name" },
  { key: "motherName", label: "Mother's name" },
  { key: "altPhone", label: "Alternate phone" },
  { key: "address", label: "Address" },
  { key: "priorDonations", label: "Times donated before" },
  { key: "heightCm", label: "Height" },
  { key: "weightKg", label: "Weight" },
] as const;

export type ConfigurableField = (typeof CONFIGURABLE_FIELDS)[number]["key"];

export const donorRegistrationSchema = z
  .object({
    // --- About you ---
    fullName: z.string({ message: "Tell us your name." }).trim().min(2, "Tell us your name.").max(120),
    sex: z.enum(["male", "female", "other"], { message: "Pick one." }),
    dateOfBirth: optionalDate,
    age: optionalNumber(16, 120, "Age"),
    fatherName: optionalText,
    motherName: optionalText,

    // --- What you do ---
    kind: z.enum(["student", "faculty", "staff", "other"], { message: "Pick one." }),
    occupation: optionalText,
    department: optionalText,

    // --- Reaching you ---
    email: z.string({ message: "Enter your email address." }).trim().toLowerCase().email("Enter a valid email address."),
    phone,
    altPhone: optionalPhone,
    address: optionalText,

    // --- As a donor ---
    bloodGroup: z.enum(BLOOD_GROUPS, { message: "Pick one, or \"I don't know\"." }),
    firstTime: z.enum(["yes", "no"], { message: "Pick yes or no." }),
    priorDonations: optionalNumber(0, 200, "Number of donations"),

    // --- On the day ---
    //
    // Blood pressure and haemoglobin are deliberately absent. They are
    // measured at the desk with a cuff and a test, and a number a donor typed
    // in from memory at home is worse than a blank: it looks like a reading,
    // it sits in the same column as real ones, and nobody can tell them apart
    // afterwards. Those two are recorded by the screening team through the
    // console. Height and weight stay, because a donor genuinely knows them
    // and the 45kg minimum is worth flagging before someone travels.
    heightCm: optionalNumber(100, 250, "Height"),
    weightKg: optionalNumber(30, 300, "Weight"),
    // Asked as a yes/no first, with the box only appearing on "yes".
    //
    // A single free-text field cannot tell "I take nothing" from "I skipped
    // this question", and those are opposite answers to the one question on
    // the form the medical officer most needs settled. A deliberate No is a
    // recorded answer; a blank box is a shrug.
    onMedication: z.enum(["yes", "no"], { message: "Pick yes or no." }),
    medications: optionalText,

    // --- Which camp ---
    campId: z.string({ message: "Pick a camp." }).uuid("Pick a camp."),
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
        message: "You marked yourself a first-time donor. Leave this blank, or change that to No.",
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
    if (v.onMedication === "yes" && !v.medications) {
      ctx.addIssue({
        code: "custom",
        path: ["medications"],
        message: "Name what you are taking.",
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

/**
 * The donor's own profile, edited from /me.
 *
 * A deliberate subset of the registration schema, not a reuse of it. Three
 * groups of fields are missing and each absence is a decision:
 *
 *  - `campId`, `consent`, `firstTime` — these belong to an application to a
 *    particular camp, not to the person. Carrying them here would mean editing
 *    your phone number re-answered a consent question about a camp you may not
 *    be attending.
 *  - `heightCm`, `weightKg`, `medications` — measured or asked at the desk on
 *    the day, and they change between camps. The registration form still
 *    collects them per application.
 *  - Blood pressure and haemoglobin — never donor-supplied anywhere, for the
 *    reason given above.
 *
 * `email` is absent too, and that one matters most: the address is the account.
 * Letting someone edit it here would either orphan their own record or hand
 * them a way to point it at somebody else's.
 */
export const donorProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    sex: z.enum(["male", "female", "other"]),
    dateOfBirth: optionalDate,
    age: optionalNumber(16, 120, "Age"),
    fatherName: optionalText,
    motherName: optionalText,
    kind: z.enum(["student", "faculty", "staff", "other"]),
    occupation: optionalText,
    department: optionalText,
    phone,
    altPhone: optionalPhone,
    address: optionalText,
    bloodGroup: z.enum(BLOOD_GROUPS),
    priorDonations: optionalNumber(0, 200, "Number of donations"),
  })
  .superRefine((v, ctx) => {
    if (v.age === null && v.dateOfBirth === null) {
      ctx.addIssue({
        code: "custom",
        path: ["age"],
        message: "Give your age or your date of birth.",
      });
    }
    if (v.kind !== "other" && !v.department) {
      ctx.addIssue({
        code: "custom",
        path: ["department"],
        message: v.kind === "student" ? "Which department?" : "Which faculty or department?",
      });
    }
    if (v.kind === "other" && !v.occupation) {
      ctx.addIssue({ code: "custom", path: ["occupation"], message: "What do you do?" });
    }
  });

export type DonorProfileInput = z.infer<typeof donorProfileSchema>;
