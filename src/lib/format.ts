export function formatChips(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}
