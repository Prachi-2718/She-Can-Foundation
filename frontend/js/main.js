document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('contactForm');
  const btnSubmit = document.getElementById('btnSubmit');
  const successModal = document.getElementById('successModal');
  const btnSuccessClose = document.getElementById('btnSuccessClose');

  const inputs = {
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    message: document.getElementById('message')
  };

  const validateInput = (input) => {
    const group = document.getElementById(`group${input.id.charAt(0).toUpperCase() + input.id.slice(1)}`);
    let isValid = true;

    if (input.id === 'name') {
      isValid = input.value.trim().length >= 2;
    } else if (input.id === 'email') {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      isValid = emailRegex.test(input.value.trim());
    } else if (input.id === 'message') {
      isValid = input.value.trim().length >= 10;
    }

    if (input.value.trim() === '') {
      group.classList.remove('valid', 'invalid');
    } else if (isValid) {
      group.classList.remove('invalid');
      group.classList.add('valid');
    } else {
      group.classList.remove('valid');
      group.classList.add('invalid');
    }

    return isValid;
  };

  Object.values(inputs).forEach(input => {
    input.addEventListener('input', () => validateInput(input));
    input.addEventListener('blur', () => validateInput(input));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let isFormValid = true;
    Object.values(inputs).forEach(input => {
      if (!validateInput(input)) {
        isFormValid = false;
      }
    });

    if (!isFormValid) return;

    btnSubmit.classList.add('loading');
    btnSubmit.disabled = true;

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: inputs.name.value.trim(),
          email: inputs.email.value.trim(),
          message: inputs.message.value.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        successModal.classList.add('active');
        form.reset();
        Object.values(inputs).forEach(input => {
          document.getElementById(`group${input.id.charAt(0).toUpperCase() + input.id.slice(1)}`).classList.remove('valid', 'invalid');
        });
      } else {
        window.showToast('Error: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Submission Error:', error);
      window.showToast('An error occurred. Please try again.', 'error');
    } finally {
      btnSubmit.classList.remove('loading');
      btnSubmit.disabled = false;
    }
  });

  btnSuccessClose.addEventListener('click', () => {
    successModal.classList.remove('active');
  });

  // --- WOW Features ---

  // 1. Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const currentTheme = localStorage.getItem('theme');
  if (currentTheme === 'dark') {
    body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
  themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    let theme = 'light';
    if (body.classList.contains('dark-theme')) {
      theme = 'dark';
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    localStorage.setItem('theme', theme);
  });

  // 2. Typewriter Effect
  const words = ['Technology.', 'Engineering.', 'Leadership.', 'Innovation.'];
  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  const typewriterText = document.getElementById('typewriterText');

  const type = () => {
    const currentWord = words[wordIndex];
    if (isDeleting) {
      typewriterText.textContent = currentWord.substring(0, charIndex - 1);
      charIndex--;
    } else {
      typewriterText.textContent = currentWord.substring(0, charIndex + 1);
      charIndex++;
    }

    let typeSpeed = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex === currentWord.length) {
      typeSpeed = 2000;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      typeSpeed = 500;
    }

    setTimeout(type, typeSpeed);
  };
  setTimeout(type, 1000);

  // 3. Scroll Animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    observer.observe(el);
  });

});
