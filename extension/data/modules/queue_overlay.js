'use strict';
/** @module queueOverlay */
function queueOverlay () {
    const self = new TB.Module('Queue Overlay');
    self.shortname = 'queueOverlay';

    // Default settings
    self.settings['enabled']['default'] = true;

    self.config['betamode'] = false;

    self.register_setting('overlayFromBarRedesign', {
        type: 'boolean',
        default: true,
        title: 'In redesign when clicking queue and unmoderated icons open the old reddit variants in an overlay.',
    });

    self.register_setting('overlayFromBarOld', {
        type: 'boolean',
        default: false,
        oldReddit: true,
        title: 'Open queue and unmoderated in overlay when clicking on them from the modbar.',
    });

    TB.register_module(self);

    self.init = function () {
        const $body = $('body');

        const modSubredditsFMod = TB.storage.getSetting('Notifier', 'modSubredditsFMod', false),
              modSubreddits = TB.storage.getSetting('Notifier', 'modSubreddits', 'mod'),
              unmoderatedSubredditsFMod = TB.storage.getSetting('Notifier', 'unmoderatedSubredditsFMod', false),
              unmoderatedSubreddits = TB.storage.getSetting('Notifier', 'unmoderatedSubreddits', 'mod');

        const overlayFromBarRedesign = self.setting('overlayFromBarRedesign'),
              overlayFromBarOld = self.setting('overlayFromBarOld');

        // Array used to keep track of loading iframes so that when the overlay gets closed we can properly stop all long load animations.
        let activeLoading = [];

        // For reports, spam and edited we don't have any settings in toolbox.
        // We simply assume people want to see the same as modqueue as that is most used.
        const baseUrls = {
            modqueue: {
                fmod: modSubredditsFMod,
                subreddits: modSubreddits,
            },
            unmoderated: {
                fmod: unmoderatedSubredditsFMod,
                subreddits: unmoderatedSubreddits,
            },
            reports: {
                fmod: modSubredditsFMod,
                subreddits: modSubreddits,
            },
            spam: {
                fmod: modSubredditsFMod,
                subreddits: modSubreddits,
            },
            edited: {
                fmod: modSubredditsFMod,
                subreddits: modSubreddits,
            },
        };

        if (TBCore.isModpage && TBCore.isEmbedded) {
            $('head link[href*="//www.redditstatic.com/embedded."]').remove();
            $body.addClass('tb-embedded-queues');
            $body.find('.drop-choices a.choice').attr('target', '_self');
        }

        /**
         * Figures out what listing path to use and adds the multireddit representation to the input field on the respective tab.
         * @function figureOutMulti
         * @param {jqueryObject} $tbQueueUrl input element which will hold the multireddit representation
         * @param {string} type the listing type
         * @returns {string} the listing path to be used in overlays
         */
        function figureOutMulti ($tbQueueUrl, type, subreddit) {
            let listUrl;
            if (subreddit) {
                listUrl = `/r/${subreddit}/about/${type}`;
                $tbQueueUrl.val(subreddit);
            } else if (baseUrls[type].fmod) {
                listUrl = `/me/f/mod/about/${type}/`;
                $tbQueueUrl.val('mod');
            } else {
                listUrl = `/r/${baseUrls[type].subreddits}/about/${type}/`;
                $tbQueueUrl.val(baseUrls[type].subreddits);
            }

            return listUrl;
        }

        /**
         * Reload the iframe belonging to a queue listing based on latest data.
         * @function reloadIframe
         * @param {jqueryObject} $reloadListing reload button on the listing tab.
         * @param {jqueryObject} $tbQueueUrl input element which will hold the multireddit representation
         * @param {jqueryObject} $iframe iframe element to be reloaded
         * @param {string} type listing type
         */
        function reloadIframe ($reloadListing, $tbQueueUrl, $iframe, type) {
            $reloadListing.addClass('loading');
            TBui.longLoadSpinner(true);
            const multi = TBStorage.purify($tbQueueUrl.val());
            let newUrl;
            if (multi === 'mod' && baseUrls[type].fmod) {
                newUrl = `/me/f/mod/about/${type}/`;
            } else {
                newUrl = `/r/${multi}/about/${type}/`;
            }
            $iframe.attr('src', `${TBCore.link(newUrl)}?embedded=true`);
        }

        /**
         * Creates the queue overlay or adds data to it if it is already open.
         * @function makeQueueOverlay
         * @param {string} type listing type
         * @param {object} options
         * @param {string} options.subreddit optional, when not given the user's toolbox settings for the listing will be used.
         * @param {boolean} options.overwrite when true will set the base over the overlay to the given subreddit and will reload the tab with this data.
         */
        function makeQueueOverlay (type, {subreddit, overwrite}) {
            let $overlay = $body.find('.tb-queue-overlay');

            // There is no open overlay so we'll create a new one.
            if (!$overlay.length) {
                $overlay = TB.ui.overlay(
                    'Toolbox queues',
                    [
                        {
                            title: 'modqueue',
                            tooltip: 'Moderation queue.',
                            content: `
                                <div class="tb-queue-options">
                                    <input type="text" class="tb-input tb-queue-url">
                                    <span class="tb-icons tb-queue-reload">${TBui.icons.refresh}</span>
                                </div>
                            `,
                            footer: '',
                        },
                        {
                            title: 'unmoderated',
                            tooltip: 'Unmoderated posts.',
                            content: `
                                <div class="tb-queue-options">
                                    <input type="text" class="tb-input tb-queue-url">
                                    <span class="tb-icons tb-queue-reload">${TBui.icons.refresh}</span>
                                </div>
                            `,
                            footer: '',
                        },
                        {
                            title: 'reports',
                            tooltip: 'reports.',
                            content: `
                                <div class="tb-queue-options">
                                    <input type="text" class="tb-input tb-queue-url">
                                    <span class="tb-icons tb-queue-reload">${TBui.icons.refresh}</span>
                                </div>
                            `,
                            footer: '',
                        },
                        {
                            title: 'spam',
                            tooltip: 'spam.',
                            content: `
                                <div class="tb-queue-options">
                                    <input type="text" class="tb-input tb-queue-url">
                                    <span class="tb-icons tb-queue-reload">${TBui.icons.refresh}</span>
                                </div>
                            `,
                            footer: '',
                        },
                        {
                            title: 'edited',
                            tooltip: 'edited.',
                            content: `
                                <div class="tb-queue-options">
                                    <input type="text" class="tb-input tb-queue-url">
                                    <span class="tb-icons tb-queue-reload">${TBui.icons.refresh}</span>
                                </div>
                            `,
                            footer: '',
                        },
                    ],
                    [], // extra header buttons
                    'tb-queue-overlay tb-overlay-horizontal-tabs', // class
                    false, // single overriding footer
                    {
                        subreddit,
                    },
                ).appendTo('body');

                $body.css('overflow', 'hidden');

                // Handle overlay closing.
                $body.on('click', '.tb-queue-overlay .tb-window-header .close', () => {
                    activeLoading.forEach(() => {
                        TBui.longLoadSpinner(false);
                    });
                    activeLoading = [];
                    $('.tb-queue-overlay').remove();
                    $body.css('overflow', 'auto');
                });
            }

            // Overwrite is given from triggers outside of the overlay and overwrites the "base" queue.
            if (overwrite) {
                $overlay.attr('data-subreddit', subreddit);
            }

            // There is already an active tab but overwritten is given. In this case we reload the tabs contents with the overwrite data.
            if (overwrite && $overlay.find(`.tb-window-tab.${type} iframe.tb-queue-iframe`).length) {
                const $tabContent = $overlay.find(`.tb-window-tab.${type} .tb-window-content`);
                const $tbQueueUrl = $tabContent.find('.tb-queue-url');
                const $reloadListing = $tabContent.find('.tb-queue-reload');
                const $iframe = $tabContent.find('iframe.tb-queue-iframe');
                const listUrl = figureOutMulti($tbQueueUrl, type, subreddit);

                $reloadListing.addClass('loading');
                TBui.longLoadSpinner(true);

                $iframe.attr('src', `${TBCore.link(listUrl)}?embedded=true`);
            }

            // No listing is open in the tab yet. Create needed elements and load iframe.
            if (!$overlay.find(`.tb-window-tab.${type} iframe.tb-queue-iframe`).length) {
                TB.ui.longLoadSpinner(true);
                activeLoading.push('active');
                const $tabContent = $overlay.find(`.tb-window-tab.${type} .tb-window-content`);
                const $tbQueueUrl = $tabContent.find('.tb-queue-url');
                const $reloadListing = $tabContent.find('.tb-queue-reload');
                const listUrl = figureOutMulti($tbQueueUrl, type, subreddit);

                const $iframe = $(`<iframe src="${TBCore.link(listUrl)}?embedded=true" class="tb-queue-iframe"></iframe>`).appendTo($tabContent);

                // Handle reloading from the reload button.
                $reloadListing.on('click', () => {
                    if (!$reloadListing.hasClass('loading')) {
                        reloadIframe($reloadListing, $tbQueueUrl, $iframe, type);
                    }
                });

                // Handle reloading when enter is hit in the multi input field.
                $tbQueueUrl.on('keyup', event => {
                    if (event.keyCode === 13 && !$reloadListing.hasClass('loading')) {
                        reloadIframe($reloadListing, $tbQueueUrl, $iframe, type);
                    }
                });

                // Loading is done, remove loading indicators.
                $iframe.on('load', () => {
                    TBui.longLoadSpinner(false);
                    activeLoading.pop();
                    $reloadListing.removeClass('loading');
                });
            }

            // Switch to tab
            TBui.switchOverlayTab('tb-queue-overlay', type);
        }

        // A tab button is clicked, get details ready and load listing.
        $body.on('click', '.tb-queue-overlay .tb-window-tabs a', function () {
            const $this = $(this);
            const type = $this.attr('data-module');
            const subreddit = $this.closest('.tb-queue-overlay').attr('data-subreddit');
            makeQueueOverlay(type, {subreddit});
        });

        // eslint-disable-next-line no-extra-parens
        if ((TBCore.isOldReddit && overlayFromBarOld) || (!TBCore.isOldReddit && overlayFromBarRedesign && !TBCore.isNewModmail)) {
            $body.on('click', '#tb-modqueue, #tb-queueCount', event => {
                if (event.ctrlKey || event.metaKey) {
                    return;
                }
                event.preventDefault();
                makeQueueOverlay('modqueue', {
                    overwrite: true,
                });
            });

            $body.on('click', '#tb-unmoderated, #tb-unmoderatedCount', event => {
                if (event.ctrlKey || event.metaKey) {
                    return;
                }
                event.preventDefault();
                makeQueueOverlay('unmoderated', {
                    overwrite: true,
                });
            });

            $body.on('click', '.tb-my-subreddits-subreddit a[data-type="unmoderated"], .tb-my-subreddits-subreddit a[data-type="modqueue"]', event => {
                if (event.ctrlKey || event.metaKey) {
                    return;
                }
                event.preventDefault();
                const $this = $(event.target);
                makeQueueOverlay($this.attr('data-type'), {
                    subreddit: $this.attr('data-subreddit'),
                    overwrite: true,
                });
            });
        }
    };
}

window.addEventListener('TBModuleLoaded', () => {
    queueOverlay();
}, {
    once: true,
});
