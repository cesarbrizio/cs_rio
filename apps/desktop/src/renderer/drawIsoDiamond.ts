export function drawIsoDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfHeight);
  ctx.lineTo(centerX + halfWidth, centerY);
  ctx.lineTo(centerX, centerY + halfHeight);
  ctx.lineTo(centerX - halfWidth, centerY);
  ctx.closePath();
}
