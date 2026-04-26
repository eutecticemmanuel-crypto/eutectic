/**
 * ============================================
 * Cylin Painters - Dynamic Content Loader
 * Fetches site content from MongoDB and injects into DOM
 * ============================================
 */

(function () {
  async function loadContent() {
    try {
      const response = await fetch('/api/content');
      const result = await response.json();
      if (!result.success) return;

      const content = result.content;

      // Hero
      if (content.hero) {
        const heroTitle = document.querySelector('[data-content="hero.title"]');
        const heroSubtitle = document.querySelector('[data-content="hero.subtitle"]');
        const heroPrimary = document.querySelector('[data-content="hero.primaryButton"]');
        const heroSecondary = document.querySelector('[data-content="hero.secondaryButton"]');
        if (heroTitle) heroTitle.innerHTML = content.hero.title;
        if (heroSubtitle) heroSubtitle.textContent = content.hero.subtitle;
        if (heroPrimary) heroPrimary.textContent = content.hero.primaryButton;
        if (heroSecondary) heroSecondary.textContent = content.hero.secondaryButton;
      }

      // Services
      if (content.services) {
        const svcTag = document.querySelector('[data-content="services.tag"]');
        const svcTitle = document.querySelector('[data-content="services.title"]');
        const svcDesc = document.querySelector('[data-content="services.description"]');
        if (svcTag) svcTag.textContent = content.services.tag;
        if (svcTitle) svcTitle.textContent = content.services.title;
        if (svcDesc) svcDesc.textContent = content.services.description;

        const servicesGrid = document.querySelector('.services-grid');
        if (servicesGrid && content.services.items) {
          servicesGrid.innerHTML = content.services.items.map(item => `
            <div class="service-card">
              <div class="service-icon">
                <i class="fas ${item.icon}"></i>
              </div>
              <h3>${item.title}</h3>
              <p>${item.description}</p>
            </div>
          `).join('');
        }
      }

      // Gallery
      if (content.gallery) {
        const galTag = document.querySelector('[data-content="gallery.tag"]');
        const galTitle = document.querySelector('[data-content="gallery.title"]');
        const galDesc = document.querySelector('[data-content="gallery.description"]');
        if (galTag) galTag.textContent = content.gallery.tag;
        if (galTitle) galTitle.textContent = content.gallery.title;
        if (galDesc) galDesc.textContent = content.gallery.description;

        const galleryGrid = document.querySelector('.gallery-grid');
        if (galleryGrid && content.gallery.items) {
          galleryGrid.innerHTML = content.gallery.items.map((item, index) => `
            <div class="gallery-item" data-index="${index}">
              <img src="${item.src}" alt="${item.title}" loading="lazy">
              <div class="gallery-overlay">
                <span class="gallery-title">${item.title}</span>
                <span class="gallery-category">${item.category}</span>
              </div>
            </div>
          `).join('');
        }
      }

      // About
      if (content.about) {
        const aboutTag = document.querySelector('[data-content="about.tag"]');
        const aboutTitle = document.querySelector('[data-content="about.title"]');
        const aboutImage = document.querySelector('[data-content="about.image"]');
        const aboutExpNum = document.querySelector('[data-content="about.experience.number"]');
        const aboutExpText = document.querySelector('[data-content="about.experience.text"]');

        if (aboutTag) aboutTag.textContent = content.about.tag;
        if (aboutTitle) aboutTitle.textContent = content.about.title;
        if (aboutImage) aboutImage.src = content.about.image;
        if (aboutExpNum) aboutExpNum.textContent = content.about.experience.number;
        if (aboutExpText) aboutExpText.innerHTML = content.about.experience.text;

        const aboutContent = document.querySelector('.about-content');
        if (aboutContent) {
          const paragraphs = aboutContent.querySelectorAll('p');
          if (paragraphs[0]) paragraphs[0].textContent = content.about.description;
          if (paragraphs[1]) paragraphs[1].textContent = content.about.description2;

          const featuresContainer = aboutContent.querySelector('.about-features');
          if (featuresContainer && content.about.features) {
            featuresContainer.innerHTML = content.about.features.map(f => `
              <div class="feature">
                <i class="fas fa-check-circle"></i>
                <span>${f}</span>
              </div>
            `).join('');
          }
        }
      }

      // Stats
      if (content.stats && content.stats.items) {
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
          statsGrid.innerHTML = content.stats.items.map(item => `
            <div class="stat-item">
              <span class="stat-number" data-target="${item.number}">0</span>
              <span class="stat-label">${item.label}</span>
            </div>
          `).join('');
        }
      }

      // Contact
      if (content.contact) {
        const contactTag = document.querySelector('[data-content="contact.tag"]');
        const contactTitle = document.querySelector('[data-content="contact.title"]');
        const contactDesc = document.querySelector('[data-content="contact.description"]');
        if (contactTag) contactTag.textContent = content.contact.tag;
        if (contactTitle) contactTitle.textContent = content.contact.title;
        if (contactDesc) contactDesc.textContent = content.contact.description;

        const infoCards = document.querySelectorAll('.info-card .info-content p');
        if (infoCards[0] && content.contact.info.address) infoCards[0].innerHTML = content.contact.info.address.replace(/\n/g, '<br>');
        if (infoCards[1] && content.contact.info.phone) infoCards[1].innerHTML = content.contact.info.phone.replace(/\n/g, '<br>');
        if (infoCards[2] && content.contact.info.email) infoCards[2].innerHTML = content.contact.info.email.replace(/\n/g, '<br>');
      }

      // Footer
      if (content.footer) {
        const footerDesc = document.querySelector('[data-content="footer.description"]');
        const footerCopy = document.querySelector('[data-content="footer.copyright"]');
        if (footerDesc) footerDesc.textContent = content.footer.description;
        if (footerCopy) footerCopy.textContent = content.footer.copyright;
      }

      // Re-attach gallery lightbox events after dynamic injection
      if (typeof window.attachLightboxEvents === 'function') {
        window.attachLightboxEvents();
      }

    } catch (err) {
      console.error('Error loading content:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadContent);
})();
