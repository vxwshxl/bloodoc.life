/**
 * Hand-written row types.
 *
 * Generated types (`supabase gen types`) would be the usual answer, but they
 * regenerate the whole file on every schema change and lose the comments that
 * explain the non-obvious columns. This schema is small enough that keeping it
 * by hand is cheaper than reviewing a 900-line generated diff — with the rule
 * that a migration and this file change in the same commit.
 */

export type UserRole = "admin" | "donor";
export type DonorKind = "student" | "faculty" | "staff" | "other";
export type Sex = "male" | "female" | "other";
export type BloodGroup =
  | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
export type CampStatus = "draft" | "published" | "closed";
export type RegistrationStatus =
  | "registered" | "screened" | "donated" | "deferred" | "cancelled";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Donor = {
  id: string;
  profile_id: string | null;
  full_name: string;
  sex: Sex;
  date_of_birth: string | null;
  age: number | null;
  father_name: string | null;
  mother_name: string | null;
  kind: DonorKind;
  occupation: string | null;
  department: string | null;
  email: string;
  phone: string;
  alt_phone: string | null;
  address: string | null;
  blood_group: BloodGroup;
  prior_donations: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Camp = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  venue: string;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  organiser: string | null;
  contact_phone: string | null;
  status: CampStatus;
  created_at: string;
  updated_at: string;
};

export type Registration = {
  id: string;
  camp_id: string;
  donor_id: string;
  status: RegistrationStatus;
  first_time: boolean;
  height_cm: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  medications: string | null;
  deferral_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailLog = {
  id: string;
  to_email: string;
  subject: string;
  template: string | null;
  ok: boolean;
  provider_id: string | null;
  error: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      donors: Table<Donor>;
      camps: Table<Camp>;
      registrations: Table<Registration>;
      email_otps: Table<{
        id: string;
        email: string;
        code_hash: string;
        purpose: string;
        attempts: number;
        expires_at: string;
        consumed_at: string | null;
        created_at: string;
      }>;
      email_log: Table<EmailLog>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      donor_kind: DonorKind;
      sex_type: Sex;
      blood_group: BloodGroup;
      camp_status: CampStatus;
      registration_status: RegistrationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
