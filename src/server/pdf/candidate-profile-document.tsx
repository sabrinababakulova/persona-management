import path from "node:path";
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  CandidateProfileData,
  ProfileRenderOptions,
  ProfileSection,
} from "./candidate-profile-data";
import { PersonHuntersLogo } from "./person-hunters-logo";

// react-pdf's built-in Helvetica uses WinAnsi encoding and cannot render
// Cyrillic. Register a Unicode TTF (full Latin + Cyrillic) so the Russian UI
// data renders correctly. Resolved from disk at module load — no network.
const FONT_DIR = path.join(process.cwd(), "src/server/pdf/fonts");

Font.register({
  family: "DejaVuSans",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSans.ttf"), fontWeight: "normal" },
    { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

// Long URLs/emails without spaces would otherwise overflow the page.
Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  text: "#000000",
  border: "#000000",
  footer: "#8C8C8C",
};

const LEFT_COL_WIDTH = 96;

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 54,
    fontSize: 11,
    fontFamily: "DejaVuSans",
    color: COLORS.text,
    lineHeight: 1.3,
  },
  logo: { position: "absolute", top: 28, right: 54 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    textAlign: "right",
    fontSize: 9,
    color: COLORS.footer,
  },
  footerLink: { color: COLORS.footer, textDecoration: "none" },
  name: {
    textAlign: "center",
    fontSize: 13,
    marginBottom: 14,
    marginTop: 18,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  infoCol: { flexGrow: 1, paddingRight: 12 },
  infoLine: { marginBottom: 2 },
  infoGap: { height: 16 },
  photo: { width: 86, height: 110, objectFit: "cover" },
  sectionHeading: {
    textAlign: "center",
    fontSize: 11,
    marginTop: 18,
    marginBottom: 8,
  },
  // Grid borders: container draws top+left, every cell draws right+bottom.
  table: {
    borderTopWidth: 0.75,
    borderLeftWidth: 0.75,
    borderColor: COLORS.border,
  },
  row: { flexDirection: "row" },
  cellLeft: {
    width: LEFT_COL_WIDTH,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
    padding: 5,
  },
  cellRight: {
    flex: 1,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
    padding: 5,
  },
  cellText: { fontSize: 10.5 },
  company: { fontSize: 10.5, fontWeight: "bold" },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 9, fontSize: 10.5 },
  bulletText: { flex: 1, fontSize: 10.5 },
  orderedBlock: { marginBottom: 6 },
  infoRowTable: { marginTop: 8 },
});

function Cell({
  variant,
  children,
}: {
  variant: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <View style={variant === "left" ? styles.cellLeft : styles.cellRight}>
      {children}
    </View>
  );
}

function LanguagesLines({ data }: { data: CandidateProfileData }) {
  return (
    <>
      {data.languages.map((language) => (
        <Text key={language.name} style={styles.infoLine}>
          {language.name} — {language.level}
        </Text>
      ))}
    </>
  );
}

function EducationSection({ data }: { data: CandidateProfileData }) {
  return (
    <>
      <Text style={styles.sectionHeading}>Education</Text>
      <View style={styles.table}>
        {data.education.map((item) => (
          <View
            key={`${item.period}-${item.institution}`}
            style={styles.row}
            wrap={false}
          >
            <Cell variant="left">
              <Text style={styles.cellText}>{item.period}</Text>
            </Cell>
            <Cell variant="right">
              <Text style={styles.cellText}>{item.institution}</Text>
              {item.gpa ? (
                <Text style={styles.cellText}>GPA: {item.gpa}</Text>
              ) : null}
            </Cell>
          </View>
        ))}
      </View>
    </>
  );
}

function WorkExperienceSection({ data }: { data: CandidateProfileData }) {
  return (
    <>
      <Text style={styles.sectionHeading}>Experience:</Text>
      <View style={styles.table}>
        {data.workExperience.map((job) => (
          <View
            key={`${job.period}-${job.company}`}
            style={styles.row}
            wrap={false}
          >
            <Cell variant="left">
              <Text style={styles.cellText}>{job.period}</Text>
            </Cell>
            <Cell variant="right">
              <Text style={styles.company}>{job.company}</Text>
              {job.position ? (
                <Text style={styles.cellText}>{job.position}</Text>
              ) : null}
              {job.description.map((line) => (
                <View key={`${job.company}-${line}`} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </Cell>
          </View>
        ))}
      </View>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.table, styles.infoRowTable]}>
      <View style={styles.row} wrap={false}>
        <Cell variant="left">
          <Text style={styles.cellText}>{label}</Text>
        </Cell>
        <Cell variant="right">
          <Text style={styles.cellText}>{value}</Text>
        </Cell>
      </View>
    </View>
  );
}

/**
 * One self-contained block per section, used by the custom (ordered) layout.
 * Returns null when the section has no data so the order list can skip it.
 */
function renderSectionBlock(
  section: ProfileSection,
  data: CandidateProfileData,
) {
  switch (section) {
    case "experience":
      return data.experience ? (
        <Text style={styles.infoLine}>Experience: {data.experience}</Text>
      ) : null;
    case "dateOfBirth":
      return data.dateOfBirth ? (
        <Text style={styles.infoLine}>Date of birth: {data.dateOfBirth}</Text>
      ) : null;
    case "languages":
      return data.languages.length > 0 ? <LanguagesLines data={data} /> : null;
    case "education":
      return data.education.length > 0 ? (
        <EducationSection data={data} />
      ) : null;
    case "workExperience":
      return data.workExperience.length > 0 ? (
        <WorkExperienceSection data={data} />
      ) : null;
    case "additionalInfo":
      return data.additionalInfo ? (
        <InfoRow label="Additional information:" value={data.additionalInfo} />
      ) : null;
    case "salary":
      return data.salaryExpectation ? (
        <InfoRow label="Salary expectations:" value={data.salaryExpectation} />
      ) : null;
    default:
      return null;
  }
}

/** Fixed Person Hunters layout: grouped info block + photo, then sections. */
function BrandedBody({ data }: { data: CandidateProfileData }) {
  const showExperience = Boolean(data.experience);
  const showDateOfBirth = Boolean(data.dateOfBirth);
  const showLanguages = data.languages.length > 0;

  const bottomRows: { label: string; value: string }[] = [];
  if (data.additionalInfo) {
    bottomRows.push({
      label: "Additional information:",
      value: data.additionalInfo,
    });
  }
  if (data.salaryExpectation) {
    bottomRows.push({
      label: "Salary expectations:",
      value: data.salaryExpectation,
    });
  }

  return (
    <>
      <View style={styles.topRow}>
        <View style={styles.infoCol}>
          {showExperience ? (
            <Text style={styles.infoLine}>Experience: {data.experience}</Text>
          ) : null}
          {showDateOfBirth ? (
            <Text style={styles.infoLine}>
              Date of birth: {data.dateOfBirth}
            </Text>
          ) : null}
          {showLanguages ? (
            <>
              <View style={styles.infoGap} />
              <LanguagesLines data={data} />
            </>
          ) : null}
        </View>
        {data.photoSrc ? (
          <Image src={data.photoSrc} style={styles.photo} />
        ) : null}
      </View>

      {data.education.length > 0 ? <EducationSection data={data} /> : null}
      {data.workExperience.length > 0 ? (
        <WorkExperienceSection data={data} />
      ) : null}

      {bottomRows.length > 0 ? (
        <View style={[styles.table, { marginTop: 18 }]}>
          {bottomRows.map((entry) => (
            <View key={entry.label} style={styles.row} wrap={false}>
              <Cell variant="left">
                <Text style={styles.cellText}>{entry.label}</Text>
              </Cell>
              <Cell variant="right">
                <Text style={styles.cellText}>{entry.value}</Text>
              </Cell>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** Custom layout: each selected section rendered in the user-chosen order. */
function OrderedBody({
  data,
  sections,
}: {
  data: CandidateProfileData;
  sections: ProfileSection[];
}) {
  return (
    <>
      {sections.map((section) => {
        const block = renderSectionBlock(section, data);
        return block ? (
          <View key={section} style={styles.orderedBlock}>
            {block}
          </View>
        ) : null;
      })}
    </>
  );
}

export function CandidateProfileDocument({
  data,
  options,
}: {
  data: CandidateProfileData;
  options: ProfileRenderOptions;
}) {
  return (
    <Document
      author="Person Hunters"
      title={`${data.fullName} — Person Hunters`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Logo and footer repeat on every page when branding is enabled. */}
        {options.showBranding ? (
          <>
            <View fixed style={styles.logo}>
              <PersonHuntersLogo />
            </View>
            <View fixed style={styles.footer}>
              <Text>
                <Link
                  src="http://www.personhunters.com"
                  style={styles.footerLink}
                >
                  http://www.personhunters.com
                </Link>
              </Text>
              <Text>
                <Link
                  src="https://www.facebook.com/PersonHunters"
                  style={styles.footerLink}
                >
                  https://www.facebook.com/PersonHunters
                </Link>
              </Text>
            </View>
          </>
        ) : null}

        <Text style={styles.name}>{data.fullName}</Text>

        {options.showBranding ? (
          <BrandedBody data={data} />
        ) : (
          <OrderedBody data={data} sections={options.sections} />
        )}
      </Page>
    </Document>
  );
}
