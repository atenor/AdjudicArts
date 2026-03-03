import { z } from "zod";

export const VOICE_PART_VALUES = [
  "soprano",
  "contralto",
  "mezzo",
  "tenor",
  "countertenor",
  "baritone",
  "bass",
] as const;

export const VOICE_PART_OPTIONS = [
  { value: "soprano", label: "Soprano" },
  { value: "contralto", label: "Contralto" },
  { value: "mezzo", label: "Mezzo-Soprano" },
  { value: "tenor", label: "Tenor" },
  { value: "countertenor", label: "Countertenor" },
  { value: "baritone", label: "Baritone" },
  { value: "bass", label: "Bass" },
] as const;

export const CITIZENSHIP_STATUS_OPTIONS = [
  { value: "U.S. Citizen", label: "U.S. Citizen" },
  { value: "Permanent Resident", label: "Permanent Resident" },
  { value: "Other / Not Applicable", label: "Other / Not Applicable" },
] as const;

const CITIZENSHIP_STATUS_VALUES = CITIZENSHIP_STATUS_OPTIONS.map(
  (option) => option.value
) as [string, ...string[]];

function getMarchFirstReferenceDate(now = new Date()) {
  return new Date(now.getFullYear(), 2, 1);
}

function getAgeOnDate(dateOfBirth: string, referenceDate: Date) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDelta = referenceDate.getMonth() - dob.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && referenceDate.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function isMinor(dateOfBirth: string) {
  const age = getAgeOnDate(dateOfBirth, new Date());
  return age !== null && age < 18;
}

const requiredTrimmedString = (message: string) =>
  z.string().trim().min(1, message);

const optionalUrl = z.string().trim().url("Enter a valid URL");
const optionalStoredAssetRef = z.string().trim();

export const applicantIntakeSchema = z
  .object({
    name: requiredTrimmedString("Full name is required"),
    email: z.string().trim().email("Enter a valid email address"),
    dateOfBirth: requiredTrimmedString("Date of birth is required").refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Enter a valid date of birth"
    ),
    gender: z.string().trim().optional(),
    voicePart: z.enum(VOICE_PART_VALUES),
    phone: requiredTrimmedString("Phone number is required"),
    address: requiredTrimmedString("Street address is required"),
    city: requiredTrimmedString("City is required"),
    state: requiredTrimmedString("State is required"),
    zip: requiredTrimmedString("ZIP or postal code is required"),
    chapter: requiredTrimmedString("Chapter is required"),
    schoolName: z.string().trim().optional(),
    schoolCity: z.string().trim().optional(),
    schoolState: z.string().trim().optional(),
    highSchoolName: z.string().trim().optional(),
    collegeName: z.string().trim().optional(),
    major: z.string().trim().optional(),
    video1Title: requiredTrimmedString("Video 1 title is required"),
    video1Url: optionalUrl,
    video2Title: requiredTrimmedString("Video 2 title is required"),
    video2Url: optionalUrl,
    video3Title: requiredTrimmedString("Video 3 title is required"),
    video3Url: optionalUrl,
    headshotUrl: optionalStoredAssetRef,
    bio: requiredTrimmedString("Bio is required"),
    careerPlans: requiredTrimmedString("Future career plans are required"),
    scholarshipUse: requiredTrimmedString("Use of scholarship funds is required"),
    parentName: z.string().trim().optional(),
    parentEmail: z
      .string()
      .trim()
      .email("Enter a valid parent/guardian email address")
      .optional()
      .or(z.literal("")),
    citizenshipStatus: z.enum(CITIZENSHIP_STATUS_VALUES),
    citizenshipDocumentUrl: optionalStoredAssetRef.optional().or(z.literal("")),
    mediaRelease: z
      .boolean()
      .refine((value) => value, "You must grant the media release permission"),
    certifyAccuracy: z
      .boolean()
      .refine((value) => value, "You must certify that the information is accurate"),
    acceptPrivacyPolicy: z
      .boolean()
      .refine((value) => value, "You must acknowledge the privacy policy"),
    acceptTerms: z
      .boolean()
      .refine((value) => value, "You must agree to the submission terms"),
  })
  .superRefine((value, ctx) => {
    const ageOnMarchFirst = getAgeOnDate(
      value.dateOfBirth,
      getMarchFirstReferenceDate()
    );

    if (ageOnMarchFirst !== null && ageOnMarchFirst > 22) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message:
          "Applicants must be age 22 or younger as of March 1 of the current year",
      });
    }

    if (!value.headshotUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["headshotUrl"],
        message: "Headshot URL is required",
      });
    }

    if (value.citizenshipStatus !== "Other / Not Applicable" && !value.citizenshipDocumentUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["citizenshipDocumentUrl"],
        message: "Citizenship or residency proof is required",
      });
    }

    if (isMinor(value.dateOfBirth)) {
      if (!value.parentName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentName"],
          message: "Parent or guardian name is required for applicants under 18",
        });
      }

      if (!value.parentEmail?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parentEmail"],
          message: "Parent or guardian email is required for applicants under 18",
        });
      }
    }
  });

export type ApplicantIntakeValues = z.infer<typeof applicantIntakeSchema>;
