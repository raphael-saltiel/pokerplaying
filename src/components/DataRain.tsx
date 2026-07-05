// Colonnes de données hexadécimales qui défilent en fond — signature DARKPOOL.
// Contenu généré de façon DÉTERMINISTE (même rendu serveur/client, pas de
// mismatch d'hydratation). Purement décoratif, pointer-events: none.

function pseudoRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeColumn(seed: number, lines: number): string {
  const rnd = pseudoRandom(seed);
  const out: string[] = [];
  for (let i = 0; i < lines; i++) {
    const n = Math.floor(rnd() * 0xffff);
    out.push(n.toString(16).padStart(4, "0").toUpperCase());
  }
  return out.join("\n");
}

const COLUMNS = [
  { x: "3%", dur: "38s", txt: makeColumn(7, 60), mobile: false },
  { x: "21%", dur: "52s", txt: makeColumn(23, 60), mobile: false },
  { x: "79%", dur: "44s", txt: makeColumn(41, 60), mobile: true },
  { x: "96%", dur: "60s", txt: makeColumn(59, 60), mobile: true },
];

export function DataRain() {
  return (
    <>
      {COLUMNS.map((col, i) => (
        <div
          key={i}
          aria-hidden
          className={`data-rain ${col.mobile ? "" : "hidden md:block"}`}
          style={{ left: col.x }}
        >
          <div style={{ animationDuration: col.dur }}>
            {col.txt}
            {"\n"}
            {col.txt}
          </div>
        </div>
      ))}
    </>
  );
}
