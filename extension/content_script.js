// The content script is mostly module code, but content script entry points are
// always run as scripts. We load our module code via `import()`.
import(browser.runtime.getURL('data/init.js')).catch(error => {
    console.error('tb: Error loading Toolbox init script:', error);
});
