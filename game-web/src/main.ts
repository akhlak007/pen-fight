import './styles/global.css';

function createApplicationShell(): HTMLElement {
  const root = document.createElement('main');
  root.className = 'game-shell';
  root.setAttribute('aria-label', 'Pen Fight game');

  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('aria-label', '3D classroom');
  root.append(canvas);

  const status = document.createElement('p');
  status.className = 'boot-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Finding your seat.';
  root.append(status);

  return root;
}

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) {
  throw new Error('Pen Fight could not find its application mount.');
}
mount.replaceChildren(createApplicationShell());
