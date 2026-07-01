// template.tsx est re-monté à chaque navigation : on l'utilise pour l'effet
// d'entrée d'écran (glitch / data-stream) lors du passage lobby <-> table.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="screen-in">{children}</div>;
}
