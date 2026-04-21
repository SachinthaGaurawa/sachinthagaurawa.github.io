/* Next-Level Portfolio JavaScript */

/* ===== CONFIG ===== */
const API_BASE = (window.__API_BASE__ || 'https://sachinthagaurawa-github-io.vercel.app').replace(/\/+$/, '');

console.log('[portfolio].js loaded, API_BASE =', API_BASE);

window.addEventListener('error', (e) => {
  console.error('[portfolio] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});

if (window.emailjs) {
  emailjs.init('Xl7XarHSSsPc7uaCF');
}

document.addEventListener('DOMContentLoaded', () => {
  initializePortfolio();
  startTypedDescription();
  initializeBackToTop();
  initializeDegreeVerification();
  trackPageVisit();
});

function initializePortfolio() {
  if (window.AOS) {
    AOS.init({
      duration: 1000,
      easing: 'ease-in-out',
      once: true,
      offset: 100
    });
  }

  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initializeSkillBars();
  initializeCounters();
  initializeContactForm();
  initializeDownloadVerification();
  initializeMathVerification();
  addScrollEffects();
  initializeParticleBackground();
}

function initializeBackToTop() {
  const backToTop = document.getElementById('backToTop');
  if (!backToTop) return;

  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('show', window.scrollY > 300);
  });

  backToTop.addEventListener('click', (e) => {
    e.preventDefault();
    smoothScrollToTop();
  });
}

function smoothScrollToTop() {
  const start = window.scrollY;
  const duration = 800;
  let startTime = null;

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function animateScroll(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutQuad(progress);
    window.scrollTo(0, start * (1 - eased));
    if (elapsed < duration) requestAnimationFrame(animateScroll);
  }

  requestAnimationFrame(animateScroll);
}

function initializeSkillBars() {
  const skillBars = document.querySelectorAll('.skill-bar');

  function animate() {
    skillBars.forEach(bar => {
      const rect = bar.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const width = bar.getAttribute('data-width');
        if (width) bar.style.width = width + '%';
      }
    });
  }

  window.addEventListener('scroll', animate);
  animate();
}

function initializeCounters() {
  const counters = document.querySelectorAll('.counter');

  function animate() {
    counters.forEach(counter => {
      const rect = counter.getBoundingClientRect();
      if (rect.top < window.innerHeight && !counter.classList.contains('animated')) {
        const target = parseInt(counter.getAttribute('data-target') || '0', 10);
        const increment = Math.max(target / 100, 1);
        let current = 0;

        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            counter.textContent = target;
            clearInterval(timer);
            counter.classList.add('animated');
          } else {
            counter.textContent = Math.floor(current);
          }
        }, 20);
      }
    });
  }

  window.addEventListener('scroll', animate);
  animate();
}

function initializeContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const userAnsEl = document.getElementById('mathAnswer');
    const correctAnsEl = document.getElementById('correctAnswer');

    if (!userAnsEl || !correctAnsEl) {
      showFormStatus('Form verification is not ready.', 'error');
      return;
    }

    const userAns = parseInt(userAnsEl.value, 10);
    const correctAns = parseInt(correctAnsEl.value, 10);

    if (userAns !== correctAns) {
      showFormStatus('Please solve the math problem correctly.', 'error');
      generateMathQuestion();
      return;
    }

    showFormStatus('Sending message...', 'loading');

    if (!window.emailjs) {
      showFormStatus('Email service unavailable.', 'error');
      return;
    }

    const fd = new FormData(form);
    const name = fd.get('name') || '';
    const email = fd.get('email') || '';
    const subject = fd.get('subject') || '';
    const message = fd.get('message') || '';

    emailjs.sendForm('service_thpmguh', 'template_m1n7xw5', form)
      .then(() => {
        trackPortfolioLead(name, email, subject, message);
        showFormStatus("✅ Message sent successfully! I'll get back to you soon.", 'success');
        form.reset();
        generateMathQuestion();
      })
      .catch((err) => {
        console.error('EmailJS error:', err);
        showFormStatus('❌ Failed to send message. Please try again or contact me directly.', 'error');
      });
  });
}

function showFormStatus(msg, type) {
  const status = document.getElementById('form-status');
  if (!status) return;
  status.textContent = msg;
  status.className = type;

  if (type === 'success') {
    setTimeout(() => {
      status.textContent = '';
      status.className = '';
    }, 5000);
  }
}

function initializeMathVerification() {
  generateMathQuestion();
}

function generateMathQuestion() {
  const qEl = document.getElementById('mathQuestion');
  const ansEl = document.getElementById('correctAnswer');
  const inputEl = document.getElementById('mathAnswer');
  if (!qEl || !ansEl || !inputEl) return;

  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;

  ansEl.value = a + b;
  inputEl.value = '';
  qEl.textContent = `${a} + ${b}`;
}

function initializeDownloadVerification() {
  const cvBtn = document.getElementById('downloadCV');
  if (cvBtn) {
    cvBtn.addEventListener('click', e => {
      e.preventDefault();
      trackPortfolioClick('Download CV');
      showCaptchaModal('cv');
    });
  }

  document.querySelectorAll('.download-research').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const paper = btn.dataset.paper;
      trackPortfolioClick(`Download Research: ${paper}`);
      showCaptchaModal(paper);
    });
  });

  document.querySelectorAll('.degree-verify-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      trackPortfolioClick('Verify Degree');
      trackDegreeClick();
      showCaptchaModal('degree');
    });
  });

  const verifyBtn = document.getElementById('verifyCaptcha');
  if (verifyBtn && !verifyBtn.dataset.bound) {
    verifyBtn.dataset.bound = '1';
    verifyBtn.addEventListener('click', verifyCaptchaAndRoute);
  }
}

function verifyCaptchaAndRoute() {
  const user = parseInt(document.getElementById('captchaInput')?.value || '0', 10);
  const correct = parseInt(document.getElementById('captchaAnswer')?.value || '0', 10);
  const type = document.getElementById('verifyCaptcha')?.dataset.download;

  if (user !== correct) {
    alert('Incorrect answer. Please try again.');
    return;
  }

  const modalEl = document.getElementById('captchaModal');
  if (modalEl && window.bootstrap) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }

  if (type === 'degree') {
    openDegreeVerificationTab();
    return;
  }

  triggerDownload(type);
}

function showCaptchaModal(type) {
  const modalEl = document.getElementById('captchaModal');
  if (!modalEl || !window.bootstrap) return;

  const modal = new bootstrap.Modal(modalEl);
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  const ans = op === '+' ? a + b : Math.abs(a - b);

  const mathEl = document.getElementById('captchaMath');
  const ansEl = document.getElementById('captchaAnswer');
  const inputEl = document.getElementById('captchaInput');
  const verifyBtn = document.getElementById('verifyCaptcha');

  if (!mathEl || !ansEl || !inputEl || !verifyBtn) return;

  mathEl.textContent = `${Math.max(a, b)} ${op} ${Math.min(a, b)} = ?`;
  ansEl.value = ans;
  inputEl.value = '';
  verifyBtn.dataset.download = type;
  modal.show();
}

async function triggerDownload(type) {
  const map = {
    cv: 'Sachintha_Gaurawa_CV.pdf',
    'av-safety-framework': 'AI_Enhanced_Predictive_Safety_Framework.pdf',
    'drone-disaster-response': 'AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
  };

  const filename = map[type];
  if (!filename) return;

  const url = `docs/${filename}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);

    trackPortfolioDownload(filename);
    showNotification('✅ Download started successfully!', 'success');
  } catch (err) {
    console.error('Download error:', err);
    showNotification('❌ Failed to download. Please try again.', 'error');
  }
}

function showNotification(message, type) {
  const notif = document.createElement('div');
  notif.className = `alert alert-${type} position-fixed`;
  notif.style.cssText = 'top:20px; right:20px; z-index:9999; animation:slideInRight .5s ease;';
  notif.innerHTML = `${message}<button class="btn-close" onclick="this.parentElement.remove()"></button>`;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 5000);
}

function addScrollEffects() {
  let last = 0;
  const nav = document.querySelector('.navbar');

  window.addEventListener('scroll', () => {
    const cur = window.scrollY;
    if (nav) nav.style.transform = cur > last && cur > 100 ? 'translateY(-100%)' : 'translateY(0)';
    last = cur;

    document.querySelectorAll('.circuit-line').forEach((el, i) => {
      const total = document.documentElement.scrollHeight - window.innerHeight || 1;
      el.style.animationDelay = `${i * 0.5 + (cur / total)}s`;
    });
  });
}

function initializeParticleBackground() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  Object.assign(canvas.style, {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '-1',
    opacity: '0.3'
  });

  document.body.appendChild(canvas);

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  const particles = [];
  for (let i = 0; i < 50; i++) particles.push(new Particle(canvas));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.update(canvas);
      p.draw(ctx);
    });

    particles.forEach((p, i) => {
      particles.slice(i + 1).forEach(q => {
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const d = Math.hypot(dx, dy);
        if (d < 100) {
          ctx.strokeStyle = `rgba(102,126,234,${1 - d / 100})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      });
    });

    requestAnimationFrame(animate);
  }

  animate();
}

class Particle {
  constructor(canvas) {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.size = Math.random() * 2 + 1;
  }

  update(canvas) {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
  }

  draw(ctx) {
    ctx.fillStyle = '#667eea';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function startTypedDescription() {
  const phrases = [
    'Electronic Engineer',
    'Robotics Specialist',
    'AI Safety Innovator',
    'Embedded Systems Expert',
    'Future Tech Pioneer'
  ];

  let idx = 0;
  let charIdx = 0;
  let forward = true;
  const el = document.getElementById('typing');
  if (!el) return;

  (function typeEffect() {
    const current = phrases[idx];
    el.textContent = current.substring(0, charIdx);

    if (forward) {
      if (charIdx < current.length) {
        charIdx++;
        setTimeout(typeEffect, 100);
      } else {
        forward = false;
        setTimeout(typeEffect, 2000);
      }
    } else {
      if (charIdx > 0) {
        charIdx--;
        setTimeout(typeEffect, 50);
      } else {
        forward = true;
        idx = (idx + 1) % phrases.length;
        setTimeout(typeEffect, 500);
      }
    }
  })();
}

function trackPortfolioLead(name, email, subject, message) {
  sendAnalytics({
    type: 'lead',
    name,
    email,
    subject,
    message,
    page: location.pathname + location.hash,
    referrer: document.referrer || ''
  });
}

function trackPortfolioClick(name) {
  sendAnalytics({
    type: 'click',
    name,
    page: location.pathname + location.hash,
    referrer: document.referrer || ''
  });
}

function trackPortfolioDownload(file) {
  sendAnalytics({
    type: 'download',
    file,
    page: location.pathname + location.hash,
    referrer: document.referrer || ''
  });
}

function trackDegreeClick() {
  sendAnalytics({
    type: 'degree_click',
    page: location.pathname + location.hash,
    referrer: document.referrer || ''
  });
}

function sendAnalytics(payload) {
  try {
    return fetch(`${API_BASE}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (e) {
    return Promise.resolve();
  }
}

function trackPageVisit() {
  sendAnalytics({
    type: 'visit',
    page: location.pathname + location.hash,
    referrer: document.referrer || '',
    title: document.title || ''
  });
}

function initializeDegreeVerification() {
  document.querySelectorAll('.degree-verify-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      trackPortfolioClick('Verify Degree');
      trackDegreeClick();
      showCaptchaModal('degree');
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const captchaInput = document.getElementById('captchaInput');
  const verifyButton = document.getElementById('verifyCaptcha');

  if (captchaInput && verifyButton) {
    captchaInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        verifyButton.click();
      }
    });
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const modalEl = document.getElementById('captchaModal');
  if (!modalEl) return;

  modalEl.addEventListener('hidden.bs.modal', function () {
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
  });
});

const styleTag = document.createElement('style');
styleTag.textContent = `
@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.back-to-top{display:none!important;position:fixed;right:30px;bottom:30px;width:50px;height:50px;font-size:1.2rem;align-items:center;justify-content:center;background:var(--primary-color);color:#fff}
.back-to-top.show{display:flex!important}
`;
document.head.appendChild(styleTag);
