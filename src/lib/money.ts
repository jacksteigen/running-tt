/**
 * "$15", "$12.50" or "$1,500": whole dollars drop the cents, anything else
 * keeps them, and thousands are grouped so a purse reads at a glance.
 */
export function formatFee(cents: number): string {
  const dollars = cents / 100;
  const [whole, fraction] = (cents % 100 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${grouped}${fraction ? `.${fraction}` : ""}`;
}
