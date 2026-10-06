// The pairing link as a QR code: an SVG for the pairing page, and text for the terminal.
import qrcode from "qrcode-generator";

function encode(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

export function qrSvg(text: string): string {
  return encode(text).createSvgTag({ cellSize: 6, margin: 4, scalable: true });
}

/**
 * The QR code in half-block characters, two rows of modules per line. Light modules are drawn and dark ones left as
 * the terminal's background, so it reads on a dark terminal; on a light one, scan the page in the browser instead.
 */
export function qrTerminal(text: string): string {
  const qr = encode(text);
  const size = qr.getModuleCount();
  const margin = 2;
  const dark = (row: number, col: number) => row >= 0 && col >= 0 && row < size && col < size && qr.isDark(row, col);
  const lines: string[] = [];
  for (let row = -margin; row < size + margin; row += 2) {
    let line = "";
    for (let col = -margin; col < size + margin; col++) {
      const top = dark(row, col);
      const bottom = dark(row + 1, col);
      line += top && bottom ? " " : top ? "▄" : bottom ? "▀" : "█";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
