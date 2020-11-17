'use strict';

function historybutton () {
    const self = new TB.Module('History Button');

    self.shortname = 'HButton';

    // This should be a setting, methinks.
    self.SPAM_REPORT_SUB = 'spam';

    self.settings['enabled']['default'] = true;

    self.fetched = {};// fetched histories

    self.register_setting('rtsComment', {
        type: 'boolean',
        default: true,
        title: 'Post user summary when submitting spam reports',
    });

    self.register_setting('alwaysComments', {
        type: 'boolean',
        default: true,
        advanced: true,
        title: 'Load comment history immediately',
    });

    self.register_setting('commentCount', {
        type: 'selector',
        values: ['100', '200', '300', '400', '500', '600', '700', '800', '900', '1000'],
        default: '1000',
        advanced: true,
        title: 'Number of comments to retrieve per user history',
    });

    self.register_setting('onlyshowInhover', {
        type: 'boolean',
        default: TB.storage.getSetting('GenSettings', 'onlyshowInhover', true),
        hidden: true,
    });

    self.register_setting('includeNsfwSearches', {
        type: 'boolean',
        default: false,
        title: 'Include NSFW submissions in searches',
    });

    /**
     * Attach an [H] button to all users
     */

    self.attachHistoryButton = function ($target, author, subreddit, buttonText = 'H') {
        requestAnimationFrame(() => {
            $target.append(`
                <a href="javascript:;" class="user-history-button tb-bracket-button" data-author="${author}" ${subreddit && `data-subreddit="${subreddit}"`} title="view & analyze user's submission and comment history">
                    ${buttonText}
                </a>
            `);
        });
    };

    self.runJsAPI = function () {
        self.log('run');

        const onlyshowInhover = self.setting('onlyshowInhover');
        TB.listener.on('author', e => {
            const $target = $(e.target);
            // Skip adding the button next to the username if:
            // - the onlyShowInHover preference is set,
            // - we're not on old reddit (since the preference doesn't work there), and
            // - we didn't make the thing the author is on (since the hovercard doesn't show up on constructed things).
            if (onlyshowInhover && !TBCore.isOldReddit && !$target.closest('.tb-thing').length) {
                return;
            }
            const author = e.detail.data.author,
                  subreddit = e.detail.data.subreddit && e.detail.data.subreddit.name;
            self.attachHistoryButton($target, author, subreddit);
        });

        TB.listener.on('userHovercard', e => {
            const $target = $(e.target),
                  author = e.detail.data.user.username,
                  subreddit = e.detail.data.subreddit && e.detail.data.subreddit.name;
            self.attachHistoryButton($target, author, subreddit, 'User History');
        });

        window.addEventListener('TBNewPage', event => {
            if (event.detail.pageType === 'userProfile') {
                const user = event.detail.pageDetails.user;
                TBui.contextTrigger('tb-user-history', {
                    addTrigger: true,
                    triggerText: 'user history',
                    triggerIcon: TBui.icons.history,
                    title: `Show history for /u/${user}`,
                    dataAttributes: {
                        author: user,
                    },
                });
            } else {
                TBui.contextTrigger('tb-user-profile', {addTrigger: false});
            }
        });
    };

    /**
     * Initiate the module
     */
    self.init = function () {
        self.log('init');
        const $body = $('body');
        TBCore.modSubCheck(modSubCheck => {
            self.log(`mscheck: ${modSubCheck}`);
            if (modSubCheck) {
                self.log('passed');

                self.runJsAPI();

                $body.on('click', '.user-history-button, #tb-user-history', function (event) {
                    const $this = $(this);
                    const $target = $(event.currentTarget);
                    const author = $target.attr('data-author');
                    const thisSubreddit = $target.attr('data-subreddit');

                    const positions = TBui.drawPosition(event);

                    const subreddits = {submissions: {}, comments: {}},
                          counters = {submissions: 0, comments: 0, commentsOP: 0},
                          accounts = {},
                          subredditList = [],
                          domainList = [],
                          commentSubredditList = [],

                          gettingUserData = true,
                          domains = [],
                          domainslist = [],

                          popupContent = `
                            <div>
                                <a href="${TBCore.link(`/user/${author}`)}" target="_blank">${author}</a>
                                <span class="karma" />
                                <a class="comment-report tb-general-button" href="javascript:;">comment history</a>
                                <a class="markdown-report tb-general-button" href="javascript:;">view report in markdown</a>
                                <a class="rts-report tb-general-button" style="display: none" href="javascript:;" data-commentbody="">report spammer</a>
                                <br/>
                                <span class="redditorTime"></span>
                                <br/>
                                <p class="tb-history-disclaimer">
                                <strong>Disclaimer: </strong> The information shown below is an <i>indication</i> not a complete picture, it lacks the context you would get from having a look at a person's profile.

                                </p>
                                <b>Available history:</b> <br>
                                <label class="submission-count"></label> submissions
                                <br>
                                <span class="tb-history-comment-stats" style="display:none">
                                <label class="comment-count"></label> comments of those <label class="comment-count-OP"></label> are in their own posts (commented as OP).
                                </span>
                                </div>
                                <div class="history-table-wrapper">
                                <div class="table domain-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="url-td">domain submitted from</th>
                                                <th class="url-count">count</th><th class="url-percentage">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td colspan="6" class="error">loading...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div class="table subreddit-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="url-td">subreddit submitted to</th>
                                                <th class="url-count">count</th>
                                                <th class="url-percentage">%</th>
                                                <th class="url-karma">karma</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td colspan="6" class="error">loading...</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                </div>
                                <div class="history-table-wrapper">
                                <div class="table comment-table" style="display: none">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="url-td">subreddit commented in</th>
                                                <th class="url-count">count</th>
                                                <th class="url-percentage">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td colspan="6" class="error">loading...</td></tr>
                                        </tbody>
                                    </table>

                                </div>
                                <div class="table account-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th class="url-td">account submitted from</th>
                                                <th class="url-count">count</th>
                                                <th class="url-percentage">%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td colspan="6" class="error">loading...</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                </div>
                            </div>
                        `;

                    const $overlay = $this.closest('.tb-page-overlay');
                    let $appendTo;
                    if ($overlay.length) {
                        $appendTo = $overlay;
                    } else {
                        $appendTo = $('body');
                    }

                    const $popup = TB.ui.popup({
                        title: 'History Button',
                        tabs: [
                            {
                                title: 'Tab1',
                                tooltip: 'Tooltip shown when hovering tab.',
                                content: popupContent,
                                footer: '',
                            },
                        ],
                        cssClass: 'history-button-popup',
                        draggable: true,
                    }).appendTo($appendTo)
                        .css({
                            left: positions.leftPosition,
                            top: positions.topPosition,
                            display: 'block',
                        });

                    self.fetched[author] = {
                        popup: $popup,
                        subreddits,
                        counters,
                        accounts,
                        subredditList,
                        domainList,
                        commentSubredditList,
                        author,
                        gettingUserData,
                        domains,
                        domainslist,
                    };

                    $popup.on('click', '.close', () => {
                        if (!$overlay.length) {
                            $popup.hide();
                        } else {
                            $popup.remove();
                        }
                    });

                    self.showAuthorInformation(author);
                    self.populateSubmissionHistory('', author, thisSubreddit);

                    $popup.on('click', '.markdown-report', self.showMarkdownReport.bind(self, author));
                    $popup.on('click', '.rts-report', self.reportAuthorToSpam.bind(self, author));
                    $popup.on('click.comment-report', '.comment-report', function () {
                        $(this).hide();
                        $popup.off('click.comment-report');
                        self.populateCommentHistory('', author, thisSubreddit);
                    });

                    if (self.setting('alwaysComments')) {
                        $popup.find('.comment-report').click();
                    }
                });
            }
        });
    };

    /**
     * Show author information (Karma, How long they've been a redditor for)
     */
    self.showAuthorInformation = async function (author) {
        const $contentBox = self.fetched[author].popup;

        const d = await TBApi.getJSON(`/user/${author}/about.json`);
        TBStorage.purifyObject(d);
        const joinedDate = new Date(d.data.created_utc * 1000),
              redditorTime = TBHelpers.niceDateDiff(joinedDate);

        requestAnimationFrame(() => {
            $contentBox.find('.karma').text(`(${d.data.link_karma} | ${d.data.comment_karma})`);
            $contentBox.find('.redditorTime').text(`redditor for ${redditorTime}`);
        });
    };

    /**
     * Show the markdown report
     */
    self.showMarkdownReport = function (author) {
        const $contentBox = self.fetched[author].popup,
              markdownReport = $contentBox.find('.rts-report').attr('data-commentbody'),
              $markdown = $contentBox.find('.submission-markdown-text');

        if ($markdown.length > 0) {
            $markdown.html(markdownReport).toggle();
        } else {
            $contentBox.find('.table.domain-table').before(`<div class="submission-markdown">
                <textarea class="tb-input submission-markdown-text">${markdownReport}</textarea>
            </div>`);
        }
    };

    /**
     * Populate the submission history for a user
     *
     * @param after A token given by reddit for paginated results, allowing us to get the next page of results
     * @param author The author whose history we're fetching
     * @param thisSubreddit The name of the subreddit to highlight in generated tables
     */
    self.populateSubmissionHistory = function (after, author, thisSubreddit) {
        const user = self.fetched[author],
              $contentBox = user.popup,
              $rtsLink = $contentBox.find('.rts-report'),
              $submissionCount = $contentBox.find('.submission-count'),
              $domainTable = $contentBox.find('.domain-table tbody'),
              $subredditTable = $contentBox.find('.subreddit-table tbody'),
              $error = $contentBox.find('.subreddit-table .error, .domain-table .error, .account-table-table .error'),
              $accountTable = $contentBox.find('.account-table tbody'),
              TYPE = {
                  PATH: 1, // e.g. example.org/path/user
                  SUBDOMAIN: 2, // e.g. user.example.org
              },
              domainSpecs = {
                  // keys are the supported sites, and determine if we have a match
                  'flickr.com': {
                      path: 'photos/',
                      provider: 'flickr',
                      type: TYPE.PATH,
                  },
                  'medium.com': {
                      path: '@',
                      provider: 'Medium',
                      type: TYPE.PATH,
                  },
                  'speakerdeck.com': {
                      provider: 'Speaker Deck',
                      type: TYPE.PATH,
                  },
                  'blogspot.com': {
                      provider: 'Blogspot',
                      type: TYPE.SUBDOMAIN,
                  },
                  'tumblr.com': {
                      provider: 'Tumblr',
                      type: TYPE.SUBDOMAIN,
                  },
                  'deviantart.com': {
                      provider: 'deviantart',
                      type: TYPE.SUBDOMAIN,
                  },
                  'artstation.com': {
                      path: 'artwork/',
                      provider: 'artstation',
                      type: TYPE.PATH,
                  },
                  'twitter.com': {
                      provider: 'Twitter',
                      type: TYPE.PATH,
                  },
              };

        TB.ui.longLoadNonPersistent(true);

        TBApi.getJSON(`/user/${author}/submitted.json`, {
            after,
            sort: 'new',
            limit: 100,
        }).catch(() => {
            self.log('Shadowbanned?');
            $error.html('unable to load userdata</br>shadowbanned?');
            TB.ui.longLoadNonPersistent(false);
        }).then(d => {
            if (!d) {
                return;
            }
            TBStorage.purifyObject(d);
            // This is another exit point of the script. Hits this code after loading 1000 submissions for a user
            if ($.isEmptyObject(d.data.children)) {
                requestAnimationFrame(() => {
                    if (user.counters.submissions > 0) {
                        $submissionCount.html(TBStorage.purify(`${user.counters.submissions}+`));
                    } else {
                        $submissionCount.html(TBStorage.purify(user.counters.submissions));
                    }

                    // If the error elements can be seen it is because there are no submissions
                    $error.html('no submissions');
                });

                user.gettingUserData = false;

                TB.ui.longLoadNonPersistent(false);
                return;
            }

            const after = d.data.after;
            let commentBody = `Available submission history for /u/${author}:\n\ndomain submitted from|count|%\n:-|-:|-:`;

            user.counters.submissions += d.data.children.length;
            // There's still more subsmissions to load, so we're going to run again
            if (after) {
                $submissionCount.html(TBStorage.purify(`Loading... (${user.counters.submissions})`));
                self.populateSubmissionHistory(after, author, thisSubreddit);
            } else {
                // All of the submissions have been loaded at this point
                user.gettingUserData = false;
                $submissionCount.html(TBStorage.purify(user.counters.submissions));
            }

            TB.ui.longLoadNonPersistent(false);
            // For every submission, incremenet the count for the subreddit and domain by one.
            d.data.children.forEach(value => {
                const data = value.data;

                if (!user.domains[data.domain]) {
                    user.domains[data.domain] = {
                        count: 0,
                    };
                    user.domainList.push(data.domain);
                }
                user.domains[data.domain].count++;

                if (!user.subreddits.submissions[data.subreddit]) {
                    user.subreddits.submissions[data.subreddit] = {
                        count: 0,
                        karma: 0,
                    };
                    user.subredditList.push(data.subreddit);
                }
                user.subreddits.submissions[data.subreddit].count++;
                user.subreddits.submissions[data.subreddit].karma += data.score;

                if (data.media && data.media.oembed && data.media.oembed.author_url) {
                    const oembed = data.media.oembed;

                    addAccount({
                        name: oembed.author_name,
                        provider: oembed.provider_name,
                        provider_url: oembed.provider_url,
                        url: oembed.author_url,
                    });
                } else {
                    let spec = domainSpecs[data.domain],
                        details, domain;

                    if (!spec) {
                    // "sub.dom.ain.domain.com" -> "domain.com" (NOTE: does not support "domain.co.uk")
                        domain = data.domain.split('.').slice(-2).join('.');
                        spec = domainSpecs[domain];
                    }

                    if (spec) {
                        spec.domain = domain || data.domain;
                        details = getDomainDetails(spec, data.url);
                        if (details) {
                            addAccount(details);
                        }
                    }
                }
            });

            // Sort the domains by submission count
            user.domainList.sort((a, b) => user.domains[b].count - user.domains[a].count);

            // Empty the domain table
            $domainTable.empty();

            // Get the total account od domain submissions
            let totalDomainCount = 0;

            for (const domain in user.domains) {
                if (Object.prototype.hasOwnProperty.call(user.domains, domain)) {
                    totalDomainCount += user.domains[domain].count;
                }
            }

            // Are there more domains than are shown?
            let moreDomains = 0;

            const maybeNsfwParam = self.setting('includeNsfwSearches') ? '&include_over_18=on' : '';

            // Append all domains to the table and to the report comment
            user.domainList.forEach((domain, index) => {
                const domainCount = user.domains[domain].count,
                      match = domain.match(/^self.(\w+)$/),
                      percentage = Math.round(domainCount / totalDomainCount * 100);

                let cssClass = '';
                if (percentage >= 10 && domainCount > 4) {
                    cssClass = percentage >= 20 ? 'tb-history-row-danger' : 'tb-history-row-warning';
                }

                let url = TBCore.link(`/search?q=site%3A${domain}+author%3A${author}+is_self%3A0&restrict_sr=off${maybeNsfwParam}&sort=new&feature=legacy_search`);
                // If the domain is a self post, change the URL
                if (match) {
                    url = TBCore.link(`/r/${match[1]}/search?q=author%3A${author}+is_self%3A1&restrict_sr=on${maybeNsfwParam}&sort=new&feature=legacy_search`);
                }

                // Append domain to the table
                requestAnimationFrame(() => {
                    $domainTable.append(`
                        <tr class="${cssClass}">
                            <td class="url-td"><a target="_blank" href="${url}" title="view links ${author} recently submitted from '${domain}'">${domain}</a></td>
                            <td class="count-td">${domainCount}</td>
                            <td class="percentage-td">${percentage}%</td>
                        </tr>
                    `);
                });

                // Append the first 20 domains to the report comment
                if (index < 20) {
                    commentBody += `\n[${domain}](${url})|${domainCount}|${percentage}%`;
                }
                moreDomains = index;
            });

            // If there were 20 or more domains, append to the report comment that we only displayed 20
            if (moreDomains >= 20) {
                commentBody += `\n\n_^...and ^${user.domainList.length - 20} ^more_`;
            }

            commentBody += '\n\nsubreddit submitted to|count|%\n:-|-:|-:';

            // Sort subreddit list by count
            user.subredditList.sort((a, b) => user.subreddits.submissions[b].count - user.subreddits.submissions[a].count);

            // Empty the subreddit table
            $subredditTable.empty();

            // Get the total count of subreddit submissions
            let totalSubredditCount = 0;
            for (const subreddit of Object.keys(user.subreddits.submissions)) {
                totalSubredditCount += user.subreddits.submissions[subreddit].count;
            }

            // Append a list of subreddits submitted to the subreddit table and to the comment body for reports
            user.subredditList.forEach((subreddit, index) => {
                const subredditCount = user.subreddits.submissions[subreddit].count,
                      subredditKarma = user.subreddits.submissions[subreddit].karma,
                      url = TBCore.link(`/r/${subreddit}/search?q=author%3A${author}&restrict_sr=on${maybeNsfwParam}&sort=new&feature=legacy_search`),
                      percentage = Math.round(subredditCount / totalSubredditCount * 100);

                let cssClass = '';
                if (percentage >= 10 && subredditCount > 4) {
                    cssClass = percentage >= 20 ? 'tb-history-row-danger' : 'tb-history-row-warning';
                }
                if (subreddit === thisSubreddit) {
                    cssClass += ' tb-history-row-current-subreddit';
                }

                requestAnimationFrame(() => {
                    $subredditTable.append(`
                        <tr class="${cssClass}">
                            <td class="url-td"><a target="_blank" href="${url}" title="view links ${author} recently submitted to /r/${subreddit}/">${subreddit}</a></td>
                            <td class="count-td">${subredditCount}</td>
                            <td class="percentage-td">${percentage}%</td>
                            <td class="karma-td">${subredditKarma}</td>
                        </tr>
                    `);
                });

                if (index < 20) {
                    commentBody += `\n[${subreddit}](${url})|${subredditCount}|${percentage}%`;
                }
            });

            // If there were more than 20 subreddits, we only put the first 20 in the report, and say that there are more
            if (moreDomains >= 20) {
                commentBody += `\n\n_^...and ^${user.subredditList.length - 20} ^more_`;
            }

            $rtsLink.attr('data-commentbody', commentBody);

            tableify(); // TODO: why is this another function? What does it actually do?
        });

        function tableify () {
            // Get the total account of account submissions
            $accountTable.empty();

            const accountList = [];

            for (const account of Object.keys(user.accounts)) {
                accountList.push(account);
            }

            // Sort the domains by submission count
            accountList.sort((a, b) => user.accounts[b].count - user.accounts[a].count);

            accountList.forEach(account => {
                account = user.accounts[account];
                const percentage = Math.round(account.count / user.counters.submissions * 100);
                let cssClass = '';
                if (percentage >= 10 && account.count > 4) {
                    cssClass = percentage >= 20 ? 'tb-history-row-danger' : 'tb-history-row-warning';
                }

                requestAnimationFrame(() => {
                    $accountTable.append(`
                        <tr class="${cssClass}">
                            <td class="url-td">
                                <a href="${account.url}" target="_blank">${account.name}</a> - <a href="${account.provider_url}" target="_blank">${account.provider}</a>
                            </td>
                            <td class="count-td">${account.count}</td>
                            <td class="percentage-td">${percentage}%</td>
                        </tr>
                    `);
                });
            });
        }

        /**
         * Take an object and add it to `self.accounts`.
         *
         * @param details {Object}
         */
        function addAccount (details) {
            details.url = details.url.replace('https://', 'http://');
            if (!user.accounts[details.url]) {
                user.accounts[details.url] = details;
                user.accounts[details.url].count = 0;
            }
            user.accounts[details.url].count++;
        }

        /**
         * Generate a `details` object that mimics the oembed object to be passed to `addAccount()`.
         *
         * @param spec {Object} from domainSpecs
         * @param url {String}
         * @returns {Object|undefined}
         */
        function getDomainDetails (spec, url) {
            // cache the dynamic rx's
            if (!spec.rx) {
                if (spec.type === TYPE.PATH) {
                    spec.rx = new RegExp(`${spec.domain}/${spec.path || ''}([\\w-@]+)`);
                } else if (spec.type === TYPE.SUBDOMAIN) {
                    spec.rx = new RegExp(`://([\\w-]+).${spec.domain}`);
                }
            }

            const match = url.match(spec.rx),
                  author = match && match[1];
            let scheme, author_url, provider_url;

            if (author) {
                scheme = `${url.split('://')[0]}://`;
                provider_url = `${scheme + spec.domain}/`;

                if (spec.type === TYPE.PATH) {
                    author_url = provider_url + (spec.path || '') + author;
                } else if (spec.type === TYPE.SUBDOMAIN) {
                    author_url = `${scheme + author}.${spec.domain}`;
                }

                return {
                    name: author,
                    provider: spec.provider,
                    provider_url,
                    url: author_url,
                };
            }
        }
    };

    self.populateCommentHistory = function (after, author, thisSubreddit) {
        TB.ui.longLoadNonPersistent(true);

        const user = self.fetched[author],
              $contentBox = user.popup,
              $commentCount = $contentBox.find('.comment-count'),
              $commentCountOp = $contentBox.find('.comment-count-OP'),
              $commentTable = $contentBox.find('.comment-table tbody');

        $commentTable.empty();

        $contentBox.find('.comment-table').show();
        $contentBox.find('.tb-history-comment-stats').show();
        $commentTable.append(`<tr><td colspan="6" class="error">Loading... (${user.counters.comments})</td></tr>`);

        TBApi.getJSON(`/user/${author}/comments.json`, {
            after,
            sort: 'new',
            limit: 100,
        }).catch(() => {
            $commentTable.find('.error').html('unable to load userdata <br /> shadowbanned?');
            TB.ui.longLoadNonPersistent(false);
        }).then(d => {
            if (!d) {
                return;
            }
            TBStorage.purifyObject(d);
            d.data.children.forEach(value => {
                const data = value.data;

                if (!user.subreddits.comments[data.subreddit]) {
                    user.subreddits.comments[data.subreddit] = {count: 0};
                    user.commentSubredditList.push(data.subreddit);
                }

                user.subreddits.comments[data.subreddit].count++;
                user.counters.comments++;

                if (data.link_author === data.author) {
                    user.counters.commentsOP++;
                }
            });

            const after = d.data.after;

            if (after && user.counters.comments < Number(self.setting('commentCount'))) {
                self.populateCommentHistory(after, author, thisSubreddit);
            }

            user.commentSubredditList.sort((a, b) => user.subreddits.comments[b].count - user.subreddits.comments[a].count);

            $commentTable.empty();

            user.commentSubredditList.forEach(subreddit => {
                const count = user.subreddits.comments[subreddit].count,
                      percentage = Math.round(count / user.counters.comments * 100);

                let cssClass = '';
                if (subreddit === thisSubreddit) {
                    cssClass += ' tb-history-row-current-subreddit';
                }

                requestAnimationFrame(() => {
                    $commentTable.append(`
                        <tr class="${cssClass}">
                            <td>${subreddit}</td><td>${count}</td><td>${percentage}</td>
                        </tr>
                    `);
                });
            });
            // `|| 0` to handle NaN
            const percentageOP = Math.round(user.counters.commentsOP / user.counters.comments * 100) || 0;

            $commentCount.html(TBStorage.purify(user.counters.comments));
            $commentCountOp.html(TBStorage.purify(`${user.counters.commentsOP} (${percentageOP}%)`));

            TB.ui.longLoadNonPersistent(false);
        });
    };

    /**
 * Report the use to /r/spam
 */
    self.reportAuthorToSpam = function (author) {
        const user = self.fetched[author],
              $contentBox = user.popup,
              rtsComment = self.setting('rtsComment'),
              $rtsLink = $contentBox.find('.rts-report'),
              rtsNativeLink = $rtsLink.get(0),
              commentBody = rtsNativeLink.getAttribute('data-commentbody');

        rtsNativeLink.textContent = 'Submitting...';
        rtsNativeLink.className = '.rts-report-clicked';

        // Submit to RTS
        const link = `https://www.reddit.com/user/${author}`,
              title = `Overview for ${author}`;

        TBApi.postLink(link, title, self.SPAM_REPORT_SUB).then(submission => {
            if (submission.json.errors.length) {
                $rtsLink.after(`<span class="error" style="font-size:x-small">${submission.json.errors[0][1]}</error>`);
                // $rtsLink.hide();
                if (submission.json.errors[0][0] === 'ALREADY_SUB') {
                    rtsNativeLink.href = TBCore.link(`/r/${self.SPAM_REPORT_SUB}/search?q=http%3A%2F%2Fwww.reddit.com%2Fuser%2F${author}&restrict_sr=on&feature=legacy_search`);
                }
                return;
            }

            // Post stats as a comment.
            if (!commentBody.length || !rtsComment) {
                rtsNativeLink.textContent = 'reported';
                rtsNativeLink.href = submission.json.data.url;
                rtsNativeLink.className = 'tb-general-button';
                return;
            }

            TBApi.postComment(submission.json.data.name, commentBody).then(comment => {
                // $rtsLink.hide();
                if (comment.json.errors.length) {
                    $rtsLink.after(`<span class="error" style="font-size:x-small; cursor: default;">${comment.json.errors[1]}</error>`);
                    // $rtsLink.hide();
                    return;
                }
                rtsNativeLink.textContent = 'reported';
                rtsNativeLink.href = submission.json.data.url;
                rtsNativeLink.className = 'tb-general-button';
            }).catch(error => {
                $rtsLink.after(`<span class="error" style="font-size:x-small; cursor: default;">an error occurred. ${error[0][1]}</span>`);
            });
        }).catch(error => {
            $rtsLink.after(`<span class="error" style="font-size:x-small; cursor: default;">an error occurred: ${error[0][1]}</span>`);
        });
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    historybutton();
}, {
    once: true,
});
