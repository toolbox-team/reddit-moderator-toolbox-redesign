import {Module} from '../tbmodule.js';
import * as TBApi from '../tbapi.js';
import * as TBHelpers from '../tbhelpers.js';
import * as TBCore from '../tbcore.js';

const self = new Module('Removal Reasons');
self.shortname = 'RReasons';

self.settings['enabled']['default'] = true;

self.register_setting('commentReasons', {
    type: 'boolean',
    default: false,
    title: 'Enable removal reasons for comments.',
});
self.register_setting('alwaysShow', {
    type: 'boolean',
    default: false,
    title: 'Show an empty removal reason box for subreddits that don\'t have removal reasons.',
});

// Storage settings.
self.register_setting('reasonType', {
    type: 'selector',
    values: ['Reply with a comment to the item that is removed', 'Send as PM (personal message)', 'Send as both PM and reply', 'None (This only works when a logsub has been set)'],
    default: 'reply',
    title: 'Method of sending removal reasons.',
});

self.register_setting('reasonAsSub', {
    type: 'boolean',
    default: false,
    advanced: false,
    title: 'Send removal reasons as a subreddit. <b>Note:</b> these will appear in modmail and potentially clutter it up.',
});

self.register_setting('reasonAutoArchive', {
    type: 'boolean',
    default: false,
    advanced: false,
    title: 'Auto-archive sent modmail pm. <b>Note:</b> Only works on new modmail.',
});
self.register_setting('reasonSticky', {
    type: 'boolean',
    default: false,
    title: 'Leave removal reasons as a sticky comment.',
});
self.register_setting('actionLock', {
    type: 'boolean',
    default: false,
    title: 'Lock threads after leaving a removal reason.',
});
self.register_setting('actionLockComment', {
    type: 'boolean',
    default: false,
    title: 'Lock removal reasons when replying as a comment.',
});
// Default is escape()'d: <textarea id="customTextarea" placeholder="Enter Custom reason"></textarea>
// May make this a user setting, one day.
self.register_setting('customRemovalReason', {
    type: 'string',
    default: '%3Ctextarea%20id%3D%22customTextarea%22%20%20class%3D%22tb-input%22%20placeholder%3D%22Enter%20Custom%20reason%22%3E%3C/textarea%3E',
    hidden: true,
});

self.init = function () {
    // Check if removal reasons are runnable
    if (TBCore.isModmail) {
        self.log('Disabled because modmail');
        return;
    }

    const $body = $('body');

    // Error texts
    const STATUS_DEFAULT_TEXT = 'saving...',
          APPROVE_ERROR = 'error, failed to approve post',
          FLAIR_ERROR = 'error, failed to flair post',
          NO_REASON_ERROR = 'error, no reason selected',
          NO_REPLY_TYPE_ERROR = 'error, no reply type selected',
          REPLY_ERROR = 'error, failed to post reply',
          PM_ERROR = 'error, failed to send PM',
          MODMAIL_ERROR = 'error, failed to send Modmail',
          MODMAIL_ARCHIVE_ERROR = 'error, failed to archive sent Modmail',
          DISTINGUISH_ERROR = 'error, failed to distinguish reply',
          LOCK_POST_ERROR = 'error, failed to lock post',
          LOCK_COMMENT_ERROR = 'error, failed to lock reply',
          LOG_REASON_MISSING_ERROR = 'error, public log reason missing',
          LOG_POST_ERROR = 'error, failed to create log post';

    // Default texts
    const DEFAULT_SUBJECT = 'Your {kind} was removed from /r/{subreddit}',
          DEFAULT_LOG_TITLE = 'Removed: {kind} by /u/{author} to /r/{subreddit}',
          DEFAULT_BAN_TITLE = '/u/{author} has been banned from /r/{subreddit} for {reason}';

    // Cached data
    const notEnabled = [];

    // Settings.
    const alwaysShow = self.setting('alwaysShow'),
          commentReasons = self.setting('commentReasons');

    //    commentReasons = self.setting('commentReasons');

    // Remote stuff retrieval
    async function getRemovalReasons (subreddit) {
        // Get config for this sub and try to pull removal reasons from there
        const config = await TBCore.getConfig(subreddit);
        if (!config || !config.removalReasons) {
            return false;
        }

        // If we need to get them from another sub, recurse.
        if (config.removalReasons.getfrom && config.removalReasons.getFrom !== subreddit) {
            return getRemovalReasons(config.removalReasons.getfrom);
        }

        return config.removalReasons;
    }

    // UI components
    // UI event handling
    TB.listener.on('post', e => {
        if (e.detail.data.isRemoved && TBCore.pageDetails.pageType !== 'queueListing') {
            const $target = $(e.target);
            $target.append(`<span class="tb-bracket-button tb-add-removal-reason" data-id="${e.detail.data.id}" data-subreddit="${e.detail.data.subreddit.name}">Add removal reason</span>`);
        }
    });
    if (commentReasons) {
        TB.listener.on('comment', e => {
            if (e.detail.data.isRemoved && TBCore.pageDetails.pageType !== 'queueListing') {
                const $target = $(e.target);
                $target.append(`<span class="tb-bracket-button tb-add-removal-reason" data-id="${e.detail.data.id}" data-subreddit="${e.detail.data.subreddit.name}">Add removal reason</span>`);
            }
        });
    }

    // Open reason drop-down when we remove something as ham.
    $('body').on('click', 'button:contains("remove"), button:contains("Confirm removal"), .tb-add-removal-reason, .big-mod-buttons > span > .pretty-button.neutral, .remove-button, .tb-submission-button-remove, .tb-comment-button-remove', function (event) {
        const $button = $(this);
        let thingID,
            thingSubreddit,
            isComment = false; // default to false for new Reddit

        // If the shift key was pressed, remove without a removal reason,
        // unless this is the explicit "Add removal reason" button.
        if (event.shiftKey && !$button.hasClass('tb-add-removal-reason')) {
            return;
        }

        // For now, removals on Toolbox-generated posts/comments work the same way as on old Reddit (without jsAPI)
        if (TBCore.isOldReddit || $button.is('.tb-submission-button-remove, .tb-comment-button-remove')) {
            const $yes = $button.find('.yes')[0],
                  $thing = $button.closest('.thing, .tb-thing');
            isComment = $thing.hasClass('comment') || $thing.hasClass('was-comment') || $thing.hasClass('tb-comment');

            if ($yes) {
                $yes.click();
            }

            thingID = $thing.attr('data-fullname');
            thingSubreddit = $thing.attr('data-subreddit');
        } else {
            if ($button.hasClass('tb-add-removal-reason')) {
                thingID = $button.attr('data-id');
                thingSubreddit = $button.attr('data-subreddit');
                isComment = $button.closest('.tb-frontend-container').data('tb-type') === 'comment';
            } else {
                const $parent = $button.closest('.Post');
                const postDetails = $parent.find('.tb-frontend-container[data-tb-type="post"]').data('tb-details');
                thingID = postDetails.data.id;
                thingSubreddit = postDetails.data.subreddit.name;
            }
        }

        TBCore.getApiThingInfo(thingID, thingSubreddit, false, async info => {
            // Get link/comment attributes
            const data = {
                subreddit: info.subreddit,
                fullname: info.id,
                author: info.user,
                title: info.title,
                kind: info.kind,
                mod: info.mod,
                url: info.permalink,
                link: info.postlink,
                domain: info.domain,
                body: info.body,
                raw_body: info.raw_body,
                uri_body: info.uri_body || encodeURIComponent(info.body),
                uri_title: info.uri_title || encodeURIComponent(info.title),
                reasons: [],
                get reasons_posts () {
                    return this.reasons.filter(r => r.removePosts || r.removePosts === undefined);
                },
                get reasons_comments () {
                    return this.reasons.filter(r => r.removeComments || r.removeComments === undefined);
                },
            };

            // TODO: Dis ain't finished
            // TBApi.getRules(data.subreddit).then(rules => {
            //    self.log('getting rules');
            //    self.log(rules);
            // });

            // Set attributes and open reason box if one already exists for this subreddit
            self.log('Opening popup');
            const $popup = $(`#reason-popup-${data.subreddit}`);
            // If the popup already exists, open it
            if ($popup.length) {
                // Click yes on the removal
                openPopup();
            } else {
                // Otherwise create the popup and open it
                // Get removal reasons.
                let response = await getRemovalReasons(data.subreddit);

                // Removal reasons not enabled
                if (!response || response.reasons.length < 1) {
                    notEnabled.push(data.subreddit);

                    // we're done, unless the user has always show set.
                    if (!alwaysShow) {
                        return;
                    }

                    // Otherwise, setup a completely empty reason.
                    self.log('Using custom reason');

                    const customReasons = {
                        pmsubject: '',
                        logreason: '',
                        header: '',
                        footer: '',
                        logsub: '',
                        logtitle: '',
                        bantitle: '',
                        getfrom: '',
                        reasons: [],
                    };
                    const reason = {
                        text: self.setting('customRemovalReason'),
                        flairText: '',
                        flairCSS: '',
                        title: '',
                    };
                    customReasons.reasons.push(reason);

                    // Set response to our empty reason.
                    response = customReasons;
                }

                // Get PM subject line
                data.subject = TBHelpers.htmlEncode(response.pmsubject) || DEFAULT_SUBJECT;

                // Add additional data that is found in the wiki JSON.
                // Any HTML needs to me unescaped, because we store it escaped in the wiki.
                data.logReason = TBHelpers.htmlEncode(response.logreason) || '';
                data.header = response.header ? TBHelpers.htmlEncode(unescape(response.header)) : '';
                data.footer = response.footer ? TBHelpers.htmlEncode(unescape(response.footer)) : '';
                data.logSub = TBHelpers.htmlEncode(response.logsub) || '';
                data.logTitle = TBHelpers.htmlEncode(response.logtitle) || DEFAULT_LOG_TITLE;
                data.banTitle = TBHelpers.htmlEncode(response.bantitle) || DEFAULT_BAN_TITLE;
                data.removalOption = response.removalOption;
                data.typeReply = response.typeReply;
                data.typeStickied = response.typeStickied;
                data.typeLockComment = response.typeLockComment;
                data.typeAsSub = response.typeAsSub;
                data.autoArchive = response.autoArchive;
                data.typeLockThread = response.typeLockThread;

                // Loop through the reasons... unescaping each.
                data.reasons = [];
                $(response.reasons).each(function () {
                    data.reasons.push({
                        text: unescape(this.text),
                        title: TBHelpers.htmlEncode(this.title),
                        // If it's undefined, it's an old RR - show for both comments and posts
                        removePosts: this.removePosts === undefined ? undefined : !!this.removePosts,
                        removeComments: this.removeComments === undefined ? undefined : !!this.removeComments,
                        flairText: TBHelpers.htmlEncode(this.flairText),
                        flairCSS: TBHelpers.htmlEncode(this.flairCSS),
                        flairTemplateID: this.flairTemplateID === undefined ? '' : this.flairTemplateID,
                    });
                });

                // Only show popup if there's removal reasons
                let removalReasonLength = 0;
                if (isComment) {
                    // get all RR for comments that's True and undefined
                    let commentRemovalReasons = data.reasons_comments;
                    if (!commentReasons) {
                        // user has disabled RR for comments (allow only True)
                        commentRemovalReasons = commentRemovalReasons.filter(r => r.removeComments);
                    }
                    removalReasonLength = commentRemovalReasons.length;
                } else {
                    removalReasonLength = data.reasons_posts.length;
                }

                if (!removalReasonLength) {
                    return;
                }

                // Open popup
                createPopup();
                openPopup();
            }

            function createPopup () {
                self.log('Creating removal reason popup');

                // Options
                const selectNoneDisplay = data.logSub ? '' : 'none', // if there is no {reason} in the title but we still want to only log we'll need that "none" radio button.
                      logDisplay = data.logSub && data.logTitle.indexOf('{reason}') >= 0 ? '' : 'none', // if {reason}  is present we want to fill it.
                      headerDisplay = data.header ? '' : 'none',
                      footerDisplay = data.footer ? '' : 'none',
                      removalOption = data.removalOption,
                      typeReply = data.typeReply,
                      typeStickied = data.typeStickied,
                      typeLockComment = data.typeLockComment,
                      typeAsSub = data.typeAsSub,
                      autoArchive = data.autoArchive,
                      typeLockThread = data.typeLockThread,
                      leaveUpToMods = removalOption === undefined || removalOption === 'leave',
                      forced = removalOption === 'force';

                let reasonType = typeReply;
                if (leaveUpToMods) {
                    switch (self.setting('reasonType')) {
                    case 'reply_with_a_comment_to_the_item_that_is_removed':
                        reasonType = 'reply';
                        break;
                    case 'send_as_pm_(personal_message)':
                        reasonType = 'pm';
                        break;
                    case 'send_as_both_pm_and_reply':
                        reasonType = 'both';
                        break;
                    case 'none_(this_only_works_when_a_logsub_has_been_set)':
                        reasonType = 'none';
                        break;
                    default:
                        reasonType = 'reply';
                        break;
                    }
                }

                const reasonAsSub = leaveUpToMods ? self.setting('reasonAsSub') : typeAsSub;
                const reasonAutoArchive = leaveUpToMods ? self.setting('reasonAutoArchive') : autoArchive;
                const reasonSticky = leaveUpToMods ? self.setting('reasonSticky') : typeStickied;
                const actionLockThread = leaveUpToMods ? self.setting('actionLock') : typeLockThread;
                const actionLockComment = leaveUpToMods ? self.setting('actionLockComment') : typeLockComment;

                // Set up markdown renderer
                SnuOwnd.DEFAULT_HTML_ELEMENT_WHITELIST.push('select', 'option', 'textarea', 'input');
                SnuOwnd.DEFAULT_HTML_ATTR_WHITELIST.push('id', 'placeholder', 'label', 'value');
                const parser = SnuOwnd.getParser(SnuOwnd.getRedditRenderer(SnuOwnd.DEFAULT_BODY_FLAGS | SnuOwnd.HTML_ALLOW_ELEMENT_WHITELIST));

                // Render header and footer
                const headerText = data.header ? parser.render(data.header) : '',
                      footerText = data.footer ? parser.render(data.footer) : '';

                // Make box & add reason radio buttons
                let popup = $(`
                    <div class="reason-popup" id="reason-popup-${data.subreddit}">
                    <attrs />
                    <div class="reason-popup-content">
                    <div class="reason-popup-header">Removal reasons for /r/${data.subreddit}:</div>
                    <div class="reason-popup-innercontent">
                    <p>Removing: <a class="mte-thread-link" href="${data.url}" target="_blank">${TBHelpers.htmlEncode(data.title)}</a></p>
                    <div class="styled-reason" id="header-reason" style="display:${headerDisplay}">
                        <p>
                            <label><input type="checkbox" id="include-header" checked> Include header.</label><br />
                            <label id="reason-header">${headerText}</label>
                        </p>
                    </div>
                    <table id="removal-reasons-table">
                        <thead><tr>
                            <th class="removal-toggle"></th>
                            <th class="reason">reason</th>
                            <th class="flair-text">flair text</th>
                            <th class="flair-css">flair css</th>
                        </tr></thead>
                        <tbody id="reason-table" />
                    </table>
                    <div class="styled-reason" id="footer-reason" style="display:${footerDisplay}">
                        <p>
                            <label><input type="checkbox" id="include-footer" checked> Include footer.</label><br />
                            <label id="reason-footer">${footerText}</label>
                        </p>
                    </div>
                    <div id="buttons">
                    <ul>
                        <li>
                            <input ${forced ? 'disabled' : ''} class="reason-type" type="radio" id="type-reply-${data.subreddit}" value="reply" name="type-${data.subreddit}"${reasonType === 'reply' ? ' checked="1"' : ''} /><label for="type-reply-${data.subreddit}">Reply with a comment to the item that is removed.</label>
                            <ul>
                                <li>
                                    <input ${forced || data.kind !== 'submission' ? 'disabled' : ''} class="reason-sticky" type="checkbox" id="type-stickied"${reasonSticky && data.kind === 'submission' ? 'checked' : ''}/><label for="type-stickied">Sticky the removal comment.</label>
                                </li>
                                <li>
                                    <input ${forced ? 'disabled' : ''} class="action-lock-comment" id="type-action-lock-comment" type="checkbox"${actionLockComment ? 'checked' : ''}/><label for="type-action-lock-comment">Lock the removal comment.</label>
                                </li>
                            </ul>
                        </li>
                        <li>
                            <input ${forced ? 'disabled' : ''} class="reason-type" type="radio" id="type-PM-${data.subreddit}" value="pm" name="type-${data.subreddit}"${reasonType === 'pm' ? ' checked="1"' : ''} /><label for="type-PM-${data.subreddit}">Send as PM (personal message)</label>
                            <ul>
                                <li>
                                    <input ${forced ? 'disabled' : ''} class="reason-as-sub" type="checkbox" id="type-as-sub" ${reasonAsSub ? 'checked ' : ''}/><label for="type-as-sub">Send pm via modmail as /r/${data.subreddit} <b>Note:</b> This will clutter up modmail.</label>
                                </li>
                                <li>
                                    <input ${forced ? 'disabled' : ''} class="reason-auto-archive" type="checkbox" id="type-auto-archive" ${reasonAutoArchive ? 'checked ' : ''}/><label for="type-auto-archive">Auto-archive sent modmail pm <b>Note:</b> Only works on new modmail.</label>
                                </li>
                            </ul>
                        </li>
                        <li>
                            <input ${forced ? 'disabled' : ''} class="reason-type" type="radio" id="type-both-${data.subreddit}" value="both"  name="type-${data.subreddit}"${reasonType === 'both' ? ' checked="1"' : ''} /><label for="type-both-${data.subreddit}">Send as both PM and reply.</label>
                        </li>
                        <li style="display:${selectNoneDisplay}"> /
                            <input ${forced ? 'disabled' : ''} class="reason-type" type="radio" id="type-none-${data.subreddit}" value="none"  name="type-${data.subreddit}"${reasonType === 'none' ? ' checked="1"' : ''} /><label for="type-none-${data.subreddit}">none, will only log the removal.</label>
                        </li>
                        <li>
                            <input ${forced || data.kind !== 'submission' ? 'disabled' : ''} class="action-lock-thread" id="type-action-lock-thread" type="checkbox"${actionLockThread && data.kind === 'submission' ? 'checked' : ''}/><label for="type-action-lock-thread">Lock the removed thread.</label>
                        </li>
                    </ul>
                    </div>
                    <div id="log-reason" style="display:${logDisplay}">
                        <p>Log Reason(s):
                            <input id="log-reason-input" type="text" class="tb-input" name="logReason" value="${data.logReason}" />
                        </p>
                        <p>
                            (Used for posting a log to /r/${data.logSub}. Will only be used when "send" is clicked.) </label>
                        </p>
                    </div>
                    </div>
                    <div class="reason-popup-footer">
                    <input type="hidden" name="tom_or_not" value="no-tom">
                    <span class="status error" style="display:none">This is an easter egg.</span>
                    <button class="save tb-action-button">send</button>
                    <button class="no-reason tb-action-button">no reason</button>
                    <button class="cancel tb-action-button">cancel and approve</button>
                    </div>
                    </div>
                    </div>`);

                popup = $(popup).appendTo('body').find('attrs').attr(data).end();

                let reasons = [];
                if (isComment) {
                    if (commentReasons) {
                        // show reasons with 'true' and 'undefined' for comments
                        reasons = data.reasons_comments;
                    } else {
                        // show reasons with only 'true' for comments
                        reasons = data.reasons_comments.filter(r => r.removeComments === true);
                    }
                } else {
                    reasons = data.reasons_posts;
                }

                // Render reasons and add to popup
                $(reasons).each(function (index) {
                    const reasonMarkdown = `${this.text}\n\n`;
                    const reasonHtml = parser.render(reasonMarkdown);

                    const tr = $(`
                    <tr class="selectable-reason">
                    <td class="removal-toggle">
                    <input type="checkbox" class="reason-check" name="reason-${data.subreddit}" id="reason-${data.subreddit}-${index}" />
                    <div class="reason-num">${index + 1}</div>
                    </td>
                    <td class="reason">
                    <div class="removal-reason-title">${this.title ? this.title : ''}</div>
                    <div class="styled-reason reason-content ${data.subreddit}-${index}">${reasonHtml}<br /></div>
                    </td>
                    <td class="flair-text"><span class="flair-text-span">${this.flairText ? this.flairText : ''}</span></td>
                    <td class="flair-css"><span class="flair-css-span">${this.flairCSS ? this.flairCSS : ''}</span></td>
                    </tr>`);

                    tr.data({
                        reasonId: index,
                        reasonMarkdown,
                        title: this.title,
                        flairText: this.flairText,
                        flairCSS: this.flairCSS,
                        flairTemplateID: this.flairTemplateID,
                    });

                    if (this.title) {
                        tr.find('.styled-reason.reason-content').hide();
                        tr.find('.flair-text-span').hide();
                        tr.find('.flair-css-span').hide();
                    } else {
                        tr.find('.removal-reason-title').remove();
                    }

                    popup.find('#reason-table').append(tr);
                });

                // Pre-fill reason input elements which have IDs.
                popup.find('.reason-content input[id], .reason-content textarea[id]').each(async function () {
                    this.id = `reason-input-${data.subreddit}-${this.id}`;
                    this.value = await TB.storage.getCache('RReasons', this.id, this.value);
                });
            }

            function openPopup () {
                // Reset state
                $popup.find('attrs').attr(data);
                $popup.find('.selectable-reason input[type=checkbox]:checked').prop('checked', false);
                $popup.find('.selectable-reason.reason-selected').removeClass('reason-selected');
                $popup.find('.status').hide();// css('display: none;');
                $popup.find('.error-highlight').removeClass('error-highlight');
                $popup.find('.mte-thread-link').attr('href', data.url).text(data.title);

                // Open popup
                /* popup.css({
                    display: ''
                    });*/
                $popup.show();
                $body.css('overflow', 'hidden');
            }
        });
    });

    // Popup events
    function removePopup (popup) {
        popup.remove();
        $body.css('overflow', 'auto');
    }

    $body.on('click', '.reason-popup', e => {
        e.stopPropagation();
    });

    // Selection/deselection of removal reasons
    $body.on('click', '.selectable-reason', function (e) {
        const $this = $(this);
        const checkBox = $this.find('.reason-check'),
              isChecked = checkBox.is(':checked'),
              targetIsCheckBox = $(e.target).is('.reason-check');
        const hasTitle = $this.find('.removal-reason-title').length;

        if (!isChecked && !targetIsCheckBox) {
            $this.addClass('reason-selected');
            checkBox.prop('checked', true);
            if (hasTitle > 0) {
                $this.find('.reason-content').show();
                $this.find('.flair-text-span').show();
                $this.find('.flair-css-span').show();
            }
        } else if (isChecked && targetIsCheckBox) {
            $this.addClass('reason-selected');
            if (hasTitle > 0) {
                $this.find('.reason-content').show();
                $this.find('.flair-text-span').show();
                $this.find('.flair-css-span').show();
            }
        } else if (!isChecked && targetIsCheckBox) {
            $this.removeClass('reason-selected');
            if (hasTitle > 0) {
                $this.find('.reason-content').hide();
                $this.find('.flair-text-span').hide();
                $this.find('.flar-css-span').hide();
            }
        }
    });

    // 'no reason' button clicked
    $body.on('click', '.reason-popup .no-reason', function () {
        const popup = $(this).parents('.reason-popup');
        removePopup(popup);
    });

    // 'cancel' button clicked
    $body.on('click', '.reason-popup .cancel', function () {
        const popup = $(this).parents('.reason-popup'),
              status = popup.find('.status'),
              attrs = popup.find('attrs');

        TBApi.approveThing(attrs.attr('fullname')).then(() => {
            removePopup(popup);
        }).catch(() => {
            status.text(APPROVE_ERROR);
        });
    });

    // 'save' button clicked
    $body.on('click', '.reason-popup .save', function () {
        const popup = $(this).parents('.reason-popup'),
              notifyBy = popup.find('.reason-type:checked').val(),
              notifyAsSub = popup.find('.reason-as-sub').prop('checked'),
              autoArchive = popup.find('.reason-auto-archive').prop('checked'),
              notifySticky = popup.find('.reason-sticky').prop('checked'),
              actionLockThread = popup.find('.action-lock-thread').prop('checked'),
              actionLockComment = popup.find('.action-lock-comment').prop('checked'),
              checked = popup.find('.reason-check:checked'),
              status = popup.find('.status'),
              attrs = popup.find('attrs'),
              header = TBHelpers.htmlDecode(attrs.attr('header')),
              footer = TBHelpers.htmlDecode(attrs.attr('footer')),
              logReason = popup.find('#log-reason-input').val(),
              data = {
                  subreddit: '',
                  fullname: '',
                  author: '',
                  title: '',
                  kind: '',
                  mod: '',
                  url: '',
                  link: '',
                  domain: '',
                  logSub: '',
                  body: '',
                  raw_body: '',
                  uri_body: '',
                  uri_title: '',
              };
        let subject = attrs.attr('subject'),
            logTitle = attrs.attr('logTitle');

        // Update status
        status.text(STATUS_DEFAULT_TEXT);
        status.show();
        popup.find('.error-highlight').removeClass('error-highlight');

        // Check if reason checked
        const noneSelected = $('body').find('.reason-type:checked').val();
        if (!checked.length && noneSelected !== 'none') {
            popup.find('#reason-table').addClass('error-highlight');
            return status.text(NO_REASON_ERROR);
        }

        // Get custom reason input
        const markdownReasons = [];
        const customInput = [];
        let flairText = '', flairCSS = '', flairTemplateID = '';

        checked.closest('.selectable-reason').each(function () {
            const $this = $(this);
            // Get markdown-formatted reason
            const markdownReason = $this.data('reasonMarkdown');
            markdownReasons.push(markdownReason);

            // Get input from HTML-formatted reason
            const htmlReason = $this.find('.reason-content');
            htmlReason.find('select, input, textarea').each(function () {
                customInput.push(this.value || '');
            });

            // Get flair data
            if ($this.data('flairText')) {
                flairText += ` ${$this.data('flairText')}`;
            }
            if ($this.data('flairCSS')) {
                flairCSS += ` ${$this.data('flairCSS')}`;
            }
            if ($this.data('flairTemplateID')) {
                flairTemplateID = $this.data('flairTemplateID');
            }
        });

        // Generate reason text
        let reason = '';

        // // Add response body
        let customIndex = 0;
        markdownReasons.forEach(markdownReason => {
            $(`<div>${markdownReason}</div>`).contents().each(function () {
                // If an element, check for conversions
                if (this.nodeType === Node.ELEMENT_NODE) {
                    switch (this.tagName.toLowerCase()) {
                    // Convert breaks to lots of newlines
                    case 'br':
                        reason += '\n\n';
                        break;

                        // Convert input elements to custom input (stored in order)
                    case 'select':
                    case 'input':
                    case 'textarea':
                        reason += customInput[customIndex++];
                        break;
                    }
                } else if (this.nodeType === Node.TEXT_NODE) {
                    // If a text node, get content
                    reason += this.textContent;
                }
            });
        });

        // See if any of the reasons actually have text.
        const reasonlength = reason.trim().length;

        // // Add header if selected
        if (popup.find('#include-header').is(':checked')) {
            reason = `${header}\n\n${reason}`;
        }

        // // Add footer if selected
        if (popup.find('#include-footer').is(':checked')) {
            reason += `\n\n${footer}`;
        }

        // // Convert attribs back to data.
        for (const i of Object.keys(data)) {
            data[i] = attrs.attr(i);
        }

        reason = TBHelpers.replaceTokens(data, reason);
        subject = TBHelpers.replaceTokens(data, subject);
        logTitle = TBHelpers.replaceTokens(data, logTitle);

        TBCore.getApiThingInfo(data.fullname, data.subreddit, false, ({ham}) => {
            if (!ham) {
                TBApi.removeThing(data.fullname);
            }
        });

        // // Clean up reason
        reason = reason.trim();

        // Flair post if required
        flairText = flairText.trim();
        flairCSS = flairCSS.trim();
        if ((flairText !== '' || flairCSS !== '') && data.kind !== 'comment') {
            TBApi.flairPost(data.fullname, data.subreddit, flairText, flairCSS, flairTemplateID).catch(() => {
                status.text(FLAIR_ERROR);
            });
        }

        // If logSub is not empty, log the removal and send a PM/comment
        if (data.logSub) {
            // Finalize log reasons
            if (logTitle.indexOf('{reason}') >= 0) {
                // Check if a log reason is selected
                if (!logReason) {
                    popup.find('#log-reason-input').addClass('error-highlight');
                    return status.text(LOG_REASON_MISSING_ERROR);
                }

                // Set log reason to entered reason
                logTitle = logTitle.replace('{reason}', logReason);
            }

            // Submit log post
            TBApi.postLink(data.url || data.link, TBHelpers.removeQuotes(logTitle), data.logSub).then(response => {
                const logThingId = response.json.data.name,
                      loglinkToken = response.json.data.url;
                TBApi.approveThing(logThingId);

                if (noneSelected === 'none') {
                    removePopup(popup);
                } else {
                    sendRemovalMessage(loglinkToken);
                }
            }).catch(() => {
                status.text(LOG_POST_ERROR);
            });
        } else {
            // Otherwise only send PM and/or comment
            sendRemovalMessage(null);
        }

        // Function to send PM and comment
        function sendRemovalMessage (logLink) {
            TBCore.getModSubs().then(async () => {
                // If there is no message to send, don't send one.
                if (reasonlength < 1) {
                    if ((flairText !== '' || flairCSS !== '') && data.kind !== 'comment') {
                        // We'll flair only flair, we are done here.
                        return removePopup(popup);
                    } else {
                        return status.text(NO_REASON_ERROR);
                    }
                }

                // Check if a valid notification type is selected
                if (!notifyBy && !notifyAsSub || logLink == null && notifyBy === 'none') {
                    popup.find('#buttons').addClass('error-highlight');
                    return status.text(NO_REPLY_TYPE_ERROR);
                }

                // Finalize the reason with optional log post link
                if (typeof logLink !== 'undefined') {
                    reason = reason.replace('{loglink}', logLink);
                }

                // Lock thread if requested
                if (actionLockThread) {
                    self.log(`Fullname of this link: ${data.fullname}`);
                    try {
                        await TBApi.lock(data.fullname);
                    } catch (error) {
                        self.error(`error locking ${data.fullname}:`, error);
                        return status.text(LOCK_POST_ERROR);
                    }
                }

                const subredditData = window.TBCore.mySubsData.find(s => s.subreddit === data.subreddit),
                      notifyByPM = notifyBy === 'pm' || notifyBy === 'both',
                      notifyByReply = notifyBy === 'reply' || notifyBy === 'both',
                      notifyByNewModmail = notifyByPM && notifyAsSub && autoArchive && subredditData && subredditData.is_enrolled_in_new_modmail;

                // Reply to submission/comment
                if (notifyByReply) {
                    self.log('Sending removal message by comment reply.');
                    TBApi.postComment(data.fullname, reason).then(response => {
                        if (response.json.errors.length > 0) {
                            status.text(`${REPLY_ERROR}: ${response.json.errors[0][1]}`);
                        } else {
                            // Distinguish the new reply, stickying if necessary
                            TBApi.distinguishThing(response.json.data.things[0].data.id, notifySticky).then(() => {
                                if (notifyByNewModmail) {
                                    sendNewModmail();
                                } else if (notifyByPM) {
                                    sendPM();
                                } else {
                                    removePopup(popup);
                                }
                            }).catch(() => {
                                status.text(DISTINGUISH_ERROR);
                            });

                            // Lock reply if requested
                            if (actionLockComment) {
                                const commentId = response.json.data.things[0].data.id;
                                self.log(`Fullname of reply: ${commentId}`);
                                TBApi.lock(commentId).then(() => {
                                    removePopup(popup);
                                }).catch(() => {
                                    status.text(LOCK_COMMENT_ERROR);
                                });
                            }
                        }
                    }).catch(() => {
                        status.text(REPLY_ERROR);
                    });
                } else if (notifyByNewModmail) {
                    sendNewModmail();
                } else if (notifyByPM) {
                    sendPM();
                }

                // Send PM the user
                function sendPM () {
                    const text = `${reason}\n\n---\n[[Link to your ${data.kind}](${data.url})]`;

                    self.log('Sending removal message by PM');
                    TBApi.sendMessage(data.author, subject, text, notifyAsSub ? data.subreddit : undefined).then(() => {
                        removePopup(popup);
                    }).catch(() => {
                        status.text(PM_ERROR);
                    });
                }

                function sendNewModmail () {
                    const body = `${reason}\n\n---\n[[Link to your ${data.kind}](${data.url})]`;

                    self.log('Sending removal message by New Modmail');
                    TBApi.apiOauthPOST('/api/mod/conversations', {to: data.author, isAuthorHidden: true, subject, body, srName: data.subreddit}).then(res => {
                        res.json().then(data => {
                            const id = data.conversation.id;
                            // isInternal means mod conversation - can't archive that
                            const isInternal = data.conversation.isInternal;
                            if (autoArchive && !isInternal) {
                                TBApi.apiOauthPOST(`/api/mod/conversations/${id}/archive`).then(() => {
                                    removePopup(popup);
                                });
                            } else {
                                removePopup(popup);
                            }
                        }).catch(() => {
                            status.text(MODMAIL_ARCHIVE_ERROR);
                            // Disable Send button as we already sent modmail successfully - avoids multiple modmails
                            $('.save.tb-action-button').prop('disabled', true);
                        });
                    }).catch(() => {
                        status.text(MODMAIL_ERROR);
                    });
                }
            });
        }
    });

    // Reason textarea/input/select changed
    $body.on('change', '.reason-popup td input[id],.reason-popup td textarea[id],.reason-popup td select[id]', function () {
        TB.storage.setCache('RReasons', this.id, this.selectedIndex || this.value);
    });
};

export default self;
