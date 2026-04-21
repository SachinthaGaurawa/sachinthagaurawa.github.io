/* Next-Level Portfolio JavaScript */

const API_BASE = (window.__API_BASE__ || 'https://admin.sachinthagaurawa.vercel.app').replace(/\/+$/, '');
console.log('[portfolio].js loaded, API_BASE =', API_BASE);

window.addEventListener('error', (e) => {
  console.error('[portfolio] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});

if (window.emailjs && typeof emailjs.init === 'function') {
  emailjs.init('Xl7XarHSSsPc7uaCF');
}

let contactMathReady = false;
let downloadCaptchaBound = false;
let degreeBound = false;

function initializePortfolio() {
  if (window.AOS && typeof AOS.init === 'function') {
    AOS.init({ duration: 1000, easing: 'ease-in-out', once: true, offset: 100 });
  }

  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initializeSkillBars();
  initializeCounters();
  initializeContactForm();
  initializeDownloadVerification();
  initializeMathVerification();
  initializeDegreeVerification();
  addScrollEffects();
  initializeParticleBackground();
  setupSmoothAnchors();
}

document.addEventListener('DOMContentLoaded', function() {
  initializePortfolio();
  startTypedDescription();
  initializeBackToTop();
});

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
        bar.style.width = width + '%';
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
        const target = +counter.getAttribute('data-target');
        const increment = target / 100;
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

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const name = document.getElementById('name')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const subject = document.getElementById('subject')?.value.trim() || '';
    const message = document.getElementById('message')?.value.trim() || '';

    const userAns = +document.getElementById('mathAnswer').value;
    const correctAns = +document.getElementById('correctAnswer').value;
    if (userAns !== correctAns) {
      showFormStatus('Please solve the math problem correctly.', 'error');
      generateMathQuestion();
      return;
    }

    showFormStatus('Sending message...', 'loading');

    try {
      await sendLeadToDashboard(name, email, subject, message);

      if (window.emailjs && typeof emailjs.sendForm === 'function') {
        await emailjs.sendForm('service_thpmguh', 'template_m1n7xw5', form);
      }

      showFormStatus("✅ Message sent successfully! I'll get back to you soon.", 'success');
      form.reset();
      generateMathQuestion();
    } catch (err) {
      console.error('Contact form error:', err);
      showFormStatus('❌ Failed to send message. Please try again or contact me directly.', 'error');
      generateMathQuestion();
    }
  });
}

async function sendLeadToDashboard(name, email, subject, message) {
  try {
    await fetch(API_BASE + '/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
        page: location.pathname + location.hash,
        referrer: document.referrer || ''
      })
    });
  } catch (e) {}
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
  if (contactMathReady) return;
  contactMathReady = true;
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
  if (cvBtn) cvBtn.addEventListener('click', e => {
    e.preventDefault();
    showCaptchaModal('cv');
  });

  document.querySelectorAll('.download-research').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showCaptchaModal(btn.dataset.paper);
    });
  });

  if (downloadCaptchaBound) return;
  const verifyBtn = document.getElementById('verifyCaptcha');
  if (verifyBtn) {
    downloadCaptchaBound = true;
    verifyBtn.addEventListener('click', verifyCaptchaAndRoute);
  }
}

function initializeDegreeVerification() {
  if (degreeBound) return;
  degreeBound = true;
  document.querySelectorAll('.degree-verify-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showCaptchaModal('degree');
    });
  });
}

function showCaptchaModal(type) {
  const modalEl = document.getElementById('captchaModal');
  if (!modalEl) return;

  const modal = new bootstrap.Modal(modalEl);
  const add = Math.random() > 0.5;
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const x = Math.max(a, b);
  const y = Math.min(a, b);
  const ans = add ? x + y : x - y;

  const qEl = document.getElementById('captchaMath');
  if (qEl) qEl.textContent = `${x} ${add ? '+' : '-'} ${y} = ?`;

  const ansEl = document.getElementById('captchaAnswer');
  const inputEl = document.getElementById('captchaInput');
  const verifyBtn = document.getElementById('verifyCaptcha');
  if (ansEl) ansEl.value = ans;
  if (inputEl) inputEl.value = '';
  if (verifyBtn) verifyBtn.dataset.download = type;

  modal.show();
}

function verifyCaptchaAndRoute() {
  const inputEl = document.getElementById('captchaInput');
  const ansEl = document.getElementById('captchaAnswer');
  const verifyBtn = document.getElementById('verifyCaptcha');
  if (!inputEl || !ansEl || !verifyBtn) return;

  const user = +inputEl.value;
  const correct = +ansEl.value;
  const type = verifyBtn.dataset.download;

  if (user !== correct) {
    alert('Incorrect answer. Please try again.');
    return;
  }

  const modalEl = document.getElementById('captchaModal');
  if (modalEl) {
    const instance = bootstrap.Modal.getInstance(modalEl);
    if (instance) instance.hide();
  }

  if (type === 'degree') {
    trackDegreeClick();
    openDegreeVerificationTab();
    return;
  }

  if (type) {
    triggerDownload(type);
  }
}

function openDegreeVerificationTab() {
  const url = 'https://dcveri.greatermanchester.ac.uk/?reference=17526070-01-W441';
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
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
    await trackDownload(filename);

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
    showNotification('✅ Download started successfully!', 'success');
  } catch (err) {
    console.error('Download error:', err);
    showNotification('❌ Failed to download. Please try again.', 'error');
  }
}

async function trackDownload(filename) {
  try {
    await fetch(API_BASE + '/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'download',
        file: filename,
        page: location.pathname + location.hash,
        referrer: document.referrer || '',
        sessionId: sessionStorage.getItem('portfolio_session_id') || ''
      })
    });
  } catch (e) {}
}

function trackDegreeClick() {
  try {
    fetch(API_BASE + '/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'degree_click',
        name: 'Verify Degree',
        page: location.pathname + location.hash,
        referrer: document.referrer || '',
        sessionId: sessionStorage.getItem('portfolio_session_id') || ''
      })
    });
  } catch (e) {}
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
    document.querySelectorAll('.circuit-line').forEach((el,i) => {
      const h = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      el.style.animationDelay = `${i*0.5 + (cur/h)}s`;
    });
  });
}

function initializeParticleBackground() {
  if (document.getElementById('particleCanvas')) return;
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  const ctx = canvas.getContext('2d');
  Object.assign(canvas.style, {
    position:'fixed',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:'-1',opacity:'0.3'
  });
  document.body.appendChild(canvas);

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const particles = [];
  for (let i=0; i<50; i++) particles.push(new Particle(canvas));

  function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => { p.update(canvas); p.draw(ctx); });
    particles.forEach((p,i) => {
      particles.slice(i+1).forEach(q => {
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
        if (d < 100) {
          ctx.strokeStyle = `rgba(102,126,234,${1 - d/100})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x,p.y);
          ctx.lineTo(q.x,q.y);
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
  const phrases = ['Electronic Engineer', 'Robotics Specialist', 'AI Safety Innovator', 'Embedded Systems Expert', 'Future Tech Pioneer'];
  let idx = 0, charIdx = 0, forward = true;
  const el = document.getElementById('typing') || document.querySelector('.typed-text-output');
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

function setupSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const tgt = document.querySelector(a.getAttribute('href'));
      if (tgt) tgt.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

const styleTag = document.createElement('style');
styleTag.textContent = `
@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.back-to-top{display:none!important;position:fixed;right:30px;bottom:30px;width:50px;height:50px;font-size:1.2rem;align-items:center;justify-content:center;color:#fff}
.back-to-top.show{display:flex!important}
`;
document.head.appendChild(styleTag);

const modalCleanup = document.getElementById('captchaModal');
if (modalCleanup) {
  modalCleanup.addEventListener('hidden.bs.modal', function () {
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const captchaInput = document.getElementById('captchaInput');
  const verifyButton = document.getElementById('verifyCaptcha');
  if (captchaInput && verifyButton) {
    captchaInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        verifyButton.click();
      }
    });
  }
});
