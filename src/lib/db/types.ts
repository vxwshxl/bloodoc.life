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

/**
 * What kind of body a partner is. Not cosmetic: a blood bank may record a
 * screening result and a donation, an organisation may not. See
 * `is_camp_bloodbank()` in 0008.
 */
export type PartnerKind = "organisation" | "blood_bank";
export type PartnerMemberRole = "owner" | "member";
export type CertificateStatus = "pending" | "approved" | "revoked";

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
  /** Assamese and Hindi titles, shown in rotation beside the English one. */
  title_as: string | null;
  title_hi: string | null;
  summary: string | null;
  venue: string;
  city: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  organiser: string | null;
  contact_phone: string | null;
  /** "In collaboration with …" — the partnering body. */
  collaboration: string | null;
  /** The blood bank that receives the units. */
  partner_name: string | null;
  /** Its address or parent institution. */
  partner_note: string | null;
  status: CampStatus;
  /**
   * Advertise it. False hides the camp from the home page and the /camps list
   * while its own page stays reachable by direct link. Not the same question
   * as `status`, which is whether the page may be opened at all.
   */
  listed: boolean;
  /**
   * Leads the home page hero. At most one camp may be true, enforced by the
   * `camps_one_featured` index in 0011 rather than by the application.
   *
   * Distinct from `listed`: a camp can be advertised without being the one the
   * hero animates around.
   */
  featured: boolean;
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
  /** g/dL, as measured at the desk. Below the cutoff is a deferral, not a bug. */
  hemoglobin_gdl: number | null;
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
  /** The rendered body as sent. Null for rows logged before 0010. */
  html: string | null;
  created_at: string;
};

export type AuditAction = "insert" | "update" | "delete";

/**
 * One recorded change, written by the `record_audit` trigger — never by the
 * application, and never editable through the API.
 */
export type AuditLog = {
  id: number;
  actor_id: string | null;
  /** Kept alongside the id so the row still names someone after account deletion. */
  actor_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  /**
   * An update records only the columns that changed, as
   * `{ col: { from, to } }`. An insert or delete records the whole row.
   */
  changes: Record<string, unknown> | null;
  created_at: string;
};

/**
 * A collaborating body: an NSS unit, a service organisation, a blood bank.
 *
 * Replaces the `collaboration` / `partner_name` / `partner_note` text columns
 * on `camps`, which could be printed but never queried, joined or logged into.
 */
export type Partner = {
  id: string;
  slug: string;
  name: string;
  /** What fits in a table cell — "NSS, RGU" rather than the full legal name. */
  short_name: string | null;
  kind: PartnerKind;
  /** "Gauhati Medical College & Hospital" for a blood centre inside a hospital. */
  parent_institution: string | null;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  /** Stopped collaborating. Never deleted — past camps must keep resolving. */
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Who may sign into a partner's panel.
 *
 * `profile_id` is null until that address signs in for the first time; the
 * signup trigger claims the row. Adding the email IS the invite.
 */
export type PartnerMember = {
  id: string;
  partner_id: string;
  profile_id: string | null;
  email: string;
  full_name: string | null;
  title: string | null;
  role: PartnerMemberRole;
  created_at: string;
  updated_at: string;
};

/** Which bodies ran which camp, and in what capacity at that camp. */
export type CampPartner = {
  camp_id: string;
  partner_id: string;
  role: PartnerKind;
  is_host: boolean;
  sort_order: number;
  created_at: string;
};

/**
 * One per donation, minted `pending` by a trigger the moment a registration
 * reaches `donated` and valid only once a human approves it.
 */
export type Certificate = {
  id: string;
  registration_id: string;
  /** The public handle: BD-2026-9F3A7C. Printed, and typed into /verify. */
  code: string;
  status: CertificateStatus;
  issued_at: string | null;
  issued_by: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
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
      audit_log: Table<AuditLog>;
      partners: Table<Partner>;
      partner_members: Table<PartnerMember>;
      camp_partners: Table<CampPartner>;
      certificates: Table<Certificate>;
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
      partner_kind: PartnerKind;
      partner_member_role: PartnerMemberRole;
      certificate_status: CertificateStatus;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<string, never>;
  };
};
