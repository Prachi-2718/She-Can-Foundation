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
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Submission Error:', error);
      alert('An error occurred while submitting the form. Please try again.');
    } finally {
      btnSubmit.classList.remove('loading');
      btnSubmit.disabled = false;
    }
  });

  btnSuccessClose.addEventListener('click', () => {
    successModal.classList.remove('active');
  });
});
