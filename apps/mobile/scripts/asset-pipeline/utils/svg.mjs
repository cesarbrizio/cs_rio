function attrsToString(attributes = {}) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(' ');
}

function tag(name, attributes = {}, content = '') {
  const attrs = attrsToString(attributes);
  if (content === null) {
    return `<${name}${attrs ? ` ${attrs}` : ''}/>`;
  }
  return `<${name}${attrs ? ` ${attrs}` : ''}>${content}</${name}>`;
}

export function svgDocument({ viewBox = '0 0 160 160', content }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">${content}</svg>`;
}

export function group(content, attributes = {}) {
  return tag('g', attributes, content);
}

export function polygon(points, attributes = {}) {
  return tag('polygon', { points, ...attributes }, null);
}

export function rect(x, y, width, height, attributes = {}) {
  return tag('rect', { x, y, width, height, ...attributes }, null);
}

export function ellipse(cx, cy, rx, ry, attributes = {}) {
  return tag('ellipse', { cx, cy, rx, ry, ...attributes }, null);
}

export function pathTag(d, attributes = {}) {
  return tag('path', { d, ...attributes }, null);
}

export function line(x1, y1, x2, y2, attributes = {}) {
  return tag('line', { x1, y1, x2, y2, ...attributes }, null);
}
