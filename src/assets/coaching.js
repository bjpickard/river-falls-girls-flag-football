const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');

if (menuButton && navigation) {
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  };

  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    navigation.classList.toggle('is-open', !open);
  });

  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      menuButton.focus();
    }
  });
}

document.querySelectorAll('[data-resource-scope]').forEach((scope) => {
  const search = scope.querySelector('[data-resource-search]');
  const cards = [...scope.querySelectorAll('[data-resource-card]')];
  const count = scope.querySelector('[data-resource-count]');
  const empty = scope.querySelector('[data-empty-state]');
  const groups = [...scope.querySelectorAll('.resource-group')];

  const update = () => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;
    cards.forEach((card) => {
      const haystack = (card.dataset.search || card.textContent).toLowerCase();
      const show = !query || haystack.includes(query);
      card.hidden = !show;
      if (show) visible += 1;
    });

    groups.forEach((group) => {
      const groupCards = [...group.querySelectorAll('[data-resource-card]')];
      group.hidden = groupCards.length > 0 && groupCards.every((card) => card.hidden);
    });

    if (count) count.textContent = `${visible} resource${visible === 1 ? '' : 's'}`;
    if (empty) empty.hidden = visible !== 0;
  };

  search?.addEventListener('input', update);
  update();
});
