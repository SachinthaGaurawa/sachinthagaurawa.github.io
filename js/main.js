// Hide spinner immediately on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const spinner = document.getElementById('spinner');
  if (spinner) spinner.classList.remove('show');
});
