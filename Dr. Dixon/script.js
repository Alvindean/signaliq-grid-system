/* ============================================
   Dr. Anthony E. Dixon — Site JavaScript
   profaedixon.com — Cinematic Build
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile Hamburger Menu ---
  const hamburger = document.getElementById('hamburger');
  const navDrawer = document.getElementById('nav-drawer');
  if (hamburger && navDrawer) {
    hamburger.addEventListener('click', () => {
      navDrawer.classList.toggle('open');
      hamburger.textContent = navDrawer.classList.contains('open') ? '\u2715' : '\u2630';
      hamburger.setAttribute('aria-expanded', navDrawer.classList.contains('open'));
    });
    navDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navDrawer.classList.remove('open');
        hamburger.textContent = '\u2630';
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // --- FAQ Accordion ---
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        item.classList.toggle('open');
      });
    }
  });

  // --- Scroll Reveal (IntersectionObserver) ---
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-up, .reveal-top, .gold-line, .fade-in').forEach(el => {
      observer.observe(el);
    });
  }

  // --- Nav Background on Scroll ---
  const nav = document.querySelector('.site-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.background = window.scrollY > 50
        ? 'rgba(13,10,4,0.95)'
        : 'rgba(13,10,4,0.85)';
    }, { passive: true });
  }

  // --- Smooth Scroll for Anchor Links ---
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href && href !== '#') {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // --- Active Nav Link ---
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && !href.startsWith('#') && (href === currentPage || href === './' + currentPage)) {
      link.classList.add('active');
    }
  });

});
