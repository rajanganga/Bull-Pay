// ====== Mobile Menu ======
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
  });
}

// ====== Animated Counter ======
function animateCounter(el, target, duration = 1800) {
  const start = 0;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    const value = Math.floor(start + (target - start) * eased);
    el.textContent = value.toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ====== IntersectionObserver for stats ======
const counters = document.querySelectorAll('.counter[data-target]');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = +entry.target.dataset.target;
      animateCounter(entry.target, target);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });
counters.forEach(c => observer.observe(c));

// ====== Balance card counter (demo) ======
const balanceValue = document.getElementById('balanceValue');
if (balanceValue) {
  // ⚠️ YE DEMO VALUE HAI — aapke backend se fetch karke replace karein
  const demoBalance = 24580;
  setTimeout(() => animateCounter(balanceValue, demoBalance), 400);
}

// ====== Card tilt effect on mouse move ======
const card = document.getElementById('balanceCard');
if (card && window.matchMedia('(min-width: 768px)').matches) {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}

// ====== Reveal on scroll ======
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.feature-card, .stat-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  revealObserver.observe(el);
});
