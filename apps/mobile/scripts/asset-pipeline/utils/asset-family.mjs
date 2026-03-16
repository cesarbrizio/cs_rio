function normalizeToken(token = '') {
  return String(token)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function inferAssetFamily(assetType = '', category = 'poor') {
  const normalizedType = normalizeToken(assetType);

  if (normalizedType.includes('favela cluster') || normalizedType.includes('favela-cluster')) {
    return 'favela-cluster';
  }

  if (normalizedType.includes('barraco')) {
    return 'barraco';
  }

  if (normalizedType.includes('baile')) {
    return 'baile';
  }

  if (normalizedType.includes('rave')) {
    return 'baile';
  }

  if (normalizedType.includes('boca')) {
    return 'boca';
  }

  if (normalizedType.includes('market-clandestino') || normalizedType.includes('mercado-negro') || normalizedType.includes('mercado negro') || normalizedType.includes('market') || normalizedType.includes('mercado')) {
    return 'market-clandestino';
  }

  if (normalizedType.includes('gym') || normalizedType.includes('treino')) {
    return 'gym';
  }

  if (normalizedType.includes('hospital')) {
    return 'hospital';
  }

  if (normalizedType.includes('prison') || normalizedType.includes('prisao')) {
    return 'prison';
  }

  if (normalizedType.includes('university') || normalizedType.includes('universidade')) {
    return 'university';
  }

  if (normalizedType.includes('dock-industrial') || normalizedType.includes('docas') || normalizedType.includes('doca')) {
    return 'dock-industrial';
  }

  if (normalizedType.includes('factory')) {
    return 'factory';
  }

  if (normalizedType.includes('junkyard') || normalizedType.includes('desmanche')) {
    return 'junkyard';
  }

  if (normalizedType.includes('residential-tower-modern') || normalizedType.includes('predio-residencial-moderno')) {
    return 'residential-tower-modern';
  }

  if (normalizedType.includes('residential-tower-simple') || normalizedType.includes('predio-residencial-simples')) {
    return 'residential-tower-simple';
  }

  if (normalizedType.includes('commercial-block-modern') || normalizedType.includes('predio-comercial-moderno')) {
    return 'commercial-block-modern';
  }

  if (normalizedType.includes('commercial-block-simple') || normalizedType.includes('predio-comercial-simples')) {
    return 'commercial-block-simple';
  }

  if (normalizedType.includes('house-wealthy') || normalizedType.includes('casa-residencial-moderna')) {
    return 'house-wealthy';
  }

  if (normalizedType.includes('house-simple') || normalizedType.includes('casa-residencial-simples')) {
    return 'house-simple';
  }

  if (category === 'favela') {
    return 'favela';
  }

  if (category === 'nightlife') {
    return 'baile';
  }

  if (category === 'hospital') {
    return 'hospital';
  }

  if (category === 'prison') {
    return 'prison';
  }

  if (category === 'factory') {
    return 'factory';
  }

  if (category === 'junkyard') {
    return 'junkyard';
  }

  if (category === 'market') {
    return 'market-clandestino';
  }

  if (category === 'wealthy') {
    return 'house-wealthy';
  }

  if (category === 'residential') {
    return 'residential-tower-simple';
  }

  return 'shared';
}
