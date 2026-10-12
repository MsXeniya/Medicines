// утилита для установки title, description, canonical и Open Graph метатегов
export function setSEO({ title, description, url, image } = {}) {
  if (title) {
    document.title = title;
  }

  const setMeta = (name, content, attr = 'name') => {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('description', description || 'Manage your medicines');
  // Open Graph
  setMeta('og:title', title || 'Medicines App', 'property');
  setMeta('og:description', description || 'Manage your medicines', 'property');
  if (url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
    setMeta('og:url', url, 'property');
  }
  if (image) setMeta('og:image', image, 'property');
}

export default setSEO;
