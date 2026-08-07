import Svg, { Path, Circle } from "react-native-svg";

export function ProfileIcon({ size = 34, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg viewBox="0 0 56.6 56.6" width={size} height={size}>
      {/* Shoulders */}
      <Path
        d="M9.58,47.52c3.73-8.03,10.72-13.44,18.72-13.44s14.99,5.41,18.72,13.44"
        fill="none"
        stroke={color}
        strokeMiterlimit={10}
        strokeWidth={2.2}
      />
      {/* Outer ring */}
      <Path
        d="M55.13,28.3c0,7.53-3.1,14.34-8.1,19.21-4.83,4.71-11.44,7.61-18.72,7.61s-13.89-2.9-18.72-7.61C4.58,42.64,1.47,35.83,1.47,28.3,1.47,13.49,13.49,1.47,28.3,1.47s26.83,12.01,26.83,26.83Z"
        fill="none"
        stroke={color}
        strokeMiterlimit={10}
        strokeWidth={2.2}
      />
      {/* Head */}
      <Circle cx="28.3" cy="23.81" r="10.27" fill="none" stroke={color} strokeMiterlimit={10} strokeWidth={2.2} />
    </Svg>
  );
}
