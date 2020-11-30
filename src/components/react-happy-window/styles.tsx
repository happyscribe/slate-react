export const loadStyles = () => {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = `
    @media (max-width: 480px) {
      .only-desktop {
        display: none;
      }
    }

    .hidden-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .hidden-scrollbar::-webkit-scrollbar {
      display: none;
    }
  `;
  document.getElementsByTagName('head')[0].appendChild(style);
};
