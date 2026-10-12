/** "$15" or "$12.50": whole dollars drop the cents, anything else keeps them. */
export function formatFee(cents: number): string {
  const dollars = cents / 100;
  return `$${cents % 100 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
}
