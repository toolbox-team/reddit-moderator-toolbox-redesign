'use strict';

// This should only be part of toolbox as long as v4.x and v3.x can be installed next to each other.
// The only goal is to try and make sure that if v4 is active v3 will not activate on the same page.
// In order to do that we load this script first, do a quick check if v4 is going to activate and set a session storage key.
sessionStorage.setItem('v5active', 'true');
window.addEventListener('unload', () => {
    sessionStorage.removeItem('v5active');
});

// Let's do some housecleaning to make sure leftovers of previous versions are no longer lingering.
Object.keys(localStorage).forEach(key => {
    if (/^(TBCachev4.|Toolboxv4.)/.test(key)) {
        localStorage.removeItem(key);
    }
});
