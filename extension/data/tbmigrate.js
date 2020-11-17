'use strict';
// This should only be part of toolbox as long as v4.x and v3.x can be installed next to each other.
// The only goal is to try and make sure that if v4 is active v3 will not activate on the same page.
// In order to do that we load this script first, do a quick check if v4 is going to activate and set a session storage key.
const start = performance.now();
let previousName = 'start';
let previous = start;

document.addEventListener('readystatechange', () => {
    console.log(document.readyState, performance.now());
});

function profileResults (name, number) {
    console.groupCollapsed('Profiling thing v5:', name, number);
    if (name === 'start') {
        console.log('   ');
        console.log('performance start:', number);
        console.log('--------------------------');
        console.log('ms:', start);
        console.log('sec:', Math.round(start / 1000));
    } else {
        const secs = Math.round((number - start) / 1000);
        const secsPrevious = Math.round((number - previous) / 1000);
        console.log('   ');
        console.log(`Profile: ${name}`);
        console.log('--------------------------');
        console.log('ms:', number - start);
        console.log('sec:', secs);
        console.log(`Profile: ${name} since ${previousName}`);
        console.log('---');
        console.log('ms:', number - previous);
        console.log('sec:', secsPrevious);
        console.log('   ');

        previousName = name;
        previous = number;
    }
    console.groupEnd();
}

profileResults('start', start);

// Let's do some housecleaning to make sure leftovers of previous versions are no longer lingering.
Object.keys(localStorage)
    .forEach(key => {
        if (/^(TBCachev4.|Toolboxv4.)/.test(key)) {
            localStorage.removeItem(key);
        }
    });

sessionStorage.setItem('v5active', 'true');

window.addEventListener('unload', () => {
    sessionStorage.removeItem('v5active');
});
