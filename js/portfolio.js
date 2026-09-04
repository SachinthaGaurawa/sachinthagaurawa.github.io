/* Next-Level Portfolio JavaScript */

/* ====== CONFIG (ONE LINE only) ======
   For local dev (running server.js locally): 'http://localhost:8787'
*/
const API_BASE = (window.__API_BASE__ || 'https://sachinthagaurawa-github-io.vercel.app').replace(/\/+$/, '');

console.log('[portfolio].js loaded, API_BASE =', API_BASE);

// Show any uncaught errors so we don’t silently fail
window.addEventListener('error', (e) => {
  console.error('[portfolio] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});

// Contact-form CAPTCHA answer. Deliberately kept out of the DOM so it
// cannot simply be read off the page the way a hidden input can.
let contactCaptchaAnswer = null;

// Initialize EmailJS SDK
emailjs.init("Xl7XarHSSsPc7uaCF");

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializePortfolio();
  startTypedDescription();
  initializeBackToTop();
  initializeDegreeVerification();
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
  
      // Honeypot: real people never fill a field they cannot see.
      const trap = document.getElementById('website');
      if (trap && trap.value.trim() !== '') return;

      // Math CAPTCHA verification. The expected answer lives only in this
      // closure, so it is not readable from the DOM the way a hidden input is.
      const userAns = Number(document.getElementById('mathAnswer').value);
      if (contactCaptchaAnswer === null || userAns !== contactCaptchaAnswer) {
        showFormStatus('Please solve the math problem correctly.', 'error');
        generateMathQuestion();
        return;
      }
  
      showFormStatus('Sending message...', 'loading');

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      // sendForm() posts every named field, so the honeypot was travelling to
      // EmailJS and the template's {{from_name}}/{{from_email}} were always empty,
      // because the inputs are named "name" and "email". An explicit object
      // fixes both: the honeypot stays on the page, and every value is supplied
      // under both naming conventions so the dashboard fields and the email
      // body agree.
      const fieldValue = id => (document.getElementById(id)?.value || '').trim();
      const payload = {
        name:       fieldValue('name'),
        email:      fieldValue('email'),
        subject:    fieldValue('subject'),
        message:    fieldValue('message'),
        from_name:  fieldValue('name'),
        from_email: fieldValue('email'),
        reply_to:   fieldValue('email'),
        time:       new Date().toLocaleString()
      };

      emailjs
        .send('service_thpmguh', 'template_m1n7xw5', payload)
        .then(() => {
          showFormStatus("✅ Message sent successfully! I'll get back to you soon.", 'success');
          form.reset();
          generateMathQuestion();
        })
        .catch(err => {
          // The provider's own wording ("Gmail_API: Invalid grant", a 412, a
          // quota message) is for the console, not for a visitor: it reads as
          // a broken site and exposes how the mailbox is wired up.
          console.error('EmailJS error:', err);
          showFormStatus(
            "Sorry \u2014 the message couldn't be sent right now.",
            'error',
            buildMailtoFallback(payload)
          );
        })
        .finally(() => { if (submitBtn) submitBtn.disabled = false; });
    });
  }
  
  function showFormStatus(msg, type, actionEl) {
    const status = document.getElementById('form-status');
    if (!status) return;
    status.textContent = msg;
    // keep the element's own spacing class; assigning className alone dropped it
    status.className = 'mt-3 ' + type;
    if (actionEl) status.appendChild(actionEl);
    if (type === 'success') {
      setTimeout(() => {
        status.textContent = '';
        status.className = 'mt-3';
      }, 5000);
    }
  }

  // When the mail provider is down the visitor should still be able to reach
  // the inbox, so hand them their own message pre-filled in their mail app
  // rather than asking them to retype it. Built with DOM nodes and
  // encodeURIComponent so nothing typed into the form can become markup.
  const CONTACT_ADDRESS = 'gaurawasachintha@gmail.com';

  function buildMailtoFallback(payload) {
    const body =
      'From: ' + payload.name + ' <' + payload.email + '>\n\n' + payload.message;
    // Mail clients drop very long mailto URLs; keep the link inside a safe budget.
    const trimmed = body.length > 1500 ? body.slice(0, 1500) + '\n\n[...]' : body;
    const href =
      'mailto:' + CONTACT_ADDRESS +
      '?subject=' + encodeURIComponent(payload.subject || 'Portfolio enquiry') +
      '&body='    + encodeURIComponent(trimmed);

    const wrap = document.createElement('div');
    wrap.className = 'mt-2';

    const link = document.createElement('a');
    link.href = href;
    link.className = 'btn btn-primary btn-sm';
    link.textContent = 'Send it from your email app';
    wrap.appendChild(link);

    const note = document.createElement('div');
    note.className = 'mt-2 small';
    note.textContent = 'Your message is filled in already \u2014 just press send. Or write to ' + CONTACT_ADDRESS + '.';
    wrap.appendChild(note);

    return wrap;
  }
  
  // Math CAPTCHA setup
  function initializeMathVerification() {
    generateMathQuestion();
  }
  
  function generateMathQuestion() {
    const qEl = document.getElementById('mathQuestion');
    const inputEl = document.getElementById('mathAnswer');
    if (!qEl || !inputEl) return;
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    contactCaptchaAnswer = a + b;
    inputEl.value = '';
    qEl.textContent = `${a} + ${b}`;
  }

  
function initializeDownloadVerification() {
  // #downloadCV, .download-research and #verifyCaptcha are all bound by the
  // inline script in index.html. Binding them here as well ran two captcha
  // implementations per click: the second overwrote the first question and
  // left a second Modal instance behind, which threw on dispose.
  // .degree-verify-btn is bound in initializeDegreeVerification().
}

function verifyCaptchaAndRoute() {
  const user = +document.getElementById('captchaInput').value;
  const correct = +document.getElementById('captchaAnswer').value;
  const type = document.getElementById('verifyCaptcha').dataset.download;

  if (user !== correct) {
    alert('Incorrect answer. Please try again.');
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById('captchaModal'))?.hide();

  if (type === 'degree') {
    openDegreeVerificationTab();
    return;
  }

  triggerDownload(type);
}


function showCaptchaModal(type) {
  const modalEl = document.getElementById('captchaModal');
  if (!modalEl) return;

  // Reuse the instance the page may already hold; two instances on one
  // element orphan a backdrop and make Bootstrap 5.0 throw on dispose.
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const op = Math.random() > 0.5 ? '+' : '-';
  const ans = op === '+' ? a + b : Math.abs(a - b);

  document.getElementById('captchaMath').textContent =
    `${op === '+' ? Math.max(a, b) : Math.max(a, b)} ${op} ${op === '+' ? Math.min(a, b) : Math.min(a, b)} = ?`;

  document.getElementById('captchaAnswer').value = ans;
  document.getElementById('captchaInput').value = '';
  document.getElementById('verifyCaptcha').dataset.download = type;
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
  
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('#awards .award-card');

    cards.forEach(card => {
        const canvas = card.querySelector('.award-confetti');
        const media = card.querySelector('.award-media');
        if (!canvas || !media) return;

        // Move canvas inside the media container to cover the image
        media.appendChild(canvas);

        let animationFrameId;
        let fadeOutTimeout;

        // The function that draws the confetti
        function spawnConfetti() {
            if (animationFrameId) return; // Don't start a new animation if one is running

            const ctx = canvas.getContext('2d');
            const w = canvas.width = media.clientWidth;
            const h = canvas.height = media.clientHeight;
            const colors = ['#ffcc00', '#ffd54f', '#90caf9', '#a5d6a7', '#f48fb1'];
            const particles = Array.from({ length: 60 }, () => ({
                x: Math.random() * w,
                y: -10 - Math.random() * h * 0.3,
                r: 2 + Math.random() * 4,
                c: colors[Math.floor(Math.random() * colors.length)],
                vy: 1 + Math.random() * 2,
                vx: -1 + Math.random() * 2,
                rot: Math.random() * Math.PI * 2,
                vr: -0.1 + Math.random() * 0.2
            }));

            function draw() {
                ctx.clearRect(0, 0, w, h);
                particles.forEach(p => {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.fillStyle = p.c;
                    ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
                    ctx.restore();
                    p.y += p.vy;
                    p.x += p.vx;
                    p.rot += p.vr;
                    if (p.y > h + 12) {
                        p.y = -12;
                        p.x = Math.random() * w;
                    }
                });
                animationFrameId = requestAnimationFrame(draw);
            }
            draw();
        }

        // Mouse enters the image area
        media.addEventListener('mouseenter', () => {
            clearTimeout(fadeOutTimeout); // Cancel any pending fade-out
            canvas.style.opacity = '0.85'; // Make canvas visible
            spawnConfetti(); // Start the animation
        });

        // Mouse leaves the image area
        media.addEventListener('mouseleave', () => {
            // Wait 500ms before starting to fade out
            fadeOutTimeout = setTimeout(() => {
                canvas.style.opacity = '0'; // Trigger the CSS fade-out
                // After the fade transition is complete, stop the animation
                setTimeout(() => {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
                }, 500); // This must match the CSS transition duration
            }, 500);
        });

        // Initial animation on scroll
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !canvas.dataset.fired) {
                canvas.dataset.fired = '1';
                media.dispatchEvent(new Event('mouseenter')); // Simulate a hover to start
                setTimeout(() => media.dispatchEvent(new Event('mouseleave')), 2500); // Simulate a mouse leave to fade out
            }
        }, { threshold: 0.4 });

        observer.observe(card);
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Find the input field and the verify button inside your modal
    const captchaInput = document.getElementById('captchaInput');
    const verifyButton = document.getElementById('verifyCaptcha');

    // Ensure both elements exist before adding the event listener
    if (captchaInput && verifyButton) {
        // Listen for a key being pressed down inside the input field
        captchaInput.addEventListener('keydown', function(event) {
            // Check if the key pressed was 'Enter'
            if (event.key === 'Enter' || event.keyCode === 13) {
                // Prevent the default 'Enter' behavior (like a form submitting)
                event.preventDefault();

                // Programmatically click the 'Verify & Download' button
                verifyButton.click();
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
  const modalEl = document.getElementById('captchaModal');
  if (!modalEl) return;

  modalEl.addEventListener('hidden.bs.modal', function () {
    // Wait out Bootstrap's own backdrop transition and dispose(); sweeping
    // sooner removes the element the library is still holding a handle to.
    setTimeout(function () {
      if (document.querySelector('.modal.show')) return;
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
      document.body.style.removeProperty('padding-right');
      document.body.style.removeProperty('overflow');
    }, 600);
  });
});

function initializeDegreeVerification() {
  document.querySelectorAll('.degree-verify-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      showCaptchaModal('degree');
    });
  });
}

function verifyCaptchaAndDownload() {
  const user = +document.getElementById('captchaInput').value;
  const correct = +document.getElementById('captchaAnswer').value;
  const type = document.getElementById('verifyCaptcha').dataset.download;

  if (user !== correct) {
    alert('Incorrect answer. Please try again.');
    return;
  }

  const modalEl = document.getElementById('captchaModal');
  bootstrap.Modal.getInstance(modalEl)?.hide();

  if (type === 'degree') {
    openDegreeVerificationTab();
    return;
  }

  triggerDownload(type);
}

function openDegreeVerificationTab() {
  const url = 'https://dcveri.greatermanchester.ac.uk/?reference=17526070-01-W441';
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
}

window.__trackAnalytics?.trackDownload('Sachintha_Gaurawa_CV.pdf');
window.__trackAnalytics?.trackDegreeClick();
window.__trackAnalytics?.trackLead(name, email, message);
window.__trackAnalytics?.trackClick('Verify Degree');
