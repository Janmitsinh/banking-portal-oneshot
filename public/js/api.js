const Api = (() => {
  async function request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = sessionStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { sessionStorage.clear(); if (!location.pathname.endsWith('login.html')) location.href = '/login.html'; }
    if (!response.ok) throw new Error(payload.error || 'Something went wrong');
    return payload;
  }
  return { request };
})();
