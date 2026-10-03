import { z } from "zod";
import { OTHER_SCHOOL, schoolById, schoolPlainName } from "@/lib/rgu";

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

/**
 * Exactly ten digits, starting 6–9: an Indian mobile number as people write
 * it. No country code, no separators — the inputs strip anything that is not
 * a digit as it is typed, so a strict rule here costs the donor nothing.
 */
const MOBILE = /^[6-9]\d{9}$/;

const phone = z
  .string({ message: "Enter a 10-digit mobile number." })
  .trim()
  .refine((s) => MOBILE.test(s), "Enter a 10-digit mobile number.");

const optionalPhone = box
  .refine((s) => s === "" || MOBILE.test(s), "Enter a 10-digit mobile number.")
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

/**
 * Today's date in India, as `YYYY-MM-DD`.
 *
 * A server in UTC is still on yesterday until 05:30 IST, and a birthday
 * compared against the wrong day makes somebody a year younger for five and a
 * half hours.
 */
export function todayInIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Whole years between a `YYYY-MM-DD` birth date and `today`.
 *
 * Text arithmetic, never `new Date(dob)`: that parses as UTC midnight and a
 * browser west of Greenwich reads the day before back off it. Used by the form
 * to show the age as the date is picked, and by the server to store it — the
 * posted age is never trusted, because it is derived.
 */
export function ageOn(dob: string, today: string = todayInIst()): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !t) return null;
  const [by, bm, bd] = b.slice(1).map(Number);
  const [ty, tm, td] = t.slice(1).map(Number);
  const beforeBirthday = tm < bm || (tm === bm && td < bd);
  return ty - by - (beforeBirthday ? 1 : 0);
}

/**
 * The title printed before a parent's name.
 *
 * "Lt." is the late — the usage on Indian forms, not the military rank.
 */
export const FATHER_TITLES = [
  { value: "mr", label: "Mr." },
  { value: "late", label: "Lt." },
] as const;

export const MOTHER_TITLES = [
  { value: "mrs", label: "Mrs." },
  { value: "late", label: "Lt." },
] as const;

/** A husband is titled like a father: "Mr." or "Lt." */
export const HUSBAND_TITLES = FATHER_TITLES;

const TITLE_LABEL: Record<string, string> = { mr: "Mr.", mrs: "Mrs.", late: "Lt." };

/** "Lt. Ramesh Das", or the bare name for a row saved before titles existed. */
export function parentName(title: string | null | undefined, name: string | null | undefined) {
  if (!name) return null;
  return title && TITLE_LABEL[title] ? `${TITLE_LABEL[title]} ${name}` : name;
}

/**
 * Questions that are optional unless a camp asks for them.
 *
 * The camp editor offers exactly these as "also require" ticks, and
 * `registerDonor` enforces whichever the camp chose. The keys are the form's
 * input names and must match the check constraint in migration 0019.
 *
 * Parents' names and the address were here until 0020 made them required for
 * every camp. The constraint still allows the old keys, so a camp saved with
 * them ticked stays valid.
 */
export const CONFIGURABLE_FIELDS = [
  { key: "altPhone", label: "Alternate phone" },
  { key: "priorDonations", label: "Times donated before" },
  { key: "heightCm", label: "Height" },
  { key: "weightKg", label: "Weight" },
] as const;

export type ConfigurableField = (typeof CONFIGURABLE_FIELDS)[number]["key"];

const parentText = (message: string) =>
  z.string({ message }).trim().min(2, message).max(120);

const addressText = (message: string) =>
  z.string({ message }).trim().min(8, message).max(500, "Keep this under 500 characters.");

/**
 * Who the donor is, where they live and what they do: the fields the public
 * registration and the donor's own profile editor share. Each schema below
 * adds what belongs only to it.
 */
const personShape = {
  fullName: z.string({ message: "Tell us your name." }).trim().min(2, "Tell us your name.").max(120),
  sex: z.enum(["male", "female", "other"], { message: "Pick one." }),
  // Required, and the age is worked out from it. Asking for both let the two
  // disagree, and asking for either meant the roster had ages with no birth
  // date behind them.
  dateOfBirth: z
    .string({ message: "Pick your date of birth." })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick your date of birth."),
  fatherTitle: z.enum(["mr", "late"], { message: "Pick Mr. or Lt." }),
  fatherName: parentText("Enter your father's name."),
  motherTitle: z.enum(["mrs", "late"], { message: "Pick Mrs. or Lt." }),
  motherName: parentText("Enter your mother's name."),
  // Optional, for the donors it applies to. The title menu always posts a
  // value, so it is kept only when a name came with it.
  husbandTitle: z.enum(["mr", "late"]).optional(),
  husbandName: box.refine((s) => s === "" || (s.length >= 2 && s.length <= 120), "Enter your husband's name, or leave it blank."),

  kind: z.enum(["student", "faculty", "staff", "other"], { message: "Pick one." }),
  occupation: box,
  // The school's id from `RGU_SCHOOLS`, or "other". Resolved to its stored
  // name in `finishPerson`.
  school: box,
  department: box,

  phone,
  altPhone: optionalPhone,
  address: addressText("Enter your residential address."),
  // Ticked → the permanent address is the residential one, and its box is not
  // on screen to post anything.
  sameAddress: z.literal("on").optional(),
  permanentAddress: box,
  bloodGroup: z.enum(BLOOD_GROUPS, { message: "Pick one, or \"I don't know\"." }),
};

type PersonFields = {
  dateOfBirth: string;
  husbandTitle?: "mr" | "late";
  husbandName: string;
  kind: "student" | "faculty" | "staff" | "other";
  occupation: string;
  school: string;
  department: string;
  sameAddress?: "on";
  permanentAddress: string;
};

/** The rules that span more than one person field. */
function checkPerson(v: PersonFields, ctx: z.RefinementCtx) {
  const age = ageOn(v.dateOfBirth);
  if (age === null || age < 16 || age > 120) {
    ctx.addIssue({
      code: "custom",
      path: ["dateOfBirth"],
      message: "Check your date of birth.",
    });
  }

  if (!v.sameAddress && v.permanentAddress.length < 8) {
    ctx.addIssue({
      code: "custom",
      path: ["permanentAddress"],
      message: "Enter your permanent address, or tick \"Same as residential\".",
    });
  }

  // Which question is asked depends on `kind`, and only the one that was
  // shown is required. "Other" is the catch-all — a shopkeeper has an
  // occupation and no school, and asking them for one is how a form tells
  // somebody it was not written for them.
  if (v.kind === "other") {
    if (!v.occupation) {
      ctx.addIssue({ code: "custom", path: ["occupation"], message: "What do you do?" });
    }
    return;
  }

  if (!v.school) {
    ctx.addIssue({ code: "custom", path: ["school"], message: "Which school?" });
    return;
  }
  if (v.school === OTHER_SCHOOL) {
    if (!v.department) {
      ctx.addIssue({
        code: "custom",
        path: ["department"],
        message: v.kind === "student" ? "Which department?" : "Which department or office?",
      });
    }
    return;
  }
  const school = schoolById(v.school);
  if (!school) {
    ctx.addIssue({ code: "custom", path: ["school"], message: "Pick your school from the list." });
    return;
  }
  if (school.departments.length > 0 && !school.departments.includes(v.department)) {
    ctx.addIssue({ code: "custom", path: ["department"], message: "Which department?" });
  }
}

/**
 * The validated person fields as they are stored: the age derived, the school
 * resolved to its name, the permanent address filled in, and the half of
 * "school or occupation" that does not apply cleared rather than kept.
 */
function finishPerson<T extends PersonFields & { address: string }>(v: T) {
  const school = v.kind === "other" ? undefined : schoolById(v.school);
  const typedDepartment = v.kind !== "other" && v.school === OTHER_SCHOOL;
  return {
    ...v,
    age: ageOn(v.dateOfBirth),
    husbandName: v.husbandName || null,
    husbandTitle: v.husbandName ? (v.husbandTitle ?? "mr") : null,
    permanentAddress: v.sameAddress ? v.address : v.permanentAddress,
    occupation: v.kind === "other" ? v.occupation : null,
    school: school?.name ?? null,
    department: typedDepartment
      ? v.department.slice(0, 120)
      : school
        ? school.departments.length > 0
          ? v.department
          : schoolPlainName(school)
        : null,
  };
}

export const donorRegistrationSchema = z
  .object({
    ...personShape,

    // --- Reaching you ---
    email: z.string({ message: "Enter your email address." }).trim().toLowerCase().email("Enter a valid email address."),

    // --- As a donor ---
    firstTime: z.enum(["yes", "no"], { message: "Pick yes or no." }),
    priorDonations: optionalNumber(0, 200, "Number of donations"),

    // --- Health details ---
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
    checkPerson(v, ctx);
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
    if (v.onMedication === "yes" && !v.medications) {
      ctx.addIssue({
        code: "custom",
        path: ["medications"],
        message: "Name what you are taking.",
      });
    }
  })
  .transform(finishPerson);

export type DonorRegistrationInput = z.infer<typeof donorRegistrationSchema>;

/**
 * The donor's own profile, edited from /me.
 *
 * The same person fields as the registration, and deliberately nothing else.
 * Three groups of fields are missing and each absence is a decision:
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
    ...personShape,
    priorDonations: optionalNumber(0, 200, "Number of donations"),
  })
  .superRefine(checkPerson)
  .transform(finishPerson);

export type DonorProfileInput = z.infer<typeof donorProfileSchema>;
