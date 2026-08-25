const POINTS_PER_INCH = 72;
const TWIPS_PER_POINT = 20;

const toPoints = (twips: number) => twips / TWIPS_PER_POINT;

/**
 * Geometry distilled from the authoritative Person Hunters recruiter resume.
 * PDF consumes points; DOCX consumes the exact source DXA (twip) values.
 */
export const PERSON_HUNTERS_LAYOUT = {
  page: {
    widthTwips: 12_240,
    heightTwips: 15_840,
    widthPoints: 8.5 * POINTS_PER_INCH,
    heightPoints: 11 * POINTS_PER_INCH,
  },
  margins: {
    leftTwips: 1_701,
    rightTwips: 850,
    topTwips: 1_134,
    bottomTwips: 1_134,
    headerTwips: 720,
    footerTwips: 720,
    leftPoints: toPoints(1_701),
    rightPoints: toPoints(850),
    topPoints: toPoints(1_134),
    bottomPoints: toPoints(1_134),
  },
  content: {
    widthTwips: 9_689,
    widthPoints: toPoints(9_689),
  },
  logo: {
    widthPoints: 140,
    heightPoints: 44,
    widthPixels: 187,
    heightPixels: 59,
  },
  photo: {
    widthTwips: 2_976,
    widthPoints: toPoints(2_976),
    heightPoints: 216,
  },
  work: {
    periodWidthTwips: 1_560,
    periodWidthPoints: toPoints(1_560),
  },
  details: {
    labelWidthTwips: 1_976,
    labelWidthPoints: toPoints(1_976),
  },
  assessment: {
    tableWidthTwips: 9_494,
    tableWidthPoints: toPoints(9_494),
    labelWidthTwips: 2_547,
    labelWidthPoints: toPoints(2_547),
  },
  typography: {
    bodyPoints: 12,
    bodyHalfPoints: 24,
    namePoints: 14,
    nameHalfPoints: 28,
    headingPoints: 12,
    headingHalfPoints: 24,
  },
} as const;
