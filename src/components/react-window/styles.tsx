export const loadStyles = () => {
  const style = document.createElement('style')
  style.type = 'text/css'
  style.innerHTML = `
    .react-window-offset-parent {
        position: relative;
        min-width: 100px;
        min-height: 100px;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .react-window-container {
        position: absolute;
        width: 100%;
    }
    .scrollBarContainer {
        position: absolute;
        top: 2px;
        bottom: 2px;
        right: 3px;
        width: 5px;
        transition: all 0.2s;
    }
    .scrollBarContainer:hover {
        right: 2px;
        width: 8px;
    }
    .scrollBarContainer > div {
        position: relative;
        width: 100%;
        height: 100%;
        background: #eee;
        border-radius: 10px;
    }
    .scrollBarContainer > div > div {
        position: absolute;
        width: 100%;
        background: #aaa;
        border-radius: 10px;
    }
  `
  document.getElementsByTagName('head')[0].appendChild(style)
}
