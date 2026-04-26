/**
 * Admin Login
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');

  // Check if already logged in
  fetch('/api/auth/me')
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        window.location.href = 'dashboard.html';
      }
    });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMessage.className = 'login-message';
    loginMessage.textContent = '';

    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (result.success) {
        loginMessage.className = 'login-message success';
        loginMessage.textContent = 'Login successful! Redirecting...';
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 500);
      } else {
        loginMessage.className = 'login-message error';
        loginMessage.textContent = result.error || 'Login failed.';
      }
    } catch (err) {
      loginMessage.className = 'login-message error';
      loginMessage.textContent = 'Connection error. Please try again.';
    }
  });
});

