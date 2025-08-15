/* Next-Level Portfolio JavaScript */



/* ====== CONFIG (ONE LINE only) ======
   For local dev (running server.js locally): 'http://localhost:8787'
*/
const API_BASE = (window.__API_BASE__ || 'https://sachinthagaurawa-github-io.vercel.app').replace(/\/+$/, '');

console.log('[portfolio] app.js loaded, API_BASE =', API_BASE);

// Show any uncaught errors so we don’t silently fail
window.addEventListener('error', (e) => {
  console.error('[portfolio] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});




// Initialize EmailJS SDK
emailjs.init("Xl7XarHSSsPc7uaCF");


// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializePortfolio();
    startTypedDescription();
    initializeBackToTop();
  });
  
  // Main initialization
  function initializePortfolio() {
    // AOS animations
    AOS.init({
      duration: 1000,
      easing: 'ease-in-out',
      once: true,
      offset: 100
    });
  
  
    // Set current year in footer
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
  
  // Back-to-top button
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
  
  // Skill bars animation
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
  
  // Counters animation
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
  
  // Contact form handling with EmailJS
  function initializeContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
  
    form.addEventListener('submit', function(e) {
      e.preventDefault();
  
      // Math CAPTCHA verification
      const userAns = +document.getElementById('mathAnswer').value;
      const correctAns = +document.getElementById('correctAnswer').value;
      if (userAns !== correctAns) {
        showFormStatus('Please solve the math problem correctly.', 'error');
        generateMathQuestion();
        return;
      }
  
      showFormStatus('Sending message...', 'loading');

      emailjs
        .sendForm('service_thpmguh', 'template_m1n7xw5', this)
        .then(() => {
          showFormStatus(
            "✅ Message sent successfully! I'll get back to you soon.",
            'success'
          );
          form.reset();
          generateMathQuestion();
        })
        .catch((err) => {
          console.error('EmailJS error:', err);
          showFormStatus(
            '❌ Failed to send message. Please try again or contact me directly.',
            'error'
          );
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
  
  // Math CAPTCHA setup
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
  
  // Download verification and triggering
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
    const verifyBtn = document.getElementById('verifyCaptcha');
    if (verifyBtn) verifyBtn.addEventListener('click', verifyCaptchaAndDownload);
  }
  
  function showCaptchaModal(type) {
    const modalEl = document.getElementById('captchaModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const op = Math.random() > 0.5 ? '+' : '-';
    const ans = op === '+' ? a + b : Math.abs(a - b);
    document.getElementById('captchaMath').textContent = `${op==='+'?Math.max(a,b):Math.max(a,b)} ${op} ${op==='+'?Math.min(a,b):Math.min(a,b)} = ?`;
    document.getElementById('captchaAnswer').value = ans;
    document.getElementById('captchaInput').value = '';
    document.getElementById('verifyCaptcha').dataset.download = type;
    modal.show();
  }
  
  function verifyCaptchaAndDownload() {
    const user = +document.getElementById('captchaInput').value;
    const correct = +document.getElementById('captchaAnswer').value;
    const type = document.getElementById('verifyCaptcha').dataset.download;
    if (user === correct) {
      bootstrap.Modal.getInstance(document.getElementById('captchaModal')).hide();
      triggerDownload(type);
    } else {
      alert('Incorrect answer. Please try again.');
    }
  }
  
async function triggerDownload(type) {
  const map = {
    cv: 'Sachintha_Gaurawa_CV.pdf',
    'av-safety-framework': 'AI_Enhanced_Predictive_Safety_Framework.pdf',
    'drone-disaster-response': 'AI_Driven_Disaster_Prediction_Drone_Swarm.pdf'
  };
  const filename = map[type] || 'document.pdf';
  const url = `docs/${filename}`;

  try {
    // Fetch the file as a blob
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();

    // Create a local URL for the blob and force download
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL
    window.URL.revokeObjectURL(blobUrl);

    showNotification('✅ Download started successfully!', 'success');
  } catch (err) {
    console.error('Download error:', err);
    showNotification('❌ Failed to download. Please try again.', 'error');
  }
}

  
  // Notification popup
  function showNotification(message, type) {
    const notif = document.createElement('div');
    notif.className = `alert alert-${type} position-fixed`;
    notif.style.cssText = 'top:20px; right:20px; z-index:9999; animation:slideInRight .5s ease;';
    notif.innerHTML = `${message}<button class="btn-close" onclick="this.parentElement.remove()"></button>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 5000);
  }
  
  // Navbar hide/show on scroll and tech-circuit animation tweak
  function addScrollEffects() {
    let last = 0;
    const nav = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
      const cur = window.scrollY;
      if (nav) nav.style.transform = cur > last && cur > 100 ? 'translateY(-100%)' : 'translateY(0)';
      last = cur;
      document.querySelectorAll('.circuit-line').forEach((el,i) => {
        el.style.animationDelay = `${i*0.5 + (cur/(document.documentElement.scrollHeight-window.innerHeight))}s`;
      });
    });
  }
  
  // Particle background
  function initializeParticleBackground() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    Object.assign(canvas.style, {
      position:'fixed',top:0,left:0,width:'100%',height:'100%',
      pointerEvents:'none',zIndex:-1,opacity:0.3
    });
    document.body.appendChild(canvas);
  
    function resize() { canvas.width=innerWidth; canvas.height=innerHeight; }
    window.addEventListener('resize', resize);
    resize();
  
    const particles = [];
    for (let i=0; i<50; i++) particles.push(new Particle(canvas,ctx));
  
    function animate() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      particles.forEach(p=>{
        p.update(canvas); p.draw(ctx);
      });
      // connect
      particles.forEach((p,i)=>{
        particles.slice(i+1).forEach(q=>{
          const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
          if(d<100){
            ctx.strokeStyle = `rgba(102,126,234,${1-d/100})`;
            ctx.lineWidth=0.5;
            ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
          }
        });
      });
      requestAnimationFrame(animate);
    }
    animate();
  }
  
  class Particle {
    constructor(canvas,ctx) {
      this.x=Math.random()*canvas.width;
      this.y=Math.random()*canvas.height;
      this.vx=(Math.random()-0.5)*0.5;
      this.vy=(Math.random()-0.5)*0.5;
      this.size=Math.random()*2+1;
    }
    update(canvas) {
      this.x+=this.vx; this.y+=this.vy;
      if(this.x<0||this.x>canvas.width) this.vx*=-1;
      if(this.y<0||this.y>canvas.height) this.vy*=-1;
    }
    draw(ctx) {
      ctx.fillStyle='#667eea';
      ctx.beginPath();
      ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
      ctx.fill();
    }
  }
  
  // Typing animation
  function startTypedDescription() {
    const phrases = [
      'Electronic Engineer',
      'Robotics Specialist',
      'AI Safety Innovator',
      'Embedded Systems Expert',
      'Future Tech Pioneer'
    ];
    let idx=0,charIdx=0,forward=true;
    const el=document.getElementById('typing');
    if(!el)return;
  
    (function typeEffect(){
      const current = phrases[idx];
      el.textContent = current.substring(0,charIdx);
      if(forward){
        if(charIdx<current.length){
          charIdx++; setTimeout(typeEffect,100);
        } else { forward=false; setTimeout(typeEffect,2000); }
      } else {
        if(charIdx>0){
          charIdx--; setTimeout(typeEffect,50);
        } else { forward=true; idx=(idx+1)%phrases.length; setTimeout(typeEffect,500); }
      }
    })();
  }
  
  // Smooth in-page link scrolling
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      e.preventDefault();
      const tgt=document.querySelector(a.getAttribute('href'));
      if(tgt) tgt.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });

  
  
  // CSS keyframes and back-to-top show rule
  const styleTag=document.createElement('style');
  styleTag.textContent=`
  @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
  .back-to-top{display:none!important;position:fixed;right:30px;bottom:30px;width:50px;height:50px;font-size:1.2rem;align-items:center;justify-content:center;background:var(--primary-color);color:#fff}
  .back-to-top.show{display:flex!important}
  `;
  document.head.appendChild(styleTag);
  
