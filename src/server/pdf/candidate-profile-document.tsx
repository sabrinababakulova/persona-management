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
  ResumeLogo,
} from "./candidate-profile-data";
import {
  hasRecruiterAssessment,
  type RecruiterAssessmentField,
} from "./candidate-profile-input";
import { PERSON_HUNTERS_LAYOUT } from "./person-hunters-layout";

const FONT_DIR = path.join(process.cwd(), "src/server/pdf/fonts");
const LOGO_PATH = path.join(
  process.cwd(),
  "src/server/pdf/assets/person-hunters-logo.png",
);

Font.register({
  family: "LiberationSerif",
  fonts: [
    {
      src: path.join(FONT_DIR, "LiberationSerif-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(FONT_DIR, "LiberationSerif-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

Font.register({
  family: "DejaVuSans",
  fonts: [
    { src: path.join(FONT_DIR, "DejaVuSans.ttf"), fontWeight: "normal" },
    { src: path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

const COLORS = {
  text: "#111111",
  muted: "#808080",
  footer: "#8A918F",
  border: "#4F4F4F",
  positive: "#548235",
  negative: "#E00000",
};

const ASSESSMENT_ROWS: {
  key: RecruiterAssessmentField;
  label: string;
  tone: "positive" | "negative";
}[] = [
  { key: "willSucceed", label: "Справится", tone: "positive" },
  { key: "motivators", label: "Мотивирует", tone: "positive" },
  { key: "strengths", label: "Сильные стороны", tone: "positive" },
  { key: "willNotSucceed", label: "Не справится", tone: "negative" },
  { key: "demotivators", label: "Демотивирует", tone: "negative" },
  { key: "developmentAreas", label: "Зоны развития", tone: "negative" },
];

const styles = StyleSheet.create({
  brandedPage: {
    paddingTop: 96,
    paddingBottom: 72,
    paddingLeft: PERSON_HUNTERS_LAYOUT.margins.leftPoints,
    paddingRight: PERSON_HUNTERS_LAYOUT.margins.rightPoints,
    fontSize: PERSON_HUNTERS_LAYOUT.typography.bodyPoints,
    fontFamily: "LiberationSerif",
    color: COLORS.text,
    lineHeight: 1.12,
  },
  customPage: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingLeft: 85,
    paddingRight: 43,
    fontSize: 9.4,
    fontFamily: "DejaVuSans",
    color: COLORS.text,
    lineHeight: 1.22,
  },
  logo: {
    position: "absolute",
    top: PERSON_HUNTERS_LAYOUT.margins.headerTwips / 20,
    right: PERSON_HUNTERS_LAYOUT.margins.rightPoints,
    width: PERSON_HUNTERS_LAYOUT.logo.widthPoints,
    height: PERSON_HUNTERS_LAYOUT.logo.heightPoints,
  },
  logoImage: {
    width: PERSON_HUNTERS_LAYOUT.logo.widthPoints,
    height: PERSON_HUNTERS_LAYOUT.logo.heightPoints,
    objectFit: "contain",
  },
  footer: {
    position: "absolute",
    bottom: PERSON_HUNTERS_LAYOUT.margins.footerTwips / 20,
    left: PERSON_HUNTERS_LAYOUT.margins.leftPoints,
    right: PERSON_HUNTERS_LAYOUT.margins.rightPoints,
    textAlign: "right",
    fontSize: PERSON_HUNTERS_LAYOUT.typography.bodyPoints,
    fontFamily: "LiberationSerif",
    color: COLORS.footer,
    lineHeight: 1.1,
  },
  footerLink: { color: COLORS.footer, textDecoration: "none" },
  footerPrimaryLink: { color: COLORS.footer, textDecoration: "underline" },
  name: {
    textAlign: "center",
    fontSize: PERSON_HUNTERS_LAYOUT.typography.namePoints,
    fontWeight: "bold",
    marginBottom: 26,
    textTransform: "uppercase",
  },
  topRow: { flexDirection: "row", alignItems: "flex-start" },
  summary: { flex: 1, paddingRight: 14 },
  summaryLine: { marginBottom: 1.5 },
  summaryLabel: { fontWeight: "bold" },
  contactBlock: { marginTop: 6 },
  contactValue: { color: "#1565C0", textDecoration: "underline" },
  photo: {
    width: PERSON_HUNTERS_LAYOUT.photo.widthPoints,
    height: PERSON_HUNTERS_LAYOUT.photo.heightPoints,
    objectFit: "cover",
  },
  photoPlaceholder: {
    width: PERSON_HUNTERS_LAYOUT.photo.widthPoints,
    height: PERSON_HUNTERS_LAYOUT.photo.heightPoints,
    borderWidth: 0.75,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "bold",
  },
  coverLetter: { marginTop: 12 },
  coverLetterText: { marginTop: 2.5 },
  salary: { marginTop: 16 },
  sectionHeading: {
    textAlign: "center",
    fontSize: PERSON_HUNTERS_LAYOUT.typography.headingPoints,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  timelineRow: { flexDirection: "row", marginBottom: 12 },
  period: {
    width: PERSON_HUNTERS_LAYOUT.work.periodWidthPoints,
    paddingRight: 10,
    fontWeight: "bold",
  },
  timelineContent: { flex: 1 },
  company: { fontWeight: "bold", marginBottom: 2 },
  position: { fontWeight: "bold", marginBottom: 3 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 18 },
  bulletText: { flex: 1 },
  educationRow: { flexDirection: "row", marginBottom: 8 },
  educationPeriod: {
    width: PERSON_HUNTERS_LAYOUT.details.labelWidthPoints,
    paddingRight: 12,
  },
  educationContent: { flex: 1 },
  detailsRow: { flexDirection: "row", marginTop: 8 },
  detailsLabel: {
    width: PERSON_HUNTERS_LAYOUT.details.labelWidthPoints,
    paddingRight: 12,
    fontWeight: "bold",
  },
  detailsSpacer: { width: PERSON_HUNTERS_LAYOUT.details.labelWidthPoints },
  detailsValue: { flex: 1 },
  assessmentBlock: { width: PERSON_HUNTERS_LAYOUT.assessment.tableWidthPoints },
  assessmentHeading: { marginBottom: 2 },
  assessmentSubtitle: {
    textAlign: "center",
    color: COLORS.muted,
    fontWeight: "bold",
    marginBottom: 7,
  },
  assessmentTable: {
    width: PERSON_HUNTERS_LAYOUT.assessment.tableWidthPoints,
    borderTopWidth: 0.75,
    borderLeftWidth: 0.75,
    borderColor: COLORS.border,
  },
  assessmentRow: { flexDirection: "row" },
  assessmentLabel: {
    width: PERSON_HUNTERS_LAYOUT.assessment.labelWidthPoints,
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
    fontWeight: "bold",
  },
  assessmentValue: {
    flex: 1,
    paddingVertical: 3.5,
    paddingHorizontal: 9,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
  },
  customLogoWrap: { alignItems: "flex-end", marginBottom: 14 },
  customName: { textAlign: "center", fontSize: 13, marginBottom: 14 },
  customTable: {
    borderTopWidth: 0.75,
    borderLeftWidth: 0.75,
    borderColor: COLORS.border,
  },
  customRow: { flexDirection: "row" },
  customLeft: {
    width: 96,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
    padding: 5,
  },
  customRight: {
    flex: 1,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: COLORS.border,
    padding: 5,
  },
  customBlock: { marginBottom: 6 },
});

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

function CandidatePhoto({ data }: { data: CandidateProfileData }) {
  return data.photoSrc ? (
    <Image src={data.photoSrc} style={styles.photo} />
  ) : (
    <View style={styles.photoPlaceholder}>
      <Text style={styles.photoPlaceholderText}>ФОТО</Text>
    </View>
  );
}

function ContactLines({ data }: { data: CandidateProfileData }) {
  if (data.contacts.length === 0) {
    return null;
  }
  return (
    <View style={styles.contactBlock}>
      <Text style={styles.summaryLabel}>Контакты:</Text>
      {data.contacts.map((contact) => (
        <Text
          key={`${contact.type}-${contact.value}`}
          style={styles.contactValue}
        >
          {contact.value}
        </Text>
      ))}
    </View>
  );
}

function WorkExperienceSection({ data }: { data: CandidateProfileData }) {
  if (data.workExperience.length === 0) {
    return null;
  }
  return (
    <>
      <Text minPresenceAhead={40} style={styles.sectionHeading}>
        ОПЫТ РАБОТЫ
      </Text>
      {data.workExperience.map((job) => (
        <View
          key={`${job.period}-${job.company}`}
          minPresenceAhead={72}
          style={styles.timelineRow}
        >
          <Text style={styles.period}>{job.period}</Text>
          <View style={styles.timelineContent}>
            <Text style={styles.company}>{job.company}</Text>
            {job.position ? (
              <Text style={styles.position}>{job.position}</Text>
            ) : null}
            {job.description.map((line) => (
              <View
                key={`${job.period}-${job.company}-${line}`}
                style={styles.bullet}
              >
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function EducationSection({ data }: { data: CandidateProfileData }) {
  if (data.education.length === 0) {
    return null;
  }
  return (
    <>
      <Text minPresenceAhead={32} style={styles.sectionHeading}>
        ОБРАЗОВАНИЕ
      </Text>
      {data.education.map((item) => (
        <View
          key={`${item.period}-${item.institution}`}
          style={styles.educationRow}
          wrap={false}
        >
          <Text style={styles.educationPeriod}>{item.period}</Text>
          <View style={styles.educationContent}>
            <Text>{item.institution}</Text>
            {item.gpa ? <Text>{item.gpa}</Text> : null}
          </View>
        </View>
      ))}
    </>
  );
}

function AdditionalInfoSection({
  data,
  includeAiAnalysis,
}: {
  data: CandidateProfileData;
  includeAiAnalysis: boolean;
}) {
  const showAi = includeAiAnalysis && Boolean(data.aiAnalysis);
  if (!showAi && data.skills.length === 0 && data.languages.length === 0) {
    return null;
  }
  return (
    <>
      <Text minPresenceAhead={36} style={styles.sectionHeading}>
        ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
      </Text>
      {showAi ? (
        <View style={styles.detailsRow}>
          <Text style={styles.detailsSpacer} />
          <Text style={styles.detailsValue}>{data.aiAnalysis}</Text>
        </View>
      ) : null}
      {data.skills.length > 0 ? (
        <View style={styles.detailsRow} wrap={false}>
          <Text style={styles.detailsLabel}>Навыки:</Text>
          <Text style={styles.detailsValue}>{data.skills.join("\n")}</Text>
        </View>
      ) : null}
      {data.languages.length > 0 ? (
        <View style={styles.detailsRow} wrap={false}>
          <Text style={styles.detailsLabel}>Знание языков:</Text>
          <Text style={styles.detailsValue}>
            {data.languages
              .map((item) => `${item.name} - ${item.level}`)
              .join("\n")}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function RecruiterAssessment({ options }: { options: ProfileRenderOptions }) {
  if (!hasRecruiterAssessment(options.recruiterAssessment)) {
    return null;
  }

  return (
    <View style={styles.assessmentBlock}>
      <Text
        minPresenceAhead={120}
        style={[styles.sectionHeading, styles.assessmentHeading]}
      >
        ОЦЕНКА РЕКРУТЕРА
      </Text>
      <Text style={styles.assessmentSubtitle}>
        (заполняется рекрутером по итогам интервью или оценочных мероприятий)
      </Text>
      <View style={styles.assessmentTable}>
        {ASSESSMENT_ROWS.map((row) => (
          <View key={row.key} style={styles.assessmentRow} wrap={false}>
            <Text
              style={[
                styles.assessmentLabel,
                {
                  color:
                    row.tone === "positive" ? COLORS.positive : COLORS.negative,
                },
              ]}
            >
              {row.label}
            </Text>
            <Text style={styles.assessmentValue}>
              {options.recruiterAssessment?.[row.key] || "-"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BrandedBody({
  data,
  options,
}: {
  data: CandidateProfileData;
  options: ProfileRenderOptions;
}) {
  const coverLetter = options.coverLetter?.trim();

  return (
    <>
      <View style={styles.topRow} wrap={false}>
        <View style={styles.summary}>
          {data.city ? (
            <SummaryLine label="Место проживания" value={data.city} />
          ) : null}
          {data.experience ? (
            <SummaryLine label="Опыт работы" value={data.experience} />
          ) : null}
          {data.currentPosition ? (
            <SummaryLine label="Специализация" value={data.currentPosition} />
          ) : null}
          <ContactLines data={data} />
        </View>
        <CandidatePhoto data={data} />
      </View>

      {coverLetter ? (
        <View style={styles.coverLetter}>
          <Text style={styles.summaryLabel}>Сопроводительное письмо:</Text>
          <Text style={styles.coverLetterText}>{coverLetter}</Text>
        </View>
      ) : null}

      {data.salaryExpectation ? (
        <Text style={styles.salary}>
          <Text style={styles.summaryLabel}>
            Рассматриваем уровень заработной платы:{" "}
          </Text>
          {data.salaryExpectation}
        </Text>
      ) : null}

      <WorkExperienceSection data={data} />
      <EducationSection data={data} />
      <AdditionalInfoSection
        data={data}
        includeAiAnalysis={options.includeAiAnalysis === true}
      />
      <RecruiterAssessment options={options} />
    </>
  );
}

function CustomLogo({ logo }: { logo: ResumeLogo }) {
  const src = `data:image/${logo.type};base64,${logo.data.toString("base64")}`;
  return (
    <View style={styles.customLogoWrap}>
      <Image src={src} style={{ width: logo.width, height: logo.height }} />
    </View>
  );
}

function CustomTableRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.customRow} wrap={false}>
      <View style={styles.customLeft}>
        <Text>{label}</Text>
      </View>
      <View style={styles.customRight}>
        <Text>{value}</Text>
      </View>
    </View>
  );
}

function renderCustomSection(
  section: ProfileSection,
  data: CandidateProfileData,
) {
  switch (section) {
    case "experience":
      return data.experience ? <Text>Стаж: {data.experience}</Text> : null;
    case "dateOfBirth":
      return data.dateOfBirth ? (
        <Text>Дата рождения: {data.dateOfBirth}</Text>
      ) : null;
    case "languages":
      return data.languages.length > 0 ? (
        <Text>
          {data.languages
            .map((item) => `${item.name} - ${item.level}`)
            .join("\n")}
        </Text>
      ) : null;
    case "education":
      return data.education.length > 0 ? (
        <EducationSection data={data} />
      ) : null;
    case "workExperience":
      return data.workExperience.length > 0 ? (
        <WorkExperienceSection data={data} />
      ) : null;
    case "additionalInfo":
      return data.aiAnalysis ? (
        <View style={styles.customTable}>
          <CustomTableRow label="Доп. информация" value={data.aiAnalysis} />
        </View>
      ) : null;
    case "salary":
      return data.salaryExpectation ? (
        <View style={styles.customTable}>
          <CustomTableRow
            label="Зарплатные ожидания"
            value={data.salaryExpectation}
          />
        </View>
      ) : null;
    default:
      return null;
  }
}

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
        const block = renderCustomSection(section, data);
        return block ? (
          <View key={section} style={styles.customBlock}>
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
      language="ru"
      title={`${data.fullName} - Person Hunters`}
    >
      <Page
        size="LETTER"
        style={options.showBranding ? styles.brandedPage : styles.customPage}
      >
        {options.showBranding ? (
          <>
            <View fixed style={styles.logo}>
              <Image src={LOGO_PATH} style={styles.logoImage} />
            </View>
            <View fixed style={styles.footer}>
              <Text>
                <Link
                  src="http://www.personhunters.com"
                  style={styles.footerPrimaryLink}
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

        {!options.showBranding && options.logo ? (
          <CustomLogo logo={options.logo} />
        ) : null}

        <Text style={options.showBranding ? styles.name : styles.customName}>
          {data.fullName}
        </Text>

        {options.showBranding ? (
          <BrandedBody data={data} options={options} />
        ) : (
          <OrderedBody data={data} sections={options.sections} />
        )}
      </Page>
    </Document>
  );
}
