'use strict';

const MAX_BAN_REASON_LENGTH = 300;
const MAX_BAN_MESSAGE_LENGTH = 1000;

function modbutton () {
    const self = new TB.Module('Mod Button');
    self.shortname = 'ModButton';

    self.settings['enabled']['default'] = true;

    self.register_setting('savedSubs', {
        type: 'sublist',
        default: [],
        title: 'Saved subs (for quick access)',
    });

    self.register_setting('rememberLastAction', {
        type: 'boolean',
        default: false,
        title: 'Remember last action',
    });
    self.register_setting('globalButton', {
        type: 'boolean',
        default: false,
        advanced: true,
        title: 'Enable Global Action button',
    });
    self.register_setting('excludeGlobal', {
        type: 'sublist',
        default: [],
        advanced: true,
        title: 'Exclude subs from Global Actions',
        hidden: !self.setting('globalButton'),
    });

    self.register_setting('onlyshowInhover', {
        type: 'boolean',
        default: TB.storage.getSetting('GenSettings', 'onlyshowInhover', true),
        hidden: true,
    });

    // private storage
    self.register_setting('lastAction', {
        type: 'text',
        default: 'ban',
        hidden: true,
    });

    const $body = $('body'),
          titleText = 'Perform various mod actions on this user';

    self.runRedesign = function () {
        // Not a mod, don't bother.
        if (TBCore.mySubs.length < 1) {
            return;
        }
        const onlyshowInhover = self.setting('onlyshowInhover');

        TB.listener.on('author', e => {
            const $target = $(e.target);

            // As the modbutton is already accessible in the sidebar and not needed for mods we don't show it in modmail threads.
            if (e.detail.type === 'TBmodmailCommentAuthor') {
                return;
            }
            if ($target.closest('.tb-thing').length || !onlyshowInhover || TBCore.isOldReddit || TBCore.isNewModmail) {
                const subreddit = e.detail.data.subreddit.name;
                const author = e.detail.data.author;

                let parentID;
                if (e.detail.data.comment) {
                    parentID = e.detail.data.comment.id;
                } else if (e.detail.data.post) {
                    parentID = e.detail.data.post.id;
                } else {
                    parentID = 'unknown';
                }
                requestAnimationFrame(() => {
                    $target.append(`<a href="javascript:;" title="${titleText}" data-subreddit="${subreddit}" data-author="${author}" data-parentID="${parentID}" class="global-mod-button tb-bracket-button">M</a>`);
                });
            }
        });

        // event based handling of author elements.
        TB.listener.on('userHovercard', e => {
            const $target = $(e.target);
            const subreddit = e.detail.data.subreddit.name;
            const author = e.detail.data.user.username;
            const parentID = e.detail.data.contextId;

            $target.append(`<a href="javascript:;" title="${titleText}" data-subreddit="${subreddit}" data-author="${author}" data-parentID="${parentID}" class="global-mod-button tb-bracket-button">Mod Button</a>`);
        });
    };

    /**
     *  updates the current savedsubs' listings in the mod button
     */
    self.updateSavedSubs = function () {
    //
    // Refresh the settings tab and role tab sub dropdowns and saved subs tabls
    //
        const $popups = $body.find('.mod-popup'),
              $savedSubsLists = $popups.find('.saved-subs');

        // clear out the current stuff
        $savedSubsLists.html('');

        // add our saved subs to the "remove saved subs" dropdown on the setting tab
        // and to the saved subs savedSubsList on the role tab
        $popups.each(function () {
            const $popup = $(this),
                  $savedSubsList = $popup.find('.saved-subs'),
                  currentSub = $popup.find('.subreddit').text();

            // repopulate the saved sub dropdowns with all the subs we mod
            $popup.find('.edit-subreddits .savedSubs').remove();
            $popup.find('.edit-subreddits').prepend(TB.ui.selectMultiple(TBCore.mySubs, self.savedSubs).addClass('savedSubs'));

            self.savedSubs.forEach(subreddit => {
                // only subs we moderate
                // and not the current sub
                if (TBCore.modsSub(subreddit) && subreddit !== currentSub) {
                    $savedSubsList.append(`<div><input type="checkbox" class="action-sub" name="action-sub" value="${subreddit
                    }" id="action-${subreddit}"><label for="action-${subreddit}">&nbsp;&nbsp;/r/${subreddit}</label></div>`);
                }
            });
        });

        TBCore.mySubs.forEach(subreddit => {
            $popups.find(`select.${self.OTHER}`).append(`<option value="${subreddit}">${subreddit}</option>`);
        });
    };

    self.init = function () {
        self.saveButton = 'Save';
        self.OTHER = 'other-sub';

        self.savedSubs = self.setting('savedSubs');

        const rememberLastAction = self.setting('rememberLastAction'),
              showglobal = self.setting('globalButton'),
              excludeGlobal = self.setting('excludeGlobal');

        self.savedSubs = TBHelpers.saneSort(self.savedSubs);

        TBCore.getModSubs(() => {
        // it's Go Time™!
            self.runRedesign();
        });

        async function openModPopup (event, info) {
            const benbutton = event.target; // huehuehue
            const $benbutton = $(benbutton);
            self.log('displaying mod button popup');

            const lastaction = self.setting('lastAction');

            const subreddit = info.subreddit,
                  user = info.user,
                  thing_id = info.id;

            // $.log('modbutton ' + subreddit, true);

            // no user?
            if (!user) {
                TB.ui.textFeedback('No user', TB.ui.FEEDBACK_NEGATIVE);
                // abort
                return;
            }

            // generate the .mod-popup jQuery object

            // We want to make sure windows fit on the screen.
            const positions = TBui.drawPosition(event);

            const $overlay = $benbutton.closest('.tb-page-overlay');
            let $appendTo;
            if ($overlay.length) {
                $appendTo = $overlay;
            } else {
                $appendTo = $('body');
            }

            const $popup = TB.ui.popup({
                title: `Mod Actions  - /u/${user}`,
                tabs: [
                    {
                        title: 'Role',
                        id: 'user-role', // reddit has things with class .role, so it's easier to do this than target CSS
                        tooltip: 'Add or remove user from subreddit ban, contributor, and moderator lists.',
                        content: `${subreddit
                            ? `
                <div class="current-sub">
                    <input type="checkbox" class="action-sub" name="action-sub" value="${subreddit}" id="action-${subreddit}" checked>
                    <label for="action-${subreddit}">&nbsp;&nbsp;/r/${subreddit} (current)</label>
                </div>`
                            : ''
                        }
                <div class="saved-subs">
                </div>
                <div class="other-subs">
                    <input type="checkbox" class="action-sub ${self.OTHER}-checkbox name="action-sub" value="${self.OTHER}">
                    <select class="${self.OTHER} tb-action-button inline-button" for="action-${self.OTHER}"><option value="${self.OTHER}">(select subreddit)</option></select>
                </div>
                <div class="ban-note-container"><input id="ban-note" class="ban-note tb-input" type="text" placeholder="(ban note)" maxlength="${MAX_BAN_REASON_LENGTH}"></input><br>
                <textarea name="ban-message" class="tb-input ban-message" placeholder="(ban message to user)" maxlength="${MAX_BAN_MESSAGE_LENGTH}"></textarea><br>
                <input type="number" min="1" max="999" name="ban-duration"  class="ban-duration tb-input" placeholder="time (days)">
                </div>`,
                        footer: `
                <span class="status error left"></span>
                <select class="mod-action tb-action-button">
                    <option class="mod-action-negative" data-action="banned" data-api="friend">ban</option>
                    <option class="mod-action-positive" data-action="banned" data-api="unfriend">unban</option>
                    <option class="mod-action-positive" data-action="contributor" data-api="friend">add submitter</option>
                    <option class="mod-action-negative" data-action="contributor" data-api="unfriend" >remove submitter</option>
                    <option class="mod-action-positive" data-action="moderator" data-api="friend">mod</option>
                    <option class="mod-action-negative" data-action="moderator" data-api="unfriend" >demod</option>
                </select>
                <button class="save tb-action-button">${self.saveButton}</button>
                <button title="Global Action (perform action on all subs)" class="tb-action-button global-button inline-button"${showglobal ? '' : 'style="display:none!important;"'}>Global Action</button>`,
                    },
                    {
                        title: 'User Flair',
                        tooltip: 'Edit User Flair.',
                        content: `
                    <p style="clear:both;" class="mod-popup-flair-input"><label for="flair-text" class="mod-popup-flair-label">Text:</label><input id="flair-text" class="flair-text tb-input" type="text"></input></p>
                    <p style="clear:both;" class="mod-popup-flair-input"><label for="flair-class" class="mod-popup-flair-label">Class:</label><input id="flair-class" class="flair-class tb-input" type="text"></input></p>`,
                        footer: `
                <span class="status error left"></span>
                <button class="flair-save tb-action-button">Save Flair</button>`,
                    },
                    {
                        title: 'Send Modmail',
                        tooltip: 'Send a modmail to the user.',
                        content: `
                    <input id="subreddit-message-subject" class="subreddit-message-subject tb-input" type="text" placeholder="(subject)" maxlength="100"></input><br>
                    <textarea name="subreddit-message" class="tb-input subreddit-message" placeholder="(message to user)" ></textarea><br>
                    <span id="subreddit-message-callback"></span>
                    `,
                        footer: `
                <span class="status error left"></span>
                <button class="message-send tb-action-button">Send as /r/${subreddit}</button>`,
                    },
                ],
                cssClass: 'mod-popup',
                meta: `<label class="user">${user}</label><label class="subreddit">${subreddit}</label><label class="thing_id">${thing_id}</label>`,
            }).appendTo($appendTo)
                .css({
                    left: positions.leftPosition,
                    top: positions.topPosition,
                    display: 'block',
                });
            const $actionSelect = $popup.find('.mod-action');

            // Set the action before setting up the initial interface
            if (rememberLastAction) {
                $actionSelect.val(lastaction);
            }

            // If we're not banning someone, we don't need these
            if ($actionSelect.val() !== 'ban') {
                $popup.find('.ban-note').hide();
                $popup.find('textarea.ban-message').hide();
                $popup.find('.ban-duration').hide();
                $popup.find('.ban-span-include-time').hide();
            }

            // If we're doing global actions, add the button for that
            // (there's a display none in the style attribute if this is disabled)
            if (showglobal) {
                const $globalButton = $popup.find('.global-button');

                // unless we're doing a ban, because global bans are evil
                if ($actionSelect.val() === 'ban') {
                    $globalButton.addClass('action-hidden');
                }
                $actionSelect.change(function () {
                    if (this.value === 'ban') {
                        $globalButton.addClass('action-hidden');
                    } else {
                        $globalButton.removeClass('action-hidden');
                    }
                });
            }

            // Remove options that only apply to subs we mod
            if (!subreddit) {
            // Hide the flair tab and message tab
            // TODO: add a "disabled" state, with tooltip, and use that instead
            // We can only edit flair in the current sub.
                $popup.find('.tb-window-tabs .user_flair').remove();
                $popup.find('.tb-window-tabs .send_message').remove();
            }

            // get pre-definded ban message/note
            if (subreddit) {
                self.log('getting ban macros');
                TBCore.getConfig(subreddit, config => {
                    if (!config || !config.banMacros) {
                        return;
                    }
                    const macros = config.banMacros;
                    if (macros.banNote) {
                        self.log(macros.banNote);
                        $popup.find('.ban-note').val(TBHelpers.replaceTokens(info, macros.banNote));
                    }
                    if (macros.banMessage) {
                        self.log(macros.banMessage);
                        $popup.find('.ban-message').val(TBHelpers.replaceTokens(info, macros.banMessage));
                    }
                });
            }

            // only works if we're a mod of the sub in question
            if (subreddit) {
                let user_fullname = ''; // type t2_xxx

                // Show if current user is banned, and why. - thanks /u/LowSociety
                // TODO: Display *when* they were banned, along with ban note. #194
                // TODO: Use TBApi.getBanState()
                const data = await TBApi.getJSON(`/r/${subreddit}/about/banned/.json`, {user});
                TBStorage.purifyObject(data);
                const banned = data.data.children;
                for (let i = 0; i < banned.length; i++) {
                    if (banned[i].name.toLowerCase() === user.toLowerCase()) {
                        user_fullname = banned[i].id; // we need this to extract data from the modlog

                        const timestamp = new Date(banned[i].date * 1000); // seconds to milliseconds

                        $popup.find('.current-sub').append($('<div class="already-banned">banned by <a href="#"></a> </div>'));
                        $popup.find('.current-sub .already-banned').append($('<time>').attr('datetime', timestamp.toISOString()).timeago());

                        $popup.find('select.mod-action option[data-api=unfriend][data-action=banned]').attr('selected', 'selected');
                        $popup.find('.ban-note').val(banned[i].note);
                        $popup.find('.tb-window-title').css('color', 'red');

                        // get the mod who banned them (need to pull request to get this in the banlist data to avoid this kind of stupid request)
                        const logData = await TBApi.getJSON(`/r/${subreddit}/about/log/.json`, {
                            type: 'banuser',
                            limit: '1000',
                        });
                        TBStorage.purifyObject(logData);
                        const logged = logData.data.children;
                        for (let i = 0; i < logged.length; i++) {
                            if (logged[i].data.target_fullname === user_fullname) {
                                $popup.find('.current-sub .already-banned a').attr('href', `/u/${logged[i].data.mod}`).text(logged[i].data.mod);
                                break;
                            }
                        }
                        break;
                    }
                }
            }

            // if we're on the mod page, it's likely we want to mod them to another sub.
            // unselect current, change action to 'mod'.
            if (location.pathname.match(/\/about\/(?:moderator)\/?/)) {
                $popup.find('select.mod-action option[data-api=friend][data-action=moderator]').attr('selected', 'selected');
                $popup.find('.ban-note').hide();
                $popup.find('.action-sub:checkbox:checked').removeAttr('checked');

                $popup.find('textarea.ban-message').hide();
                $popup.find('.ban-duration').hide();
                $popup.find('.ban-span-include-time').hide();
            } else if (location.pathname.match(/\/about\/(?:contributors)\/?/)) {
                $popup.find('select.mod-action option[data-api=friend][data-action=contributor]').attr('selected', 'selected');
                $popup.find('.ban-note').hide();
                $popup.find('.action-sub:checkbox:checked').removeAttr('checked');

                $popup.find('textarea.ban-message').hide();
                $popup.find('.ban-duration').hide();
                $popup.find('.ban-span-include-time').hide();
            }

            // render the saved subs lists
            self.updateSavedSubs();

            // custom sub changed.
            $popup.find(`select.${self.OTHER}`).change(function () {
                $popup.find(`.${self.OTHER}-checkbox`).prop('checked', $(this).val() !== self.OTHER);
            });

            // show/hide ban reason text feild.
            $actionSelect.change(function () {
                const $banNote = $popup.find('.ban-note'),
                      $banMessage = $popup.find('textarea.ban-message'),
                      $banDuration = $popup.find('.ban-duration'),
                      $banIncludeTime = $popup.find('.ban-span-include-time');
                if ($(this).val() === 'ban') {
                    $banNote.show();
                    $banMessage.show();
                    $banDuration.show();
                    $banIncludeTime.show();
                } else {
                    $banNote.hide();
                    $banMessage.hide();
                    $banDuration.hide();
                    $banIncludeTime.hide();
                }
            });

            // 'cancel' button clicked
            $popup.on('click', '.close', () => {
                $popup.remove();
            });
        }

        // Mod button clicked
        $body.on('click', '.global-mod-button', function (event) {
            const benbutton = event.target; // huehuehue
            const $benbutton = $(benbutton);

            if (TBCore.isNewModmail) {
                const info = TBCore.getThingInfo(this, true);
                openModPopup(event, info);
            } else {
                const subreddit = $benbutton.attr('data-subreddit');
                const id = $benbutton.attr('data-parentID');
                const author = $benbutton.attr('data-author');

                if (id === 'unknown') {
                    const info = {
                        subreddit,
                        user: author,
                        author,
                        permalink: location.href,
                        url: location.href,
                        domain: '',
                        id,
                        body: '>',
                        raw_body: '',
                        uri_body: '',
                        approved_by: '',
                        title: '',
                        uri_title: '',
                        kind: 'comment',
                        postlink: '',
                        link: '',
                        banned_by: '',
                        spam: '',
                        ham: '',
                        rules: subreddit ? TBCore.link(`/r/${subreddit}/about/rules`) : '',
                        sidebar: subreddit ? TBCore.link(`/r/${subreddit}/about/sidebar`) : '',
                        wiki: subreddit ? TBCore.link(`/r/${subreddit}/wiki/index`) : '',
                        mod: TBCore.logged,
                    };
                    openModPopup(event, info);
                } else {
                    TBCore.getApiThingInfo(id, subreddit, true, info => {
                        openModPopup(event, info);
                    });
                }
            }

            return false;
        });

        // 'save' button clicked...  THIS IS WHERE WE BAN PEOPLE, PEOPLE!
        $body.on('click', '.mod-popup .save, .global-button', function () {
            const $button = $(this),
                  $popup = $button.parents('.mod-popup'),
                  $selected = $popup.find('.mod-action :selected'),
                  api = $selected.attr('data-api'),
                  action = $selected.attr('data-action'),
                  actionName = $selected.val(),
                  settingState = api === 'friend',
                  $status = $popup.find('.status'),
                  banReason = $popup.find('.ban-note').val(),
                  banDuration = $popup.find('.ban-duration').val(),
                  banContext = $popup.find('.thing_id').text(),
                  subreddits = [],
                  user = $popup.find('.user').text();

            const banMessage = $popup.find('textarea.ban-message').val();

            self.setting('lastAction', actionName);

            if (banReason.length > MAX_BAN_REASON_LENGTH) {
                return $status.text(`error, ban note is ${banReason.length - MAX_BAN_REASON_LENGTH} characters over limit`);
            }
            if (banMessage.length > MAX_BAN_MESSAGE_LENGTH) {
                return $status.text(`error, ban message is ${banMessage.length - MAX_BAN_MESSAGE_LENGTH} characters over limit`);
            }

            // Check dem values.
            if (!api) {
                return $status.text('error, no action selected');
            }

            if (!$(this).hasClass('global-button')) {
                // Get dem ban subs.
                $popup.find('.action-sub:checkbox:checked').each(function () {
                    let subname = $(this).val();
                    if (subname !== self.OTHER) {
                        subreddits.push(subname);
                    } else {
                        subname = $(`.${self.OTHER} option:selected`).val();
                        if (subname !== self.OTHER) {
                            subreddits.push(subname);
                        }
                    }
                });

                // Check dem values.
                if (subreddits.length < 1) {
                    return $status.text('error, no subreddits selected');
                }

                // do it.
                massAction(subreddits);
            } else {
                if (actionName === 'ban') {
                    $status.text('Yeah...not happening');
                } else {
                    let confirmban;
                    if (actionName === 'unban') {
                        confirmban = confirm(`This will ${actionName} /u/${user} from every subreddit you moderate.   \nAre you sure?`);
                    } else {
                        confirmban = confirm(`This will ${actionName} /u/${user} on every subreddit you moderate.   \nAre you sure?`);
                    }

                    if (confirmban) {
                        const subs = TBCore.mySubs;
                        excludeGlobal.forEach(val => {
                            subs.splice(subs.indexOf(val), 1);
                        });
                        massAction(subs);
                    }
                }
            }

            function completeCheck (failedSubs) {
                const failed = failedSubs.length;
                self.log(`${failed} subs failed`);
                if (failed > 0) {
                    self.log(`${failed} subs failed`);
                    const retry = confirm(`Action complete, however ${failed} failed.  Would you like to retry these?`);
                    if (retry) {
                        self.log('retrying');
                        massAction(failedSubs);
                    } else {
                        self.log('not retrying');
                        $('.mod-popup').remove();
                    }
                } else {
                    self.log('complete');
                    $('.mod-popup').remove();
                    // TB.ui.textFeedback('Mod actions complete' + subreddit, TB.ui.FEEDBACK_POSITIVE);
                }
            }

            function massAction (subs) {
                const failedSubs = [];

                TB.ui.longLoadSpinner(true, 'Performing mod action', TB.ui.FEEDBACK_NEUTRAL);

                TBCore.forEachChunkedRateLimit(
                    subs, 20, subreddit => {
                        TB.ui.textFeedback(`${actionName}ning /u/${user} from /r/${subreddit}`, TB.ui.FEEDBACK_POSITIVE);

                        self.log(`banning from: ${subreddit}`);
                        if (settingState) {
                            TBApi.friendUser({
                                user,
                                action,
                                subreddit,
                                banReason,
                                banMessage,
                                banDuration,
                                banContext,
                            }).then(response => {
                                if (response.json.errors.length) {
                                    throw new Error('There were one or more errors banning the user');
                                }
                            }).catch(() => {
                                // catches the above `errors.length` condition as well as network errors
                                self.log('missed one');
                                failedSubs.push(subreddit);
                            });
                        } else {
                            TBApi.unfriendUser(user, action, subreddit).catch(() => {
                                // only catches network errors because unfriend is weird
                                self.log('missed one');
                                failedSubs.push(subreddit);
                            });
                        }
                    },

                    () => {
                        TB.ui.longLoadSpinner(false);

                        window.setTimeout(() => {
                            completeCheck(failedSubs);
                        }, 2000);
                    }
                );
            }
        });

        // send a message to the user.
        $body.on('click', '.mod-popup .message-send', function () {
            let subject,
                message;
            TB.ui.longLoadSpinner(true);
            const $popup = $(this).parents('.mod-popup'),
                  user = $popup.find('.user').text(),
                  subreddit = $popup.find('.subreddit').text(),
                  $callbackSpan = $popup.find('#subreddit-message-callback'),
                  $subredditMessageSubject = $popup.find('.subreddit-message-subject'),
                  $subredditMessage = $popup.find('.subreddit-message');

            if (!$subredditMessageSubject.val() || !$subredditMessage.val()) {
                $callbackSpan.text('You forgot a subject or message');
                $callbackSpan.css('color', 'red');
                TB.ui.longLoadSpinner(false);
                return;
            } else {
                subject = $subredditMessageSubject.val();
                message = $subredditMessage.val();
            }

            TBApi.sendMessage(user, subject, message, subreddit).then(response => {
                if (response.json.errors.length) {
                    $callbackSpan.text(response.json.errors[1]);
                    TB.ui.textFeedback(response.json.errors[1], TB.ui.FEEDBACK_NEGATIVE);
                    TB.ui.longLoadSpinner(false);
                } else {
                    TB.ui.textFeedback('message sent.', TB.ui.FEEDBACK_POSITIVE, 1500);
                    $callbackSpan.text('message sent');
                    $callbackSpan.css('color', 'green');
                    TB.ui.longLoadSpinner(false);
                }
            }).catch(error => {
                $callbackSpan.text(`an error occurred: ${error[0][1]}`);
                TB.ui.longLoadSpinner(false);
            });
        });

        // Flair ALL THE THINGS
        $body.on('click', '.tb-window-tabs .user_flair', async function () {
            const $popup = $(this).parents('.mod-popup'),
                  user = $popup.find('.user').text(),
                  subreddit = $popup.find('.subreddit').text(),
                  $textinput = $popup.find('.flair-text'),
                  $classinput = $popup.find('.flair-class');

            if (!user || !subreddit) {
                return;
            }

            const resp = await TBApi.getJSON(`/r/${subreddit}/api/flairlist.json?name=${user}`);
            if (!resp || !resp.users || resp.users.length < 1) {
                return;
            }
            TBStorage.purifyObject(resp);
            $textinput.val(resp.users[0].flair_text);
            $classinput.val(resp.users[0].flair_css_class);
        });

        // Edit save button clicked.
        $body.on('click', '.flair-save', function () {
            const $popup = $(this).parents('.mod-popup'),
                  $status = $popup.find('.status'),
                  user = $popup.find('.user').text(),
                  subreddit = $popup.find('.subreddit').text(),
                  text = $popup.find('.flair-text').val(),
                  css_class = $popup.find('.flair-class').val();

            TBui.textFeedback('saving user flair...', TBui.FEEDBACK_NEUTRAL);

            TBApi.flairUser(user, subreddit, text, css_class).then(() => {
                TBui.textFeedback('saved user flair', TBui.FEEDBACK_POSITIVE);
            }).catch(error => {
                self.log(error.responseText);
                TBui.textFeedback(error.responseText, TBui.FEEDBACK_NEGATIVE);
                $status.text(error.responseText);
            });
        });
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    modbutton();
}, {
    once: true,
});
