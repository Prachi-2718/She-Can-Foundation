document.addEventListener('DOMContentLoaded', () => {
  const loginOverlay = document.getElementById('loginOverlay');
  const dashboardWrapper = document.getElementById('dashboardWrapper');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const btnLogout = document.getElementById('btnLogout');

  let token = localStorage.getItem('adminToken');

  const checkAuth = () => {
    if (token) {
      loginOverlay.style.display = 'none';
      dashboardWrapper.style.display = 'flex';
      fetchDashboardData();
    } else {
      loginOverlay.style.display = 'flex';
      dashboardWrapper.style.display = 'none';
    }
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (data.success) {
        token = data.token;
        localStorage.setItem('adminToken', token);
        document.getElementById('adminUsername').textContent = data.username;
        checkAuth();
      } else {
        loginError.textContent = data.error || 'Login failed';
        loginError.style.display = 'block';
      }
    } catch (error) {
      loginError.textContent = 'Server error. Please try again.';
      loginError.style.display = 'block';
    }
  });

  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    token = null;
    checkAuth();
  });

  const fetchDashboardData = async () => {
    fetchStats();
    fetchSubmissions();
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        document.getElementById('statTotal').textContent = data.stats.total;
        document.getElementById('statNew').textContent = data.stats.new;
        document.getElementById('statFlagged').textContent = data.stats.flagged;
        
        renderCharts(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  let timelineChartInstance = null;
  let statusChartInstance = null;

  const renderCharts = (stats) => {
    // Status Chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['New', 'Read', 'Flagged'],
        datasets: [{
          data: [stats.new, stats.read, stats.flagged],
          backgroundColor: ['#00B894', '#94A3B8', '#FF7675'],
          borderWidth: 0
        }]
      },
      options: { cutout: '70%', plugins: { legend: { position: 'bottom' } } }
    });

    // Timeline Chart
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    if (timelineChartInstance) timelineChartInstance.destroy();
    
    const dates = stats.timeline.map(t => t.date);
    const counts = stats.timeline.map(t => t.count);

    timelineChartInstance = new Chart(timelineCtx, {
      type: 'line',
      data: {
        labels: dates.length ? dates : ['No Data'],
        datasets: [{
          label: 'Submissions',
          data: counts.length ? counts : [0],
          borderColor: '#6C5CE7',
          backgroundColor: 'rgba(108, 92, 231, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  };

  const fetchSubmissions = async () => {
    const status = document.getElementById('statusFilter').value;
    const search = document.getElementById('searchInput').value;
    let url = '/api/admin/submissions?';
    if (status !== 'all') url += `status=${status}&`;
    if (search) url += `search=${search}`;

    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        btnLogout.click(); // Token expired
        return;
      }
      const data = await response.json();
      if (data.success) {
        renderTable(data.submissions);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const renderTable = (submissions) => {
    const tbody = document.getElementById('submissionsTableBody');
    tbody.innerHTML = '';
    
    if (submissions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No submissions found.</td></tr>';
      return;
    }

    submissions.forEach(sub => {
      const date = new Date(sub.created_at).toLocaleDateString();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${date}</td>
        <td><strong>${sub.name}</strong></td>
        <td>${sub.email}</td>
        <td><span class="status-badge status-${sub.status}">${sub.status}</span></td>
        <td>
          <button class="action-btn" title="View details" onclick="alert('Message: ${sub.message.replace(/'/g, "\\'")}')"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn" title="Mark Read" onclick="updateStatus(${sub.id}, 'read')"><i class="fa-solid fa-check"></i></button>
          <button class="action-btn" title="Flag" onclick="updateStatus(${sub.id}, 'flagged')"><i class="fa-solid fa-flag"></i></button>
          <button class="action-btn delete" title="Delete" onclick="deleteSubmission(${sub.id})"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  window.updateStatus = async (id, status) => {
    try {
      await fetch(`/api/admin/submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status })
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  window.deleteSubmission = async (id) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    try {
      await fetch(`/api/admin/submissions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error deleting submission:', error);
    }
  };

  document.getElementById('statusFilter').addEventListener('change', fetchSubmissions);
  document.getElementById('searchInput').addEventListener('input', () => {
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(fetchSubmissions, 500);
  });

  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    try {
      const response = await fetch('/api/admin/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.status === 401 || response.status === 403) {
        btnLogout.click();
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'she-can-submissions.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      window.showToast('Failed to export CSV', 'error');
    }
  });

  // Socket.io Real-Time Updates
  const socket = io();
  socket.on('new_submission', (data) => {
    if (token) {
      window.showToast(`New message from ${data.name}!`, 'success');
      fetchDashboardData();
    }
  });

  checkAuth();
});
