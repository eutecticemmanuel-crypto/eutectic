/**
 * Admin Dashboard
 */

let siteContent = {};
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Auth check
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.success) {
      window.location.href = 'index.html';
      return;
    }
    currentUser = data.user;
    document.getElementById('adminUsername').textContent = currentUser.username;
  } catch {
    window.location.href = 'index.html';
    return;
  }

  // Load content
  await loadContent();

  // Sidebar navigation
  document.querySelectorAll('.sidebar-nav a').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      showSection(section);
      document.querySelectorAll('.sidebar-nav a').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'index.html';
  });

  // Load contacts
  loadContacts();
});

async function loadContent() {
  try {
    const res = await fetch('/api/content');
    const data = await res.json();
    if (data.success) {
      siteContent = data.content;
      populateAllForms();
      updateOverviewStats();
    }
  } catch (err) {
    showMessage('Failed to load content.', 'error');
  }
}

function populateAllForms() {
  // Hero
  if (siteContent.hero) {
    document.getElementById('hero-title').value = siteContent.hero.title || '';
    document.getElementById('hero-subtitle').value = siteContent.hero.subtitle || '';
    document.getElementById('hero-primaryButton').value = siteContent.hero.primaryButton || '';
    document.getElementById('hero-secondaryButton').value = siteContent.hero.secondaryButton || '';
  }

  // Services
  if (siteContent.services) {
    document.getElementById('services-tag').value = siteContent.services.tag || '';
    document.getElementById('services-title').value = siteContent.services.title || '';
    document.getElementById('services-description').value = siteContent.services.description || '';
    renderItemsEditor('services-items', siteContent.services.items || [], 'services');
  }

  // Gallery
  if (siteContent.gallery) {
    document.getElementById('gallery-tag').value = siteContent.gallery.tag || '';
    document.getElementById('gallery-title').value = siteContent.gallery.title || '';
    document.getElementById('gallery-description').value = siteContent.gallery.description || '';
    renderItemsEditor('gallery-items', siteContent.gallery.items || [], 'gallery');
  }

  // About
  if (siteContent.about) {
    document.getElementById('about-tag').value = siteContent.about.tag || '';
    document.getElementById('about-title').value = siteContent.about.title || '';
    document.getElementById('about-description').value = siteContent.about.description || '';
    document.getElementById('about-description2').value = siteContent.about.description2 || '';
    document.getElementById('about-image').value = siteContent.about.image || '';
    document.getElementById('about-experience-number').value = siteContent.about.experience?.number || '';
    document.getElementById('about-experience-text').value = siteContent.about.experience?.text || '';
    renderFeaturesEditor();
  }

  // Stats
  if (siteContent.stats) {
    renderStatsEditor();
  }

  // Contact
  if (siteContent.contact) {
    document.getElementById('contact-tag').value = siteContent.contact.tag || '';
    document.getElementById('contact-title').value = siteContent.contact.title || '';
    document.getElementById('contact-description').value = siteContent.contact.description || '';
    document.getElementById('contact-address').value = siteContent.contact.info?.address || '';
    document.getElementById('contact-phone').value = siteContent.contact.info?.phone || '';
    document.getElementById('contact-email').value = siteContent.contact.info?.email || '';
  }

  // Footer
  if (siteContent.footer) {
    document.getElementById('footer-description').value = siteContent.footer.description || '';
    document.getElementById('footer-copyright').value = siteContent.footer.copyright || '';
  }
}

function renderItemsEditor(containerId, items, section) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <label style="margin:0;font-weight:600;">Items</label>
      <button type="button" class="btn btn-outline btn-sm" onclick="addItem('${section}')">
        <i class="fas fa-plus"></i> Add Item
      </button>
    </div>
    <div class="item-list" id="${containerId}-list">
      ${items.map((item, i) => renderItemCard(section, i, item)).join('')}
    </div>
  `;
}

function renderItemCard(section, index, item) {
  if (section === 'services') {
    return `
      <div class="item-card" data-index="${index}">
        <div class="item-card-header">
          <h4>Service #${index + 1}</h4>
          <button type="button" class="btn btn-danger btn-sm" onclick="removeItem('services', ${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="item-card-grid">
          <div class="form-group"><label>Icon Class</label><input type="text" class="svc-icon" value="${item.icon || ''}" placeholder="fa-home"></div>
          <div class="form-group"><label>Title</label><input type="text" class="svc-title" value="${item.title || ''}"></div>
          <div class="form-group"><label>Description</label><textarea class="svc-desc" rows="3">${item.description || ''}</textarea></div>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="item-card" data-index="${index}">
        <div class="item-card-header">
          <h4>Gallery Item #${index + 1}</h4>
          <button type="button" class="btn btn-danger btn-sm" onclick="removeItem('gallery', ${index})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="item-card-grid">
          <div class="form-group"><label>Image URL</label><input type="text" class="gal-src" value="${item.src || ''}"></div>
          <div class="form-group"><label>Title</label><input type="text" class="gal-title" value="${item.title || ''}"></div>
          <div class="form-group"><label>Category</label><input type="text" class="gal-category" value="${item.category || ''}"></div>
        </div>
      </div>
    `;
  }
}

function renderFeaturesEditor() {
  const container = document.getElementById('about-features');
  const features = siteContent.about?.features || [];
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <label style="margin:0;font-weight:600;">Features</label>
      <button type="button" class="btn btn-outline btn-sm" onclick="addFeature()">
        <i class="fas fa-plus"></i> Add Feature
      </button>
    </div>
    <div class="item-list">
      ${features.map((f, i) => `
        <div class="item-card" data-index="${i}">
          <div class="item-card-header">
            <h4>Feature #${i + 1}</h4>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeFeature(${i})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="form-group"><input type="text" class="about-feature" value="${f}"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderStatsEditor() {
  const container = document.getElementById('stats-items');
  const items = siteContent.stats?.items || [];
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <label style="margin:0;font-weight:600;">Stats</label>
      <button type="button" class="btn btn-outline btn-sm" onclick="addStat()">
        <i class="fas fa-plus"></i> Add Stat
      </button>
    </div>
    <div class="item-list">
      ${items.map((s, i) => `
        <div class="item-card" data-index="${i}">
          <div class="item-card-header">
            <h4>Stat #${i + 1}</h4>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeStat(${i})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="item-card-grid">
            <div class="form-group"><label>Number</label><input type="number" class="stat-number" value="${s.number || 0}"></div>
            <div class="form-group"><label>Label</label><input type="text" class="stat-label" value="${s.label || ''}"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function addItem(section) {
  const items = siteContent[section]?.items || [];
  if (section === 'services') {
    items.push({ icon: 'fa-home', title: 'New Service', description: 'Description here' });
  } else {
    items.push({ src: '', title: 'New Item', category: 'Interior' });
  }
  siteContent[section].items = items;
  renderItemsEditor(section + '-items', items, section);
}

function removeItem(section, index) {
  siteContent[section].items.splice(index, 1);
  renderItemsEditor(section + '-items', siteContent[section].items, section);
}

function addFeature() {
  siteContent.about.features.push('New Feature');
  renderFeaturesEditor();
}

function removeFeature(index) {
  siteContent.about.features.splice(index, 1);
  renderFeaturesEditor();
}

function addStat() {
  siteContent.stats.items.push({ number: 0, label: 'New Stat' });
  renderStatsEditor();
}

function removeStat(index) {
  siteContent.stats.items.splice(index, 1);
  renderStatsEditor();
}

function showSection(section) {
  document.querySelectorAll('.section-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('panel-' + section).classList.add('active');

  const titles = {
    overview: 'Dashboard Overview',
    contacts: 'Contact Submissions',
    hero: 'Edit Hero Section',
    services: 'Edit Services Section',
    gallery: 'Edit Gallery Section',
    about: 'Edit About Section',
    stats: 'Edit Stats Section',
    contact: 'Edit Contact Info',
    footer: 'Edit Footer',
  };
  document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
}

function updateOverviewStats() {
  const contacts = siteContent.contacts?.length || 0;
  const services = siteContent.services?.items?.length || 0;
  const gallery = siteContent.gallery?.items?.length || 0;
  const stats = siteContent.stats?.items?.length || 0;

  document.getElementById('statContacts').textContent = contacts;
  document.getElementById('statServices').textContent = services;
  document.getElementById('statGallery').textContent = gallery;
  document.getElementById('statStats').textContent = stats;
}

async function saveSection(section) {
  let payload = {};

  if (section === 'hero') {
    payload = {
      title: document.getElementById('hero-title').value,
      subtitle: document.getElementById('hero-subtitle').value,
      primaryButton: document.getElementById('hero-primaryButton').value,
      secondaryButton: document.getElementById('hero-secondaryButton').value,
    };
  } else if (section === 'services') {
    const items = [];
    document.querySelectorAll('#services-items-list .item-card').forEach((card) => {
      items.push({
        icon: card.querySelector('.svc-icon').value,
        title: card.querySelector('.svc-title').value,
        description: card.querySelector('.svc-desc').value,
      });
    });
    payload = {
      tag: document.getElementById('services-tag').value,
      title: document.getElementById('services-title').value,
      description: document.getElementById('services-description').value,
      items,
    };
  } else if (section === 'gallery') {
    const items = [];
    document.querySelectorAll('#gallery-items-list .item-card').forEach((card) => {
      items.push({
        src: card.querySelector('.gal-src').value,
        title: card.querySelector('.gal-title').value,
        category: card.querySelector('.gal-category').value,
      });
    });
    payload = {
      tag: document.getElementById('gallery-tag').value,
      title: document.getElementById('gallery-title').value,
      description: document.getElementById('gallery-description').value,
      items,
    };
  } else if (section === 'about') {
    const features = [];
    document.querySelectorAll('#about-features .about-feature').forEach((input) => {
      features.push(input.value);
    });
    payload = {
      tag: document.getElementById('about-tag').value,
      title: document.getElementById('about-title').value,
      description: document.getElementById('about-description').value,
      description2: document.getElementById('about-description2').value,
      image: document.getElementById('about-image').value,
      experience: {
        number: document.getElementById('about-experience-number').value,
        text: document.getElementById('about-experience-text').value,
      },
      features,
    };
  } else if (section === 'stats') {
    const items = [];
    document.querySelectorAll('#stats-items .item-card').forEach((card) => {
      items.push({
        number: parseInt(card.querySelector('.stat-number').value) || 0,
        label: card.querySelector('.stat-label').value,
      });
    });
    payload = { items };
  } else if (section === 'contact') {
    payload = {
      tag: document.getElementById('contact-tag').value,
      title: document.getElementById('contact-title').value,
      description: document.getElementById('contact-description').value,
      info: {
        address: document.getElementById('contact-address').value,
        phone: document.getElementById('contact-phone').value,
        email: document.getElementById('contact-email').value,
      },
    };
  } else if (section === 'footer') {
    payload = {
      description: document.getElementById('footer-description').value,
      copyright: document.getElementById('footer-copyright').value,
    };
  }

  try {
    const res = await fetch('/api/content/' + section, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      siteContent[section] = payload;
      updateOverviewStats();
      showMessage('Changes saved successfully!', 'success');
    } else {
      showMessage(data.error || 'Failed to save.', 'error');
    }
  } catch {
    showMessage('Connection error.', 'error');
  }
}

async function loadContacts() {
  try {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    const tbody = document.querySelector('#contactsTable tbody');
    const empty = document.getElementById('contactsEmpty');

    if (data.success && data.contacts.length > 0) {
      tbody.innerHTML = data.contacts.map((c) => `
        <tr data-id="${c._id}">
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(c.email)}</td>
          <td>${escapeHtml(c.phone || '-')}</td>
          <td>${escapeHtml(c.service || '-')}</td>
          <td>${escapeHtml(c.message)}</td>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td><button class="btn btn-danger btn-sm" onclick="deleteContact('${c._id}')"><i class="fas fa-trash"></i></button></td>
        </tr>
      `).join('');
      document.getElementById('contactsTable').style.display = 'table';
      empty.style.display = 'none';
    } else {
      document.getElementById('contactsTable').style.display = 'none';
      empty.style.display = 'block';
    }
  } catch {
    showMessage('Failed to load contacts.', 'error');
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to delete this contact?')) return;
  try {
    const res = await fetch('/api/contacts/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadContacts();
      showMessage('Contact deleted.', 'success');
    } else {
      showMessage(data.error || 'Failed to delete.', 'error');
    }
  } catch {
    showMessage('Connection error.', 'error');
  }
}

function showMessage(text, type) {
  const msg = document.getElementById('globalMessage');
  msg.textContent = text;
  msg.className = 'message show ' + type;
  setTimeout(() => {
    msg.className = 'message';
    msg.textContent = '';
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

