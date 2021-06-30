import {Module} from '../tbmodule.js';
import * as TBStorage from '../tbstorage.js';
import * as TBApi from '../tbapi.js';
import * as TBui from '../tbui.js';
import * as TBHelpers from '../tbhelpers.js';
import * as TBCore from '../tbcore.js';

const self = new Module('Profile Pro');
self.shortname = 'Profile';

// //Default settings
self.settings['enabled']['default'] = true;

self.config['betamode'] = false;

self.register_setting('alwaysTbProfile', {
    type: 'boolean',
    default: false,
    title: 'Always open toolbox profile overlay on reddit profiles.',
});

self.register_setting('profileButtonEnabled', {
    type: 'boolean',
    default: true,
    title: 'Show profile button next to usernames in subs you mod. Allows you to quickly open the toolbox profile on that page.',
});

self.register_setting('directProfileToLegacy', {
    type: 'boolean',
    default: false,
    title: 'Open legacy user overview when clicking on profile links.',
});

self.register_setting('subredditColor', {
    type: 'boolean',
    default: TB.storage.getSetting('QueueTools', 'subredditColor', false),
    hidden: true,
});

self.register_setting('onlyshowInhover', {
    type: 'boolean',
    default: TB.storage.getSetting('GenSettings', 'onlyshowInhover', true),
    hidden: true,
});

self.init = function () {
    const $body = $('body');
    let filterModThings = false;
    let hideModActions = false;
    let cancelSearch = true;
    const listingTypes = ['overview', 'submitted', 'comments'];

    const alwaysTbProfile = self.setting('alwaysTbProfile'),
          directProfileToLegacy = self.setting('directProfileToLegacy'),
          subredditColor = self.setting('subredditColor'),
          profileButtonEnabled = self.setting('profileButtonEnabled'),
          onlyshowInhover = self.setting('onlyshowInhover');

    // When profile links are clicked open them in the legacy view directly
    if (directProfileToLegacy) {
        $body.on('click', 'a', function (event) {
            const userProfileRegex = /(?:\.reddit\.com)?\/(?:user|u)\/[^/]*?\/?$/;
            const thisHref = $(this).attr('href');

            // If the url matches and we are not on an old style profile already.
            if (userProfileRegex.test(thisHref) && !userProfileRegex.test(window.location.href)) {
                event.preventDefault();
                const lastChar = thisHref.substr(-1);
                const newHref = `${thisHref}${lastChar === '/' ? '' : '/'}overview`;
                if (event.ctrlKey || event.metaKey) {
                    window.open(newHref, '_blank');
                } else {
                    window.location.href = newHref;
                }
            }
        });
    }

    /**
         * Will hide or reveal mod actions in the toolbox profile overlay.
         * @function hideModActionsThings
         * @param {boolean} hide determines if actions should be shown or hidden.
         */
    function hideModActionsThings (hide) {
        const $things = $('.tb-thing');
        if (hide) {
            TBCore.forEachChunkedDynamic($things, thing => {
                const $thing = $(thing);
                const modAction = $thing.find('.tb-moderator').length;
                if (modAction) {
                    $thing.addClass('tb-mod-hidden');
                }
            }, {framerate: 40});
        } else {
            TBCore.forEachChunkedDynamic($things, thing => {
                const $thing = $(thing);
                const modAction = $thing.find('.tb-moderator').length;
                if (modAction) {
                    $thing.removeClass('tb-mod-hidden');
                }
            }, {framerate: 40});
        }
    }

    /**
         * Will hide or reveal items in the profile overlay that can't be modded.
         * @function filterModdable
         * @param {boolean} hide determines if items should be shown or hidden.
         */
    function filterModdable (hide) {
        const $things = $('.tb-thing');
        if (hide) {
            TBCore.getModSubs().then(() => {
                TBCore.forEachChunkedDynamic($things, thing => {
                    const $thing = $(thing);
                    const subreddit = TBHelpers.cleanSubredditName($thing.attr('data-subreddit'));
                    if (!window.TBCore.mySubs.includes(subreddit)) {
                        $thing.addClass('tb-mod-filtered');
                    }
                }, {framerate: 40});
            });
        } else {
            TBCore.forEachChunkedDynamic($things, thing => {
                const $thing = $(thing);
                $thing.removeClass('tb-mod-filtered');
            }, {framerate: 40});
        }
    }

    /**
         * Adds items to the toolbox profile overlay siteTable element
         * @function addToSiteTable
         * @param {array} data array of reddit things to be added in reddit API format
         * @param {jqueryObject} $siteTable jquery object representing the siteTable
         * @param {string} after reddit thing ID representing the start of the next page. If present will add a "load more" at the end of the siteTable
         * @param {callback} callback callback function
         * @returns {callback} returned when done
         */
    function addToSiteTable (data, $siteTable, after, callback) {
        // prepare comment options for TBUi comment creator.
        const commentOptions = {
            parentLink: true,
            contextLink: true,
            contextPopup: true,
            fullCommentsLink: true,
            overviewData: true,
        };

        const submissionOptions = {};

        // Add subredditColor if applicable.
        if (subredditColor) {
            commentOptions.subredditColor = true;
            submissionOptions.subredditColor = true;
        }

        // Use dynamic chuncking to add all things to the sitetable.
        TBCore.forEachChunkedDynamic(data, entry => {
            // Comment
            if (entry.kind === 't1') {
                const $comment = TBui.makeSingleComment(entry, commentOptions);
                if (entry.highlight) {
                    $comment.find('.md p').highlight(entry.highlight, '', true);
                }
                $siteTable.append($comment);
                $('time.timeago').timeago();
            }

            // Submission
            if (entry.kind === 't3') {
                const $submission = TBui.makeSubmissionEntry(entry, submissionOptions);
                if (entry.highlight) {
                    $submission.find('.tb-title, .md').highlight(entry.highlight, '', true);
                }
                $siteTable.append($submission);
                $('time.timeago').timeago();
            }
        }).then(() => {
            // More items available on a next page. Add load more element
            if (after) {
                $siteTable.append(`<div data-after="${after}" class="tb-load-more">load more</div>`);
            }

            // Fire jsAPI events and apply profile overlay filters where needed.
            setTimeout(() => {
                TBui.tbRedditEvent($siteTable);
                if (filterModThings) {
                    filterModdable(true);
                }
                if (hideModActions) {
                    hideModActionsThings(true);
                }

                // Done, return callback.
                return callback();
            }, 1000);
        });
    }

    /**
         * Adds the user's trophies to the given sidebar element.
         * @function addTrophiesToSidebar
         * @param {string} user reddit username
         * @param {jqueryObject} $sidebar jquery sidebar element to which the trophies need to be added
         */
    function addTrophiesToSidebar (user, $sidebar) {
        const inputURL = `/user/${user}/trophies.json`;
        TBApi.getJSON(inputURL).then(data => {
            if (Object.keys(data).length > 0 && data.constructor === Object) {
                TBStorage.purifyObject(data);
                const $userTrophies = $(`<div class="tb-user-trophies">
                        <h3> Trophies </h3>
                    </div>`).appendTo($sidebar);
                data.data.trophies.forEach(trophy => {
                    let tropyHTML;

                    const trophyInnerHTML = `
                            <img class="tb-trophy-icon" src="${trophy.data.icon_40}">
                            <br>
                            <span class="tb-trophy-name">${trophy.data.name}</span>
                            <br>
                            ${trophy.data.description ? `<span class="tb-trophy-description">${trophy.data.description}</span>` : ''}
                            <br>`;

                    if (trophy.data.url) {
                        tropyHTML = `
                            <div class="tb-trophy-info">
                                <a href="${trophy.data.url}">
                                    ${trophyInnerHTML}
                                </a>
                            </div>`;
                    } else {
                        tropyHTML = `
                            <div class="tb-trophy-info">
                                ${trophyInnerHTML}
                            </div>`;
                    }
                    $userTrophies.append(tropyHTML);
                });
            }
        });
    }

    /**
         * Adds the user's moderated subs to the given sidebar element.
         * @function addModSubsToSidebar
         * @param {string} user reddit username
         * @param {jqueryObject} $sidebar jquery sidebar element to which the subreddits need to be added
         */
    function addModSubsToSidebar (user, $sidebar) {
        const inputURL = `/user/${user}/moderated_subreddits.json`;
        TBApi.getJSON(inputURL).then(data => {
            if (Object.keys(data).length > 0 && data.constructor === Object) {
                TBStorage.purifyObject(data);
                const $userModSubs = $(`<div class="tb-user-modsubs">
                        <h3> ${data.data.length} Moderated subreddits </h3>
                    </div>`).appendTo($sidebar);

                const $moderatedSubListVisible = $('<ul class="tb-user-modsubs-ul"></ul>').appendTo($userModSubs);
                const $moderatedSubListExpanded = $('<ul class="tb-user-modsubs-expand-ul"></ul>').appendTo($userModSubs);
                let subCount = 0;

                TBCore.forEachChunkedDynamic(data.data, subreddit => {
                    subCount++;
                    const subredditName = subreddit.sr,
                          iconImage = subreddit.icon_img,
                          over18 = subreddit.over_18,
                          subscribers = subreddit.subscribers;

                    const liElement = `<li>
                            <a href="${TBCore.link(`/r/${subredditName}`)}" title="${subscribers} subscribers">/r/${subredditName}</a>
                            ${over18 ? '<span class="tb-nsfw-stamp tb-stamp"><acronym title="Adult content: Not Safe For Work">NSFW</acronym></span>' : ''}
                            ${iconImage ? `<img src="${iconImage}" class="tb-subreddit-icon">` : ''}
                        </li>`;

                    if (subCount < 10) {
                        $moderatedSubListVisible.append(liElement);
                    } else {
                        $moderatedSubListExpanded.append(liElement);
                    }
                }, {framerate: 40}).then(() => {
                    if (subCount > 10) {
                        $moderatedSubListVisible.after(`<button class="tb-general-button tb-sidebar-loadmod tb-more" data-action="more">${subCount - 10} more ...</button>`);
                        $moderatedSubListExpanded.after(`<button class="tb-general-button tb-sidebar-loadmod tb-less" data-action="less">show ${subCount - 10} less</button>`);

                        $body.on('click', '.tb-sidebar-loadmod', function () {
                            const $this = $(this);
                            const action = $this.attr('data-action');

                            if (action === 'more') {
                                $moderatedSubListExpanded.show();
                                $sidebar.find('.tb-sidebar-loadmod.tb-less').show();
                                $this.hide();
                            } else if (action === 'less') {
                                $moderatedSubListExpanded.hide();
                                $sidebar.find('.tb-sidebar-loadmod.tb-more').show();
                                $this.hide();
                            }
                        });
                    }

                    addTrophiesToSidebar(user, $sidebar);
                });
            } else {
                addTrophiesToSidebar(user, $sidebar);
            }
        });
    }

    /**
         * Creates a user sidebar element for the given overlay
         * @function makeUserSidebar
         * @param {string} user reddit username
         * @param {jqueryObject} $overlay jquery overlay element to which the sidebar needs to be added
         */
    function makeUserSidebar (user, $overlay) {
        const $tabWrapper = $overlay.find('.tb-window-tabs-wrapper');
        const inputURL = `/user/${user}/about.json`;
        TBApi.getJSON(inputURL).then(data => {
            TBStorage.purifyObject(data);
            const userThumbnail = data.data.icon_img,
                  userCreated = data.data.created_utc,
                  verifiedMail = data.data.has_verified_email,
                  linkKarma = data.data.link_karma,
                  commentKarma = data.data.comment_karma,
                  displayName = data.data.subreddit.title,
                  publicDescription = data.data.subreddit.public_description;
            const readableCreatedUTC = TBHelpers.timeConverterRead(userCreated),
                  createdTimeAgo = new Date(userCreated * 1000).toISOString();

            const $sidebar = $(`<div class="tb-profile-sidebar">
                    ${userThumbnail ? `<img src="${userThumbnail}" class="tb-user-thumbnail">` : ''}
                    <ul class="tb-user-detail-ul">
                        <li><a href="${TBCore.link(`/user/${user}`)}">/u/${user}</a></li>
                        ${displayName ? `<li>Display name: ${displayName}</li>` : ''}
                        <li>Link karma: ${linkKarma}</li>
                        <li>Comment karma: ${commentKarma}</li>
                        <li>Joined <time title="${readableCreatedUTC}" datetime="${createdTimeAgo}" class="tb-live-timestamp timeago">${createdTimeAgo}</time></li>
                        <li>${verifiedMail ? 'Verified mail' : 'No verified mail'}</li>
                    </ul>
                    ${publicDescription ? `
                    <div class="tb-user-description">
                        ${publicDescription}
                    </div>
                    ` : ''}
                </div>`);
            $tabWrapper.after($sidebar);
            $sidebar.find('time.timeago').timeago();

            addModSubsToSidebar(user, $sidebar);
        }).catch(error => {
            self.error('Error fetching user information:', inputURL, error);
            // This CSS uses inline-block and having whitespace screws it
            // up, so this HTML has to start immediately after the quote :|
            $tabWrapper.after(`<div class="tb-profile-sidebar">
                    <ul class="tb-user-detail-ul">
                        <li>No user information found - shadowbanned or deleted?</li>
                    </ul>
                </div>`);
        });
    }

    /**
         * Searches a user profile for the given subreddit and/or string
         * @function searchProfile
         * @param {string} user reddit username
         * @param {string} type the listing type that is to be searched
         * @param {string} sortMethod the listing type that is to be searched
         * @param {jqueryObject} $siteTable jquery siteTable element to which the search results need to be added
         * @param {object} options search options
         * @param {string} after reddit thing id indicating the next page
         * @param {boolean} match indicates if there are previous
         * @param {integer} pageCount what page we are on
         * @param {callback} callback callback function
         * @returns {callback} returns true when results have been found, false when none are found
         */
    function searchProfile (user, type, sortMethod, $siteTable, options, after, match, pageCount, callback) {
        pageCount++;
        let hits = match || false;
        const results = [];
        const subredditPattern = options.subredditPattern || false;
        const searchPattern = options.searchPattern || false;

        if (!subredditPattern && !searchPattern) {
            return callback(false);
        }

        // Cancel search if needed.
        if (cancelSearch) {
            TB.ui.textFeedback('Search canceled', TB.ui.FEEDBACK_NEUTRAL);
            return callback(hits);
        }
        const inputURL = `/user/${user}/${type}.json`;
        TBApi.getJSON(inputURL, {
            raw_json: 1,
            after,
            sort: sortMethod,
            limit: 100,
            t: 'all',
        }).then(data => {
            // Also cancel search here as we really don't need to go over these results.
            if (cancelSearch) {
                TB.ui.textFeedback('Search canceled', TB.ui.FEEDBACK_NEUTRAL);
                return callback(hits);
            }
            TB.ui.textFeedback(`Searching profile page ${pageCount} with ${data.data.children.length} items`, TB.ui.FEEDBACK_NEUTRAL);
            TBStorage.purifyObject(data);
            data.data.children.forEach(value => {
                let hit = false;
                let subredditMatch = false;
                let patternMatch = false;
                if (value.kind === 't1') {
                    subredditMatch = subredditPattern && subredditPattern.test(value.data.subreddit);
                    patternMatch = searchPattern && searchPattern.test(value.data.body);
                }

                if (value.kind === 't3') {
                    subredditMatch = subredditPattern && subredditPattern.test(value.data.subreddit);
                    patternMatch = searchPattern && (value.data.selftext && searchPattern.test(value.data.selftext) || searchPattern.test(value.data.title));
                }

                if (
                    subredditMatch && !searchPattern ||
                        patternMatch && !subredditPattern ||
                        subredditMatch && patternMatch
                ) {
                    hit = true;
                }

                if (hit) {
                    if (searchPattern) {
                        value.highlight = options.searchString;
                    }
                    results.push(value);
                    hits = true;
                }
            });
            if (!data.data.after) {
                if (results.length > 0) {
                    addToSiteTable(results, $siteTable, false, () => callback(hits));
                } else {
                    return callback(hits);
                }
            } else {
                if (results.length > 0) {
                    addToSiteTable(results, $siteTable, false, () => {
                        searchProfile(user, type, sortMethod, $siteTable, options, data.data.after, hits, pageCount, found => callback(found));
                    });
                } else {
                    searchProfile(user, type, sortMethod, $siteTable, options, data.data.after, hits, pageCount, found => callback(found));
                }
            }
        });
    }

    /**
         * Escapes a string so it is suitable to be inserted in to a regex match
         * @function regExpEscape
         * @param {string} query reddit username
         * @returns {string} string escaped for regex use
         */
    function regExpEscape (query) {
        return query.trim().replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
    }

    // Initate user search
    $body.on('submit', '.tb-searchuser', function () {
        TB.ui.longLoadSpinner(true);
        const $this = $(this);
        const $windowContent = $this.closest('.tb-window-content');
        const $siteTable = $windowContent.find('.tb-sitetable');

        const typeListing = $siteTable.attr('data-listing');

        let subredditsearch = $this.find('.tb-subredditsearch').val();
        const usersearch = $this.closest('.tb-page-overlay').attr('data-user'),
              contentsearch = $this.find('.tb-contentsearch').val(),
              useSort = $this.find('.tb-search-sort').is(':checked');

        let sortMethod = 'new';

        if (useSort) {
            sortMethod = $siteTable.attr('data-sort');
        }

        subredditsearch = subredditsearch.replace(/\/?r\//g, '');
        subredditsearch = TBHelpers.htmlEncode(subredditsearch);

        $siteTable.removeClass('tb-sitetable-processed');
        $siteTable.empty();

        const searchOptions = {};
        if (subredditsearch) {
            searchOptions.subredditPattern = new RegExp(`^${regExpEscape(subredditsearch)}$`, 'i');
        }
        if (contentsearch) {
            searchOptions.searchPattern = TBHelpers.literalRegExp(contentsearch, 'gi');
            searchOptions.searchString = contentsearch;
        }

        cancelSearch = false;
        $('.tb-cancel-profile-search').show();
        searchProfile(usersearch, typeListing, sortMethod, $siteTable, searchOptions, null, false, 0, results => {
            $('.tb-cancel-profile-search').hide();
            TB.ui.textFeedback('Search complete', TB.ui.FEEDBACK_POSITIVE);
            if (results) {
                TB.ui.longLoadSpinner(false);
            } else {
                TB.ui.longLoadSpinner(false);
                $siteTable.append('<div class="error">no results found</div>');
            }

            if (cancelSearch) {
                $siteTable.append('<div class="error">Search was canceled, results might be incomplete</div>');
            }
        });
        return false;
    });

    // Cancel search
    $body.on('click', '.tb-cancel-profile-search', () => {
        TB.ui.textFeedback('Canceling search', TB.ui.FEEDBACK_NEUTRAL);
        cancelSearch = true;
    });

    function populateSearchSuggestion (subreddit) {
        if (subreddit && window.TBCore.mySubs.includes(subreddit)) {
            $body.find('#tb-search-suggest table#tb-search-suggest-list').append(`<tr data-subreddit="${subreddit}"><td>${subreddit}</td></td></tr>`);
        }
        $(window.TBCore.mySubs).each(function () {
            if (this !== subreddit) {
                $body.find('#tb-search-suggest table#tb-search-suggest-list').append(`<tr data-subreddit="${this}"><td>${this}</td></td></tr>`);
            }
        });
    }

    function liveSearch (liveSearchValue) {
        $body.find('#tb-search-suggest table#tb-search-suggest-list tr').each(function () {
            const $this = $(this),
                  subredditName = $this.attr('data-subreddit');

            if (subredditName.toUpperCase().indexOf(liveSearchValue.toUpperCase()) < 0) {
                $this.hide();
            } else {
                $this.show();
            }
        });
    }

    function initSearchSuggestion (subreddit) {
        if (!$body.find('#tb-search-suggest').length) {
            $body.append('<div id="tb-search-suggest" style="display: none;"><table id="tb-search-suggest-list"></table></div>');
            TBCore.getModSubs().then(() => {
                populateSearchSuggestion(subreddit);
            });
        }

        $body.on('focus', '.tb-subredditsearch', function () {
            const offset = $(this).offset();
            const offsetLeft = offset.left;
            const offsetTop = offset.top + 26;

            $body.find('#tb-search-suggest').css({
                left: `${offsetLeft}px`,
                top: `${offsetTop}px`,
            });

            if (!$body.find('#tb-search-suggest').is(':visible')) {
                $body.find('#tb-search-suggest').show();
            }
            const liveSearchValue = $(this).val();
            liveSearch(liveSearchValue);
        });

        $body.find('.tb-subredditsearch').keyup(function () {
            const liveSearchValue = $(this).val();
            liveSearch(liveSearchValue);
        });

        $(document).on('click', event => {
            if (!$(event.target).closest('#tb-search-suggest').length && !$(event.target).closest('.tb-subredditsearch').length) {
                $body.find('#tb-search-suggest').hide();
            }
        });

        $body.on('click', '#tb-search-suggest-list tr', function () {
            const subSuggestion = $(this).attr('data-subreddit');
            $body.find('.tb-subredditsearch:visible').val(subSuggestion);
            $body.find('#tb-search-suggest').hide();
        });
    }

    function makeProfile (user, type, options) {
        const sort = options.sort || 'new';
        const renew = options.renew || false;
        const after = options.after || '';
        const subreddit = options.subreddit || '';
        const content = options.content || '';
        const search = options.search || false;
        const searchSort = options.searchSort || false;
        TB.ui.longLoadSpinner(true);

        let $overlay = $body.find('.tb-profile-overlay');

        if (!$overlay.length) {
            $overlay = TB.ui.overlay(
                `Toolbox profile for /u/${user}`,
                [
                    {
                        title: 'overview',
                        tooltip: 'Overview profile.',
                        content: `
                                <div class="tb-profile-options tb-profile-options-overview"></div>
                                <div class="tb-sitetable tb-sitetable-overview"></div>
                            `,
                        footer: '',
                    },
                    {
                        title: 'submitted',
                        tooltip: 'submitted profile.',
                        content: `
                                <div class="tb-profile-options tb-profile-options-submitted"></div>
                                <div class="tb-sitetable tb-sitetable-submitted"></div>
                            `,
                        footer: '',
                    },
                    {
                        title: 'comments',
                        tooltip: 'comment profile.',
                        content: `
                                <div class="tb-profile-options tb-profile-options-comments"></div>
                                <div class="tb-sitetable tb-sitetable-comments"></div>
                            `,
                        footer: '',
                    },
                ],
                [], // extra header buttons
                'tb-profile-overlay tb-overlay-horizontal-tabs', // class
                false, // single overriding footer
                {
                    user,
                },
                false, // use horizontal tabs instead of vertical
            ).appendTo('body');

            $body.css('overflow', 'hidden');

            makeUserSidebar(user, $overlay);
            $body.on('click', '.tb-profile-overlay .tb-window-header .close', () => {
                // Cancel any ongoing search
                cancelSearch = true;
                $('.tb-profile-overlay').remove();
                $body.css('overflow', 'auto');
                filterModThings = false;
            });
        }
        const $siteTable = $overlay.find(`.tb-sitetable-${type}`);
        const $options = $overlay.find(`.tb-profile-options-${type}`);

        $siteTable.attr({
            'data-user': user,
            'data-sort': sort,
            'data-listing': type,
            't': 'all',
        });

        if ($siteTable.hasClass('tb-sitetable-processed') && !renew && !after) {
            TB.ui.longLoadSpinner(false);
            return;
        }
        // Prevent some issues with people selecting a new sort method while toolbox is still busy.
        $options.hide();

        // Filter options
        let $filterOptions = $options.find('.tb-filter-options');
        if (!$filterOptions.length) {
            $filterOptions = $(`
                <div class="tb-filter-options">
                    <select class="tb-sort-select tb-general-button" data-type="${type}">
                        <option value="new">new</option>
                        <option value="top">top</option>
                        <option value="controversial">controversial</option>
                        <option value="hot">hot</option>
                    </select>
                    <button class="tb-general-button tb-filter-moddable">${filterModThings ? 'Show unmoddable' : 'Hide unmoddable'}</button>
                    <button name="hideModComments" class="tb-hide-mod-comments tb-general-button">${hideModActions ? 'Show mod actions' : 'Hide mod actions'}</a>
                </div>`).appendTo($options);

            $options.append(`<form class="tb-searchuser">
                        search: <input type="text" placeholder="subreddit" class="tb-subredditsearch tb-input tb-search-input"> <input type="text" placeholder="content (optional)" class="tb-contentsearch tb-input tb-search-input">
                        <label> <input type="checkbox" class="tb-search-sort"> use sort selection </label>
                        <input type="submit" value=" search " class="tb-action-button">
                </form>
                <input type="button" value="cancel search" class="tb-action-button tb-cancel-profile-search">`);
            initSearchSuggestion(subreddit);
        }

        const $sortSelect = $filterOptions.find('.tb-sort-select');

        $sortSelect.val(sort);

        if (!after) {
            $siteTable.addClass('tb-sitetable-processed');
            $siteTable.empty();
        }

        TBui.switchOverlayTab('tb-profile-overlay', type);

        if (search) {
            const $subreddit = $options.find('.tb-searchuser .tb-subredditsearch'),
                  $content = $options.find('.tb-searchuser .tb-contentsearch'),
                  $searchSort = $options.find('.tb-searchuser .tb-search-sort'),
                  $searchForm = $options.find('.tb-searchuser');

            $subreddit.val(subreddit);
            $content.val(content);
            $searchSort.prop('checked', searchSort);

            // Stop spinner to rpevent from duplicating.
            TB.ui.longLoadSpinner(false);

            // Show options and submit the search query.
            $options.show();
            $searchForm.submit();
        } else {
            const inputURL = `/user/${user}/${type}.json`;
            TBApi.getJSON(inputURL, {
                raw_json: 1,
                after,
                sort,
                limit: 25,
            }).then(data => {
                TBStorage.purifyObject(data);
                let after = false;
                if (data.data.after) {
                    after = data.data.after;
                }
                addToSiteTable(data.data.children, $siteTable, after, () => {
                    TB.ui.longLoadSpinner(false);
                    $options.show();
                });
            }).catch(error => {
                self.error('Error fetching profile activity:', inputURL, error);
                $('.tb-profile-overlay .tb-window-content').html(`
                        <h1>No activity found</h1>
                        <p>Reddit doesn't seem to have anything for this account. Try checking your subreddit's moderation log to find posts and comments from them.</p>
                    `);
                TB.ui.longLoadSpinner(false);
            });
        }
    }

    $body.on('click', '.tb-load-more', function () {
        const $this = $(this);
        const $siteTable = $this.closest('.tb-sitetable');
        const after = $this.attr('data-after'),
              user = $siteTable.attr('data-user'),
              listing = $siteTable.attr('data-listing'),
              sort = $siteTable.attr('data-sort');
        makeProfile(user, listing, {sort, renew: false, after});

        $this.remove();
    });

    $body.on('change keydown', '.tb-sort-select', function () {
        const $this = $(this);
        const newSort = $this.val(),
              user = $this.closest('.tb-page-overlay').attr('data-user'),
              listing = $this.attr('data-type');
        makeProfile(user, listing, {sort: newSort, renew: true});
    });

    $body.on('click', '.tb-filter-moddable', () => {
        const $filterMod = $body.find('.tb-filter-moddable');
        if (filterModThings) {
            filterModdable(false);
            $filterMod.text('Hide unmoddable');
            filterModThings = false;
        } else {
            filterModdable(true);
            $filterMod.text('Show unmoddable');
            filterModThings = true;
        }
    });

    $body.on('click', '.tb-hide-mod-comments', () => {
        const $hideMod = $('.tb-hide-mod-comments');
        if (hideModActions) {
            hideModActionsThings(false);
            $hideMod.text('Hide mod actions');
            hideModActions = false;
        } else {
            hideModActionsThings(true);
            $hideMod.text('Show mod actions');
            hideModActions = true;
        }
    });

    $body.on('click', '.tb-profile-overlay .tb-window-tabs a', function () {
        // Cancel any ongoing profile search first.
        cancelSearch = true;

        // Start creating specific listing overlay tab
        const $this = $(this);
        const listing = $this.attr('data-module'),
              user = $this.closest('.tb-page-overlay').attr('data-user');
        makeProfile(user, listing, {sort: 'new'});
    });

    window.addEventListener('TBNewPage', event => {
        if (event.detail.pageType === 'userProfile' && listingTypes.includes(event.detail.pageDetails.listing)) {
            const user = event.detail.pageDetails.user,
                  listing = event.detail.pageDetails.listing;
            TBui.contextTrigger('tb-user-profile', {
                addTrigger: true,
                triggerText: 'toolbox profile',
                triggerIcon: TBui.icons.profile,
                title: `Show toolbox profile for /u/${user}`,
                dataAttributes: {
                    user,
                    listing,
                },
            });
            if (alwaysTbProfile) {
                // Prevent `alwaysTbProfile` from opening if there are hash params for opening a profile.
                if (!event.detail.locationHref.includes('#?tbprofile')) {
                    makeProfile(user, listing, {sort: 'new', renew: false});
                }
            }
        } else {
            TBui.contextTrigger('tb-user-profile', {addTrigger: false});
        }
    });

    if (profileButtonEnabled) {
        TB.listener.on('author', e => {
            const $target = $(e.target);

            if (!$target.closest('.tb-profile-overlay').length && (!onlyshowInhover || TBCore.isOldReddit || TBCore.isNewModmail)) {
                const author = e.detail.data.author;
                const subreddit = e.detail.data.subreddit.name;
                if (author === '[deleted]') {
                    return;
                }

                TBCore.getModSubs().then(() => {
                    if (TBCore.modsSub(subreddit)) {
                        const profileButton = `<a href="javascript:;" class="tb-user-profile tb-bracket-button" data-listing="overview" data-user="${author}" data-subreddit="${subreddit}" title="view & filter user's profile in toolbox overlay">P</a>`;
                        requestAnimationFrame(() => {
                            $target.append(profileButton);
                        });
                    }
                });
            }
        });

        TB.listener.on('userHovercard', e => {
            const $target = $(e.target);
            const subreddit = e.detail.data.subreddit.name;
            const author = e.detail.data.user.username;

            TBCore.getModSubs().then(() => {
                if (TBCore.modsSub(subreddit)) {
                    const profileButton = `<a href="javascript:;" class="tb-user-profile tb-bracket-button" data-listing="overview" data-user="${author}" data-subreddit="${subreddit}" title="view & filter user's profile in toolbox overlay">Toolbox Profile View</a>`;
                    $target.append(profileButton);
                }
            });
        });
    }

    $body.on('click', '#tb-user-profile, .tb-user-profile', function () {
        const $this = $(this);
        const user = $this.attr('data-user'),
              listing = $this.attr('data-listing'),
              subreddit = $this.attr('data-subreddit');

        const options = {
            sort: 'new',
            renew: false,
        };
        if (subreddit) {
            options.subreddit = subreddit;
        }
        makeProfile(user, listing, options);
    });

    // Open profile bashed on hash params
    window.addEventListener('TBHashParams', event => {
        const listing = event.detail.tbprofile;
        if (listingTypes.includes(listing)) {
            let user;
            // If we get a user from the params we go from there.
            if (event.detail.user) {
                user = event.detail.user;

                // If not we check if we are on a profile page.
                // We can safely check this object as tbNewPage logic is done before TBHashParams logic.
            } else if (TBCore.pageDetails.pageType === 'userProfile') {
                user = TBCore.pageDetails.pageDetails.user;

                // Finally we simply return if we have no username to work with.
            } else {
                TB.ui.textFeedback('No user present in parameters and not on profile page.', TBui.FEEDBACK_NEGATIVE);
                return;
            }

            const options = {
                sort: event.detail.sort,
                renew: true,
                searchSort: event.detail.sort ? true : false,
                search: false,
            };

            if (event.detail.subreddit) {
                options.search = true;
                options.subreddit = event.detail.subreddit;
            }

            if (event.detail.content) {
                options.search = true;
                options.content = event.detail.content;
            }

            makeProfile(user, listing, options);
        }
    });
};

export default self;
