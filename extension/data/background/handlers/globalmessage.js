'use strict';

messageHandlers.set('tb-global', async (request, sender) => {
    const message = {
        action: request.globalEvent,
        payload: request.payload,
    };

    // Send to all tabs
    const tabs = await browser.tabs.query({});
    for (let i = 0; i < tabs.length; ++i) {
        if (sender.tab.id !== tabs[i].id && tabs[i].url.includes('reddit.com')) {
            browser.tabs.sendMessage(tabs[i].id, message).catch(error => {
                // Receiving end errors are not really relevant to us and happen a lot for iframes and such where toolbox isn't active.
                if (error.message !== 'Could not establish connection. Receiving end does not exist.') {
                    console.warn('tb-global: ', error.message, error);
                }
            });
        }
    }

    // Also send to the background page, unless it only applies to tabs
    if (!request.excludeBackground) {
        handleMessage(message, sender);
    }
});
