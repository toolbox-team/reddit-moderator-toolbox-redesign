'use strict';

messageHandlers.set('tb-mobile-cookie', (request, sender) => {
    browser.cookies.set({
        url: sender.tab.url,
        path: '/',
        domain: '.reddit.com',
        name: 'mweb-no-redirect',
        value: '1',
        expirationDate: Math.round(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
    });
});
