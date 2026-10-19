(() => {
  'use strict';
  const data = JSON.parse(document.querySelector('#project-data').textContent);
  const { projects, catalog } = data;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const archive = document.querySelector('#archive-dialog');
  const lightbox = document.querySelector('#lightbox');
  const imageScroll = lightbox.querySelector('.lightbox-image-scroll');
  const largeImage = imageScroll.querySelector('img');
  let archiveProject = null;
  let archiveFilter = 'all';
  let lightboxItems = [];
  let lightboxIndex = 0;
  let zoomed = false;
  let lastFocusedImage = null;

  function syncModalState() {
    document.body.classList.toggle('modal-open', archive.open || lightbox.open);
  }

  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.documentElement.classList.add('motion-ready');
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px 45px 0px' });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  }

  const sections = [...document.querySelectorAll('[data-chapter]')];
  const links = [...document.querySelectorAll('[data-nav]')];
  const parallaxItems = [...document.querySelectorAll('[data-parallax]')];
  const progress = document.querySelector('.reading-progress');
  let scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    const distance = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, scrollY / distance) : 0})`;
    let current = '';
    for (const section of sections) {
      if (section.getBoundingClientRect().top < innerHeight * 0.42) current = section.dataset.chapter;
    }
    for (const link of links) {
      if (link.dataset.nav === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    if (!reducedMotion.matches && innerWidth > 760) {
      for (const img of parallaxItems) {
        const bounds = img.parentElement.getBoundingClientRect();
        if (bounds.bottom < -200 || bounds.top > innerHeight + 200) continue;
        const offset = Math.max(-20, Math.min(20, (innerHeight / 2 - bounds.top - bounds.height / 2) * Number(img.dataset.parallax)));
        img.style.transform = `translateY(${offset}px)`;
      }
    }
  }
  function queueScroll() {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); }
  }
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', queueScroll, { passive: true });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      document.documentElement.classList.remove('motion-ready');
      parallaxItems.forEach(img => img.style.removeProperty('transform'));
    }
  });
  updateScroll();

  for (const viewer of document.querySelectorAll('.plan-viewer')) {
    const tabs = [...viewer.querySelectorAll('[role="tab"]')];
    function selectTab(tab, focus = false) {
      for (const item of tabs) {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
      }
      if (focus) tab.focus();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
        if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === 'Home') target = tabs[0];
        if (event.key === 'End') target = tabs.at(-1);
        if (target) { event.preventDefault(); selectTab(target, true); }
      });
    });
  }

  function renderArchive() {
    const grid = archive.querySelector('.archive-grid');
    const plates = catalog.filter(item => item.project === archiveProject && (archiveFilter === 'all' || item.type === archiveFilter));
    grid.replaceChildren();
    for (const item of plates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'archive-plate';
      button.dataset.lightbox = `${item.project}/${item.name}`;
      button.dataset.type = item.type;
      button.setAttribute('aria-label', `Enlarge ${item.title}`);
      const frame = document.createElement('span');
      frame.className = 'archive-plate-image';
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.note;
      img.width = item.width;
      img.height = item.height;
      img.loading = 'lazy';
      img.decoding = 'async';
      frame.append(img);
      const title = document.createElement('h3');
      title.textContent = item.title;
      const type = document.createElement('p');
      type.textContent = item.type === 'study' ? 'Process & study' : item.type === 'drawing' ? 'Architectural drawing' : 'Rendered space';
      button.append(frame, title, type);
      grid.append(button);
    }
    archive.querySelector('.archive-empty').hidden = plates.length !== 0;
    for (const filter of archive.querySelectorAll('[data-filter]')) {
      const key = filter.dataset.filter;
      const count = catalog.filter(item => item.project === archiveProject && (key === 'all' || key === item.type)).length;
      filter.setAttribute('aria-pressed', String(key === archiveFilter));
      filter.hidden = key !== 'all' && count === 0;
      if (key === 'all') filter.querySelector('span').textContent = String(count).padStart(2, '0');
    }
  }

  function openArchive(id) {
    const project = projects.find(item => item.id === id);
    if (!project) return;
    archiveProject = id;
    archiveFilter = 'all';
    archive.querySelector('#archive-title').textContent = project.title;
    archive.querySelector('#archive-eyebrow').textContent = `${project.number} / The complete project`;
    archive.querySelector('#archive-download').href = `assets/downloads/${id}.zip`;
    renderArchive();
    archive.showModal();
    archive.scrollTop = 0;
    syncModalState();
    archive.querySelector('[data-close-archive]').focus({ preventScroll: true });
  }

  function setZoom(value) {
    zoomed = value;
    imageScroll.classList.toggle('is-zoomed', value);
    const control = lightbox.querySelector('.lightbox-zoom');
    control.setAttribute('aria-pressed', String(value));
    control.replaceChildren(document.createTextNode(value ? 'Zoom out ' : 'Zoom in '));
    const symbol = document.createElement('span');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = value ? '−' : '+';
    control.append(symbol);
    imageScroll.scrollTop = 0;
    imageScroll.scrollLeft = 0;
  }

  function renderLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item) return;
    setZoom(false);
    largeImage.src = item.src;
    largeImage.alt = `${item.title}. ${item.note}`;
    const project = projects.find(p => p.id === item.project);
    lightbox.querySelector('.lightbox-project').textContent = `${project.number} / ${project.title}`;
    lightbox.querySelector('.lightbox-counter').textContent = `${String(lightboxIndex + 1).padStart(2, '0')} / ${String(lightboxItems.length).padStart(2, '0')}`;
    lightbox.querySelector('.lightbox-caption h3').textContent = item.title;
    lightbox.querySelector('.lightbox-caption p').textContent = item.note;
    const download = lightbox.querySelector('.lightbox-download');
    download.href = item.src;
    download.download = `${item.project}-${item.name}.png`;
    if (lightboxItems.length > 1) {
      const preload = new Image();
      preload.src = lightboxItems[(lightboxIndex + 1) % lightboxItems.length].src;
    }
  }

  function openLightbox(key, source) {
    const selected = catalog.find(item => `${item.project}/${item.name}` === key);
    if (!selected) return;
    lastFocusedImage = source;
    lightboxItems = catalog.filter(item => item.project === selected.project && (!archive.open || archiveFilter === 'all' || item.type === archiveFilter));
    lightboxIndex = lightboxItems.indexOf(selected);
    renderLightbox();
    lightbox.showModal();
    syncModalState();
    lightbox.querySelector('[data-close-lightbox]').focus({ preventScroll: true });
  }

  function stepImage(direction) {
    lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    renderLightbox();
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-archive],[data-lightbox],[data-filter]');
    if (!trigger) return;
    if (trigger.dataset.archive) openArchive(trigger.dataset.archive);
    else if (trigger.dataset.lightbox) openLightbox(trigger.dataset.lightbox, trigger);
    else if (trigger.dataset.filter) { archiveFilter = trigger.dataset.filter; renderArchive(); }
  });
  archive.querySelector('[data-close-archive]').addEventListener('click', () => archive.close());
  lightbox.querySelector('[data-close-lightbox]').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('.lightbox-prev').addEventListener('click', () => stepImage(-1));
  lightbox.querySelector('.lightbox-next').addEventListener('click', () => stepImage(1));
  lightbox.querySelector('.lightbox-zoom').addEventListener('click', () => setZoom(!zoomed));
  largeImage.addEventListener('click', () => setZoom(!zoomed));
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' && !zoomed) { event.preventDefault(); stepImage(-1); }
    if (event.key === 'ArrowRight' && !zoomed) { event.preventDefault(); stepImage(1); }
    if (event.key === '+' || event.key === '=') setZoom(true);
    if (event.key === '-') setZoom(false);
  });
  archive.addEventListener('close', syncModalState);
  lightbox.addEventListener('close', () => {
    syncModalState();
    if (lastFocusedImage?.isConnected) lastFocusedImage.focus({ preventScroll: true });
    largeImage.removeAttribute('src');
  });
  for (const dialog of [archive, lightbox]) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
  }
})();
