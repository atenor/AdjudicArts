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
export const PRIOR_WIN_DIVISION_OPTIONS = [
  { value: "16-18", label: "Division 16-18" },
  { value: "19-22", label: "Division 19-22" },
] as const;
export const VIDEO_LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "italian", label: "Italian" },
  { value: "german", label: "German" },
  { value: "french", label: "French" },
  { value: "spanish", label: "Spanish" },
  { value: "russian", label: "Russian" },
  { value: "czech", label: "Czech" },
  { value: "latin", label: "Latin" },
  { value: "other", label: "Other" },
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

function getDivisionOnMarchFirst(dateOfBirth: string) {
  const ageOnMarchFirst = getAgeOnDate(dateOfBirth, getMarchFirstReferenceDate());
  if (ageOnMarchFirst === null) return null;
  if (ageOnMarchFirst >= 16 && ageOnMarchFirst <= 18) return "16-18" as const;
  if (ageOnMarchFirst >= 19 && ageOnMarchFirst <= 22) return "19-22" as const;
  return null;
}

function isMinor(dateOfBirth: string) {
  const age = getAgeOnDate(dateOfBirth, new Date());
  return age !== null && age < 18;
}

const requiredTrimmedString = (message: string) =>
  z.string().trim().min(1, message);

const optionalUrl = z.string().trim().url("Enter a valid URL");
const optionalStoredAssetRef = z.string().trim();
const PRIOR_WIN_DIVISION_VALUES = PRIOR_WIN_DIVISION_OPTIONS.map(
  (option) => option.value
) as [string, ...string[]];
const VIDEO_LANGUAGE_VALUES = VIDEO_LANGUAGE_OPTIONS.map(
  (option) => option.value
) as [string, ...string[]];

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
    video1PieceTitle: requiredTrimmedString("Video 1 title is required"),
    video1Composer: requiredTrimmedString("Video 1 composer is required"),
    video1Poet: z.string().trim().optional(),
    video1Language: z.enum(VIDEO_LANGUAGE_VALUES),
    video1Url: optionalUrl,
    video2PieceTitle: requiredTrimmedString("Video 2 title is required"),
    video2Composer: requiredTrimmedString("Video 2 composer is required"),
    video2Poet: z.string().trim().optional(),
    video2Language: z.enum(VIDEO_LANGUAGE_VALUES),
    video2Url: optionalUrl,
    video3PieceTitle: requiredTrimmedString("Video 3 title is required"),
    video3Composer: requiredTrimmedString("Video 3 composer is required"),
    video3Poet: z.string().trim().optional(),
    video3Language: z.enum(VIDEO_LANGUAGE_VALUES),
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
    certifyDateOfBirth: z
      .boolean()
      .refine((value) => value, "You must certify your date of birth"),
    hasPriorFirstPrize: z.boolean(),
    priorFirstPrizeDivision: z.enum(PRIOR_WIN_DIVISION_VALUES).optional().or(z.literal("")),
    prizeWinnerCertification: z
      .boolean()
      .refine(
        (value) => value,
        "You must certify prior prize-winner eligibility before submitting"
      ),
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
    const currentDivision = getDivisionOnMarchFirst(value.dateOfBirth);

    if (ageOnMarchFirst !== null && ageOnMarchFirst < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message:
          "Applicants must be at least age 16 as of March 1 of the current year",
      });
    }

    if (ageOnMarchFirst !== null && ageOnMarchFirst > 22) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message:
          "Applicants must be age 22 or younger as of March 1 of the current year",
      });
    }

    if (value.hasPriorFirstPrize && !value.priorFirstPrizeDivision) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priorFirstPrizeDivision"],
        message: "Select the division where you previously won first place",
      });
    }

    if (
      value.hasPriorFirstPrize &&
      value.priorFirstPrizeDivision &&
      currentDivision &&
      value.priorFirstPrizeDivision === currentDivision
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priorFirstPrizeDivision"],
        message:
          "Applicants may not re-enter a division where they have already won first place",
      });
    }

    const normalizedUrls = [value.video1Url, value.video2Url, value.video3Url]
      .map((url) => url.trim().toLowerCase());
    if (new Set(normalizedUrls).size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video3Url"],
        message: "Provide three separate and unique video URLs",
      });
    }

    const languages = [value.video1Language, value.video2Language, value.video3Language];
    if (new Set(languages).size !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video3Language"],
        message: "Each video must be in a different language",
      });
    }
    if (!languages.includes("english")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video1Language"],
        message: "One video must be in English",
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
