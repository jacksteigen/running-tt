import qrcode from "qrcode-generator";

/**
 * Server-rendered QR code as plain SVG rectangles. No client JavaScript and
 * no external image service, so it renders instantly on any screen.
 */
export default function QRCode({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const margin = 2;
  const size = count + margin * 2;

  const cells: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        cells.push(`M${col + margin},${row + margin}h1v1h-1z`);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`QR code linking to ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={cells.join("")} fill="#1A1A18" />
    </svg>
  );
}
