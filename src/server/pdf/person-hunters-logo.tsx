import { Circle, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

/** Brand red sampled from the reference PDF (saturated dot core). */
export const PERSON_HUNTERS_RED = "#E6282D";
const WORDMARK_GRAY = "#545454";
const TAGLINE_GRAY = "#6D6D6D";

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center" },
  wordmarkCol: { marginLeft: 8 },
  wordmark: {
    fontSize: 13,
    fontWeight: "bold",
    color: WORDMARK_GRAY,
    lineHeight: 1.04,
    letterSpacing: 0.4,
  },
  tagline: {
    fontSize: 5.4,
    color: TAGLINE_GRAY,
    letterSpacing: 1.1,
    marginTop: 1.5,
  },
});

/**
 * Vector reproduction of the "PERSON HUNTERS" logo from the reference resume:
 * a 3×3 grid of red dots whose bottom-right cell is a downward triangle, next
 * to the two-line wordmark and tagline. Rebuilt as vector because the logo
 * embedded in the source PDF is only 186×58px — too low-res to reuse.
 */
export function PersonHuntersLogo() {
  // Grid cell centers at 20/50/80 on a 100×100 viewBox; dot radius 13.
  const centers = [20, 50, 80];
  const dots: { cx: number; cy: number }[] = [];
  for (const cy of centers) {
    for (const cx of centers) {
      // Bottom-right cell is the triangle, not a dot.
      if (cx === 80 && cy === 80) {
        continue;
      }
      dots.push({ cx, cy });
    }
  }

  return (
    <View style={styles.root}>
      <Svg height={30} viewBox="0 0 100 100" width={30}>
        {dots.map((dot) => (
          <Circle
            cx={dot.cx}
            cy={dot.cy}
            fill={PERSON_HUNTERS_RED}
            key={`${dot.cx}-${dot.cy}`}
            r={11}
          />
        ))}
        {/* Downward triangle in the bottom-right cell. */}
        <Path d="M69 70 L91 70 L80 91 Z" fill={PERSON_HUNTERS_RED} />
      </Svg>
      <View style={styles.wordmarkCol}>
        <Text style={styles.wordmark}>PERSON</Text>
        <Text style={styles.wordmark}>HUNTERS</Text>
        <Text style={styles.tagline}>executive recruitment</Text>
      </View>
    </View>
  );
}
