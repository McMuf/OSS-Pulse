// Purely decorative, ambient motion behind the page content — continuous
// left-to-right drifting sparkline-style paths in alternating red/green,
// evoking market volatility without being loud enough to hurt readability.
// Pure SVG + CSS animation, no JS/canvas loop, so it costs nothing at runtime.

type Lane = {
  top: string;
  duration: string;
  opacity: number;
  color: string;
  points: string;
};

const LANES: Lane[] = [
  {
    top: "8%",
    duration: "55s",
    opacity: 0.1,
    color: "#0f9d63",
    points: "0,40 40,20 80,55 120,15 160,45 200,25 240,60 280,10 320,40 360,20 400,50",
  },
  {
    top: "28%",
    duration: "70s",
    opacity: 0.08,
    color: "#d64545",
    points: "0,25 35,50 70,15 110,45 150,20 190,55 230,25 270,45 310,10 350,35 400,15",
  },
  {
    top: "52%",
    duration: "48s",
    opacity: 0.09,
    color: "#0f9d63",
    points: "0,50 30,20 65,40 100,10 140,45 180,25 220,55 260,20 300,45 340,15 400,40",
  },
  {
    top: "74%",
    duration: "63s",
    opacity: 0.07,
    color: "#d64545",
    points: "0,15 40,45 75,25 115,55 155,15 195,40 235,20 275,50 315,25 355,45 400,20",
  },
  {
    top: "92%",
    duration: "58s",
    opacity: 0.08,
    color: "#0f9d63",
    points: "0,35 35,15 70,45 105,25 145,50 185,20 225,40 265,15 305,50 345,25 400,45",
  },
];

function Lane({ lane }: { lane: Lane }) {
  return (
    <svg
      className="absolute left-0 w-[200%] h-16"
      style={{
        top: lane.top,
        opacity: lane.opacity,
        animation: `market-scroll ${lane.duration} linear infinite`,
      }}
      viewBox="0 0 800 60"
      preserveAspectRatio="none"
    >
      <polyline
        points={lane.points}
        fill="none"
        stroke={lane.color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={lane.points}
        fill="none"
        stroke={lane.color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(400, 0)"
      />
    </svg>
  );
}

export function MarketLinesBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {LANES.map((lane, i) => (
        <Lane key={i} lane={lane} />
      ))}
    </div>
  );
}
