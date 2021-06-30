import {Module} from '../tbmodule.js';
import * as TBStorage from '../tbstorage.js';
import * as TBApi from '../tbapi.js';
import * as TBui from '../tbui.js';
import * as TBHelpers from '../tbhelpers.js';
import * as TBCore from '../tbcore.js';

const self = new Module('User Notes');
self.shortname = 'UserNotes';

// //Default settings
self.settings['enabled']['default'] = true;

self.register_setting('unManagerLink', {
    type: 'boolean',
    default: true,
    title: 'Show usernotes manager in modbox',
});
self.register_setting('showDate', {
    type: 'boolean',
    default: false,
    title: 'Show date in note preview',
});
self.register_setting('showOnModPages', {
    type: 'boolean',
    default: false,
    title: 'Show current usernote on ban/contrib/mod pages',
});
self.register_setting('maxChars', {
    type: 'number',
    default: 20,
    advanced: true,
    title: 'Max characters to display in current note tag (excluding date)',
});

self.register_setting('onlyshowInhover', {
    type: 'boolean',
    default: TB.storage.getSetting('GenSettings', 'onlyshowInhover', true),
    hidden: true,
});
self.init = function () {
    self.usernotesManager();
    self.usernotes();
};

self.usernotes = function usernotes () {
    const subs = [],
          $body = $('body'),
          maxChars = self.setting('maxChars'),
          showDate = self.setting('showDate');
    let firstRun = true;

    TBCore.getModSubs().then(() => {
        self.log('Got mod subs');
        self.log(window.TBCore.mySubs);
        run();
    });

    function getUser (users, name) {
        if (Object.prototype.hasOwnProperty.call(users, name)) {
            return users[name];
        }
        return undefined;
    }

    // NER support.
    let newThingRunning = false;
    window.addEventListener('TBNewThings', () => {
        // It is entirely possible that TBNewThings is fired multiple times.
        // That is why we use a timeout here to prevent run() from being triggered multiple times.
        if (!newThingRunning) {
            newThingRunning = true;
            setTimeout(() => {
                newThingRunning = false;
                run();
            }, 500);
        }
    });

    // Queue the processing of usernotes.
    let listnerSubs = {};
    let queueTimeout;

    function queueProcessSub (subreddit, $target) {
        clearTimeout(queueTimeout);
        if (Object.prototype.hasOwnProperty.call(listnerSubs, subreddit)) {
            listnerSubs[subreddit] = listnerSubs[subreddit].add($target);
        } else {
            listnerSubs[subreddit] = $target;
        }
        queueTimeout = setTimeout(() => {
            for (const sub in listnerSubs) {
                if (Object.prototype.hasOwnProperty.call(listnerSubs, sub)) {
                    processSub(sub, listnerSubs[sub]);
                }
            }
            listnerSubs = {};
        }, 100);
    }

    function addTBListener () {
        const onlyshowInhover = self.setting('onlyshowInhover');

        // event based handling of author elements.
        TB.listener.on('author', e => {
            const $target = $(e.target);
            if ($target.closest('.tb-thing').length || !onlyshowInhover || TBCore.isOldReddit || TBCore.isNewModmail) {
                const subreddit = e.detail.data.subreddit.name;
                const author = e.detail.data.author;
                if (author === '[deleted]') {
                    return;
                }

                $target.addClass('ut-thing');
                $target.attr('data-subreddit', subreddit);
                $target.attr('data-author', author);

                TBCore.getModSubs().then(() => {
                    if (TBCore.modsSub(subreddit)) {
                        attachNoteTag($target, subreddit, author);
                        foundSubreddit(subreddit);
                        queueProcessSub(subreddit, $target);
                    }
                });
            }
        });

        // event based handling of author elements.
        TB.listener.on('userHovercard', e => {
            const $target = $(e.target);
            const subreddit = e.detail.data.subreddit.name;
            const author = e.detail.data.user.username;
            $target.addClass('ut-thing');
            $target.attr('data-subreddit', subreddit);
            $target.attr('data-author', author);

            TBCore.getModSubs().then(() => {
                if (TBCore.modsSub(subreddit)) {
                    attachNoteTag($target, subreddit, author, {
                        customText: 'Usernotes',
                    });
                    foundSubreddit(subreddit);
                    queueProcessSub(subreddit, $target);
                }
            });
        });
    }

    function run () {
        self.log('Running usernotes');

        // We only need to add the listener on pageload.
        if (firstRun) {
            addTBListener();
            firstRun = false;
        } else {
            TBCore.forEachChunked(subs, 10, 200, processSub);
        }
    }

    function attachNoteTag ($element, subreddit, author, options = {}) {
        if ($element.find('.tb-usernote-button').length > 0) {
            return;
        }

        const usernoteDefaultText = options.customText ? options.customText : 'N';
        const $tag = $(`
                <a href="javascript:;" id="add-user-tag" class="tb-bracket-button tb-usernote-button add-usernote-${subreddit}" data-author="${author}" data-subreddit="${subreddit}" data-default-text="${usernoteDefaultText}">${usernoteDefaultText}</a>
            `);

        $element.append($tag);
    }

    function foundSubreddit (subreddit) {
        if (!subs.includes(subreddit)) {
            subs.push(subreddit);
        }
    }

    function processSub (subreddit, customThings) {
        if (!subreddit) {
            return;
        }

        self.log(`Processing sub: ${subreddit}`);
        self.getUserNotes(subreddit, (status, notes) => {
            self.log(`Usernotes retrieved for ${subreddit}: status=${status}`);
            if (!status) {
                return;
            }
            if (!isNotesValidVersion(notes)) {
                // Remove the option to add notes
                $(`.add-usernote-${subreddit}`).remove();

                // Alert the user
                const msg = notes.ver > TBCore.notesMaxSchema ?
                    `You are using a version of toolbox that cannot read a newer usernote data format in: /r/${subreddit}. Please update your extension.` :
                    `You are using a version of toolbox that cannot read an old usernote data format in: /r/${subreddit}, schema v${notes.ver}. Message /r/toolbox for assistance.`;

                TBCore.alert(msg, clicked => {
                    if (clicked) {
                        window.open(notes.ver > TBCore.notesMaxSchema ? '/r/toolbox/wiki/get' :
                            `/message/compose?to=%2Fr%2Ftoolbox&subject=Outdated%20usernotes&message=%2Fr%2F${subreddit}%20is%20using%20usernotes%20schema%20v${notes.ver}`);
                    }
                });
            }

            self.getSubredditColors(subreddit).then(colors => {
                setNotes(notes, subreddit, colors, customThings);
            });
        });
    }

    function isNotesValidVersion (notes) {
        if (notes.ver < TBCore.notesMinSchema || notes.ver > TBCore.notesMaxSchema) {
            self.log('Failed usernotes version check:');
            self.log(`\tnotes.ver: ${notes.ver}`);
            self.log(`\tTBCore.notesSchema: ${TBCore.notesSchema}`);
            self.log(`\tTBCore.notesMinSchema: ${TBCore.notesMinSchema}`);
            self.log(`\tTBCore.notesMaxSchema: ${TBCore.notesMaxSchema}`);
            return false;
        }

        return true;
    }

    function setNotes (notes, subreddit, colors, customThings) {
        self.log(`Setting notes for ${subreddit}`);
        self.startProfile('set-notes');

        self.startProfile('set-notes-find');
        let things;
        if (customThings) {
            things = customThings;
        } else {
            things = $(`.ut-thing[data-subreddit=${subreddit}]`);
        }

        self.endProfile('set-notes-find');

        TBCore.forEachChunked(things, 20, 100, thing => {
            self.startProfile('set-notes-process');

            // Get all tags related to the current subreddit
            const $thing = $(thing),
                  user = $thing.attr('data-author'),
                  u = getUser(notes.users, user);

            let $usertag;
            if (TBCore.isEditUserPage) {
                $usertag = $thing.parent().find(`.add-usernote-${subreddit}`);
            } else {
                $usertag = $thing.find(`.add-usernote-${subreddit}`);
            }

            // Only happens if you delete the last note.
            const defaultButtonText = $usertag.attr('data-default-text'),
                  currentText = $usertag.text();
            if ((u === undefined || u.notes.length < 1) && currentText !== defaultButtonText) {
                $usertag.css('color', '');
                $usertag.empty();
                $usertag.text(defaultButtonText);

                self.endProfile('set-notes-process');
                return;
            } else if (u === undefined || u.notes.length < 1) {
                self.endProfile('set-notes-process');
                return;
            }

            const noteData = u.notes[0],
                  date = new Date(noteData.time);
            let note = noteData.note;

            // Add title before note concat.
            $usertag.attr('title', `${note} (${date.toLocaleString()})`);

            if (note.length > maxChars) {
                note = `${note.substring(0, maxChars)}...`;
            }

            if (showDate) {
                note = `${note} (${date.toLocaleDateString({
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                })})`;
            }

            $usertag.empty();
            $usertag.append($('<b>').text(note)).append($('<span>').text(u.notes.length > 1 ? `  (+${u.notes.length - 1})` : ''));

            let type = u.notes[0].type;
            if (!type) {
                type = 'none';
            }

            const color = self._findSubredditColor(colors, type);
            if (color) {
                $usertag.css('color', color.color);
            } else {
                $usertag.css('color', '');
            }

            self.endProfile('set-notes-process');
        }, () => {
            self.endProfile('set-notes');
        });
    }

    function createUserPopup (subreddit, user, link, disableLink, e) {
        const $overlay = $(e.target).closest('.tb-page-overlay');
        let $appendTo;
        if ($overlay.length) {
            $appendTo = $overlay;
        } else {
            $appendTo = $('body');
        }
        const $popup = TB.ui.popup({
            title: `<div class="utagger-title">
                    <span>User Notes - <a href="${TBCore.link(`/user/${user}`)}" id="utagger-user-link">/u/${user}</a></span>
                </div>`,
            tabs: [{
                content: `
                        <div class="utagger-content">
                            <table class="utagger-notes">
                                <tbody>
                                    <tr>
                                        <td class="utagger-notes-td1">Author</td>
                                        <td class="utagger-notes-td2">Note</td>
                                        <td class="utagger-notes-td3"></td></tr>
                                </tbody>
                            </table>
                            <div class="utagger-types">
                                <div class="utagger-type-list"></div>
                            </div>
                            <div class="utagger-input-wrapper">
                                <input type="text" class="utagger-user-note tb-input" id="utagger-user-note-input" placeholder="something about the user..." data-link="${link}" data-subreddit="${subreddit}" data-user="${user}">
                                <label class="utagger-include-link">
                                    <input type="checkbox" ${!disableLink ? 'checked' : ''}${disableLink ? 'disabled' : ''}>
                                    <span>Include link</span>
                                </label>
                            </div>
                        </div>
                    `,

                footer: `
                        <div class="utagger-footer">
                            <span class="tb-window-error" style="display: none;"></span>
                            <input type="button" class="utagger-save-user tb-action-button" id="utagger-save-user" value="Save for /r/${subreddit}">
                        </div>
                    `,
            }],
            cssClass: 'utagger-popup',
        });

        // defined so we can easily add things to these specific areas after loading the notes.
        const $noteList = $popup.find('.utagger-content .utagger-notes tbody'),
              $typeList = $popup.find('.utagger-types .utagger-type-list');

        // We want to make sure windows fit on the screen.
        const positions = TBui.drawPosition(e);

        $popup.css({
            left: positions.leftPosition,
            top: positions.topPosition,
        });
        $appendTo.append($popup);

        // Generate dynamic parts of dialog and show
        self.getSubredditColors(subreddit).then(colors => {
            self.log('Adding colors to dialog');

            // Create type/color selections
            const group = `${Math.random().toString(36)}00000000000000000`.slice(2, 7);

            colors.forEach(info => {
                self.log(`  ${info.key}`);
                self.log(`    ${info.text}`);
                self.log(`    ${info.color}`);
                $typeList.append(`
                    <div>
                        <label class="utagger-type type-${info.key}">
                            <input type="checkbox" name="type-group-${group}" value="${info.key}" class="type-input type-input-${info.key}">
                            <div style="color: ${info.color}">${info.text}</div>
                        </label>
                    </div>
                    `);
            });

            // Radio buttons 2.0, now with deselection
            $popup.find('.utagger-type').click(function () {
                const $thisInput = $(this).find('input');
                // Are we already checked?
                if ($thisInput.prop('checked')) {
                    // just uncheck this thing so everything is blank
                    $thisInput.prop('checked', false);
                } else {
                    // Uncheck all the things, then check this thing
                    $(this).closest('.utagger-types').find('input').prop('checked', false);
                    $thisInput.prop('checked', true);
                }
            });

            $popup.show();

            // Add notes
            self.log('Adding notes to dialog');
            self.getUserNotes(subreddit, (status, notes) => {
                if (!status) {
                    return;
                }

                const u = getUser(notes.users, user);
                // User has notes
                if (u !== undefined && u.notes.length > 0) {
                    // FIXME: not selecting previous type
                    $popup.find(`.utagger-type .type-input-${u.notes[0].type}`).prop('checked', true);

                    u.notes.forEach((note, i) => {
                        // if (!note.type) {
                        //    note.type = 'none';
                        // }

                        self.log(`  Type: ${note.type}`);
                        const info = self._findSubredditColor(colors, note.type);
                        self.log(info);

                        // TODO: probably shouldn't rely on time truncated to seconds as a note ID; inaccurate.
                        // The ID of a note is set to its time when the dialog is generated. As of schema v5,
                        // times are truncated to second accuracy. This means newly-added notes that have yet
                        // to be saved — and therefore still retain millisecond accuracy — may not be considered
                        // equal to saved versions if compared. This caused problems when deleting new notes,
                        // which searches a saved version based on ID.
                        const noteId = Math.trunc(note.time / 1000) * 1000,
                              noteString = TBHelpers.htmlEncode(note.note),
                              timeString = new Date(note.time).toLocaleString();

                        // Construct some elements separately
                        let timeDiv;

                        if (note.link) {
                            let noteLink = note.link;
                            if (TBCore.isNewModmail && !noteLink.startsWith('https://')) {
                                noteLink = `https://www.reddit.com${noteLink}`;
                            }
                            timeDiv = `<div class="utagger-date" id="utagger-date-${i}"><a href="${noteLink}">${timeString}</a></div>`;
                        } else {
                            timeDiv = `<div class="utagger-date" id="utagger-date-${i}">${timeString}</div>`;
                        }

                        let typeSpan = '';
                        if (info && info.text) {
                            typeSpan = `<span class="note-type" style="color: ${info.color}">[${TBHelpers.htmlEncode(info.text)}]</span>`;
                        }

                        // Add note to list
                        $noteList.append(`
                            <tr class="utagger-note">
                                <td class="utagger-notes-td1">
                                    <div class="utagger-mod">${note.mod}</div>
                                    ${timeDiv}
                                </td>
                                <td class="utagger-notes-td2">
                                    ${typeSpan}
                                    <span class="note-text">${noteString}</span>
                                </td>
                                <td class="utagger-notes-td3"><i class="utagger-remove-note tb-icons tb-icons-negative" data-note-id="${noteId}">${TBui.icons.delete}</i></td>
                            </tr>
                            `);
                    });
                } else {
                    // No notes on user
                    $popup.find('#utagger-user-note-input').focus();
                }
            });
        });
    }

    // Click to open dialog
    $body.on('click', '#add-user-tag', e => {
        const $target = $(e.target);
        const $thing = $target.closest('.ut-thing');
        const $button = $thing.find('#add-user-tag');

        const subreddit = $button.attr('data-subreddit'),
              user = $button.attr('data-author'),
              disableLink = false; // FIXME: change to thing type
        let link;

        if (TBCore.isNewModmail) {
            link = TBCore.getThingInfo($thing).permalink_newmodmail;
            createUserPopup(subreddit, user, link, disableLink, e);
        } else {
            let thingID;
            let thingDetails;

            if ($thing.data('tb-type') === 'TBcommentAuthor' || $thing.data('tb-type') === 'commentAuthor') {
                thingDetails = $thing.data('tb-details');
                thingID = thingDetails.data.comment.id;
            } else if ($thing.data('tb-type') === 'userHovercard') {
                thingDetails = $thing.data('tb-details');
                thingID = thingDetails.data.contextId;
            } else {
                thingDetails = $thing.data('tb-details');
                thingID = thingDetails.data.post.id;
            }

            if (!thingID) {
                // we don't have the ID on /about/banned, so no thing data for us
                return createUserPopup(subreddit, user, link, true, e);
            }

            TBCore.getApiThingInfo(thingID, subreddit, true, info => {
                link = info.permalink;
                createUserPopup(subreddit, user, link, disableLink, e);
            });
        }
    });

    // Save or delete button clicked
    $body.on('click', '.utagger-save-user, .utagger-remove-note', function (e) {
        self.log('Save or delete pressed');
        const $popup = $(this).closest('.utagger-popup'),
              $unote = $popup.find('.utagger-user-note'),
              subreddit = $unote.attr('data-subreddit'),
              user = $unote.attr('data-user'),
              noteId = $(e.target).attr('data-note-id'),
              noteText = $unote.val(),
              deleteNote = $(e.target).hasClass('utagger-remove-note'),
              type = $popup.find('.utagger-type input:checked').val();
        let link = '';

        if ($popup.find('.utagger-include-link input').is(':checked')) {
            link = $unote.attr('data-link');
        }

        self.log('deleteNote', deleteNote);
        // Check new note data states
        if (!deleteNote) {
            if (!noteText) {
                // User forgot note text!
                $unote.addClass('error');

                const $error = $popup.find('.tb-window-error');
                $error.text('Note text is required');
                $error.show();

                return;
            } else if (!user || !subreddit) {
                // We seem to have an problem beyond the control of the user
                return;
            }
        }

        // Create new note
        let note = {
            note: noteText.trim(),
            time: new Date().getTime(),
            mod: window.TBCore.logged,
            link,
            type,
        };

        const userNotes = {
            notes: [],
        };

        userNotes.notes.push(note);

        $popup.remove();

        const noteSkel = {
            ver: TBCore.notesSchema,
            constants: {},
            users: {},
        };

        TBui.textFeedback(`${deleteNote ? 'Removing' : 'Adding'} user note...`, TBui.FEEDBACK_NEUTRAL);

        self.getUserNotes(subreddit, (success, notes, pageError) => {
            // Only page errors git different treatment.
            if (!success && pageError) {
                self.log('  Page error');
                switch (pageError) {
                case TBCore.WIKI_PAGE_UNKNOWN:
                    break;
                case TBCore.NO_WIKI_PAGE:
                    notes = noteSkel;
                    notes.users[user] = userNotes;
                    self.saveUserNotes(subreddit, notes, 'create usernotes config', succ => {
                        if (succ) {
                            run();
                        }
                    });
                    break;
                }
                return;
            }

            let saveMsg;
            if (notes) {
                if (notes.corrupted) {
                    TBCore.alert('toolbox found an issue with your usernotes while they were being saved. One or more of your notes appear to be written in the wrong format; to prevent further issues these have been deleted. All is well now.');
                }

                const u = getUser(notes.users, user);

                // User already has notes
                if (u !== undefined) {
                    self.log('User exists');

                    // Delete note
                    if (deleteNote) {
                        self.log('Deleting note');
                        self.log(`  ${noteId}`);

                        self.log('Removing note from:');
                        self.log(u.notes);
                        for (let n = 0; n < u.notes.length; n++) {
                            note = u.notes[n];
                            self.log(`  ${note.time}`);

                            if (note.time.toString() === noteId) {
                                self.log(`  Note found: ${noteId}`);
                                u.notes.splice(n, 1);
                                self.log(u.notes);
                                break;
                            }
                        }

                        if (u.notes.length < 1) {
                            self.log('Removing user (is empty)');
                            delete notes.users[user];
                        }

                        saveMsg = `delete note ${noteId} on user ${user}`;
                    } else {
                        // Add note
                        self.log('Adding note');

                        u.notes.unshift(note);
                        saveMsg = `create new note on user ${user}`;
                    }
                } else if (u === undefined && !deleteNote) {
                    // New user
                    notes.users[user] = userNotes;
                    saveMsg = `create new note on new user ${user}`;
                }
            } else {
                self.log('  Creating new user');

                // create new notes object
                notes = noteSkel;
                notes.users[user] = userNotes;
                saveMsg = `create new notes object, add new note on user ${user}`;
            }

            // Save notes if a message was set (the only case it isn't is if notes are corrupt)
            if (saveMsg) {
                self.log('Saving notes');
                self.saveUserNotes(subreddit, notes, saveMsg, succ => {
                    if (succ) {
                        run();
                    }
                });
            }
        }, true);
    });

    // Enter key pressed when adding new note
    $body.on('keyup', '.utagger-user-note', function (event) {
        if (event.keyCode === 13) {
            const popup = $(this).closest('.utagger-popup');
            popup.find('.utagger-save-user').click();
        }
    });
};

self.usernotesManager = function () {
    const $body = $('body'),
          showLink = self.setting('unManagerLink');
    let subUsenotes;

    // Register context hook for opening the manager
    if (showLink) {
        window.addEventListener('TBNewPage', event => {
            if (event.detail.pageDetails.subreddit) {
                const subreddit = event.detail.pageDetails.subreddit;

                TBCore.getModSubs().then(() => {
                    if (TBCore.modsSub(subreddit)) {
                        TBui.contextTrigger('tb-un-config-link', {
                            addTrigger: true,
                            triggerText: 'edit usernotes',
                            triggerIcon: TBui.icons.usernote,
                            title: `edit usernotes for /r/${subreddit}`,
                            dataAttributes: {
                                subreddit,
                            },
                        });
                    } else {
                        TBui.contextTrigger('tb-un-config-link', {addTrigger: false});
                    }
                });
            } else {
                TBui.contextTrigger('tb-un-config-link', {addTrigger: false});
            }
        });
    }

    // Sets up the note manager's even listeners and runs timeago for relative dates
    function registerManagerEventListeners (sub) {
        self.startProfile('manager-run');

        $body.find('#tb-un-prune-sb').on('click', event => {
            const $popup = TBui.popup({
                title: `Pruning usernotes for /r/${sub}`,
                tabs: [{
                    content: `
                            <p>
                                <input type="checkbox" id="tb-un-prune-by-note-age"/>
                                <label for="tb-un-prune-by-note-age">
                                    Prune notes older than
                                    <select id="tb-un-prune-by-note-age-limit">
                                        <option value="15552000000">6 months</option>
                                        <option value="31104000000">1 year</option>
                                        <option value="62208000000">2 years</option>
                                        <option value="93312000000">3 years</option>
                                        <option value="124416000000">4 years</option>
                                    </select>
                                </label>
                            </p>
                            <p>
                                <input type="checkbox" id="tb-un-prune-by-user-deleted"/>
                                <label for="tb-un-prune-by-user-deleted">
                                    Prune deleted users (slow)
                                </label>
                            </p>
                            <p>
                                <input type="checkbox" id="tb-un-prune-by-user-suspended"/>
                                <label for="tb-un-prune-by-user-suspended">
                                    Prune permanently suspended users (slow)
                                </label>
                            </p>
                            <p>
                                <input type="checkbox" id="tb-un-prune-by-user-inactivity"/>
                                <label for="tb-un-prune-by-user-inactivity">
                                    Prune users who haven't posted or commented in
                                    <select id="tb-un-prune-by-user-inactivity-limit">
                                        <option value="15552000000">6 months</option>
                                        <option value="31104000000">1 year</option>
                                        <option value="62208000000">2 years</option>
                                        <option value="93312000000">3 years</option>
                                        <option value="124416000000">4 years</option>
                                    </select>
                                    (slow)
                                </label>
                            </p>
                        `,
                    footer: `
                            <button class="tb-action-button" id="tb-un-prune-confirm">Prune</button>
                        `,
                }],
            });

            const $pruneByNoteAge = $popup.find('#tb-un-prune-by-note-age');
            const $pruneByNoteAgeLimit = $popup.find('#tb-un-prune-by-note-age-limit');
            const $pruneByUserDeleted = $popup.find('#tb-un-prune-by-user-deleted');
            const $pruneByUserSuspended = $popup.find('#tb-un-prune-by-user-suspended');
            const $pruneByUserInactivity = $popup.find('#tb-un-prune-by-user-inactivity');
            const $pruneByUserInactivityLimit = $popup.find('#tb-un-prune-by-user-inactivity-limit');
            const $confirmButton = $popup.find('#tb-un-prune-confirm');

            $confirmButton.on('click', async () => {
                const checkNoteAge = $pruneByNoteAge.is(':checked');
                const checkUserDeleted = $pruneByUserDeleted.is(':checked');
                const checkUserSuspended = $pruneByUserSuspended.is(':checked');
                const checkUserActivity = $pruneByUserInactivity.is(':checked');

                // Do nothing if no pruning criteria are selected
                if (!checkNoteAge && !checkUserDeleted && !checkUserSuspended && !checkUserActivity) {
                    return;
                }

                // Create a deep copy of the users object to avoid overwriting live data
                const users = JSON.parse(JSON.stringify(subUsenotes.users));

                // Record initial number of notes and users
                const totalNotes = Object.values(users).reduce((acc, {notes}) => acc + notes.length, 0);
                const totalUsers = Object.keys(users).length;

                // Keep track of the number of users and notes we prune
                let prunedNotes = 0;
                let prunedUsers = 0;

                // Also keep track of what sorts of notes we're pruning (to generate the wiki edit message)
                const pruneReasons = [];

                // Prune by note age
                if (checkNoteAge) {
                    const ageThreshold = Date.now() - parseInt($pruneByNoteAgeLimit.val(), 10);
                    pruneReasons.push(`notes before ${new Date(ageThreshold).toISOString()}`);

                    // delete all notes from earlier than ageThreshold
                    for (const [username, user] of Object.entries(users)) {
                        user.notes = user.notes.filter(note => {
                            if (note.time >= ageThreshold) {
                                return true;
                            }
                            prunedNotes += 1;
                            return false;
                        });
                        if (user.notes.length === 0) {
                            // delete in loop is safe because we're iterating over Object.values()
                            delete users[username];
                            prunedUsers += 1;
                        }
                    }
                }

                // Prune by user criteria we have to hit the API for
                if (checkUserDeleted || checkUserSuspended || checkUserActivity) {
                    // Calculate the date threshold for activity checks
                    // NOTE: This value is only used if checkUserActivity is true, but because it's used in a couple
                    //       different scopes and we don't want to recalculate it over and over, we just set it here
                    //       and don't use it if we don't care about user activity. This could probably be cleaned.
                    const dateThreshold = Date.now() - parseInt($pruneByUserInactivityLimit.val(), 10);

                    // Add the appropriate notes for the wiki revision comment
                    if (checkUserActivity) {
                        pruneReasons.push(`users inactive since ${new Date(dateThreshold).toISOString()}`);
                    }
                    if (checkUserDeleted) {
                        pruneReasons.push('deleted users');
                    }
                    if (checkUserSuspended) {
                        pruneReasons.push('suspended users');
                    }

                    // Check each individual user
                    // `await Promise.all()` allows requests to be sent in parallel
                    TBui.longLoadSpinner(true, 'Checking user activity, this could take a bit', TB.ui.FEEDBACK_NEUTRAL);
                    await Promise.all(Object.entries(users).map(async ([username, user]) => {
                        let accountDeleted = false;
                        let accountSuspended = false;
                        let accountInactive = false;

                        // Fetch the user's profile and see if they meet any of the criteria
                        await TBApi.getJSON(`/user/${username}.json`, {sort: 'new'}).then(({data}) => {
                            // The user exists and isn't suspended, and is considered inactive only if they have no
                            // public post or comment history more recent than the threshold
                            accountInactive = !data.children.some(thing => thing.data.created_utc * 1000 > dateThreshold);
                        }).catch(error => {
                            if (!error.response) {
                                // There was a network error - never act based on this
                                self.error(`Network error while trying to prune check /u/${username}:`, error);
                                return;
                            }
                            if (error.response.status === 404) {
                                // 404 tells us the user is deleted
                                accountDeleted = true;
                            } else if (error.response.status === 403) {
                                // 403 tells us the user is permanently suspended
                                accountSuspended = true;
                            }
                        });

                        // If any of the specified criteria are true, delete all the user's notes
                        if (
                            checkUserDeleted && accountDeleted ||
                                checkUserSuspended && accountSuspended ||
                                checkUserActivity && accountInactive
                        ) {
                            prunedNotes += user.notes.length;
                            prunedUsers += 1;
                            delete users[username];
                        }
                    }));
                    TBui.longLoadSpinner(false);
                }

                const confirmation = confirm(`${prunedNotes} of ${totalNotes} notes will be pruned. ${prunedUsers} of ${totalUsers} users will no longer have any notes. Proceed?`);
                if (!confirmation) {
                    return;
                }
                subUsenotes.users = users;
                self.saveUserNotes(sub, subUsenotes, `prune: ${pruneReasons.join(', ')}`, () => {
                    window.location.reload();
                });
            });

            const {topPosition, leftPosition} = TBui.drawPosition(event);
            $popup.appendTo('#tb-un-note-content-wrap').css({
                // position: 'absolute',
                top: topPosition,
                left: leftPosition,
            });
        });

        // Update user status.
        $body.on('click', '.tb-un-refresh', async function () {
            const $this = $(this),
                  user = $this.attr('data-user'),
                  $userSpan = $this.parent().find('.user');
            if (!$this.hasClass('tb-un-refreshed')) {
                $this.addClass('tb-un-refreshed');
                self.log(`refreshing user: ${user}`);

                const $status = TBHelpers.template('&nbsp;<span class="mod">[this user account is: {{status}}]</span>', {
                    status: await TBApi.aboutUser(user).then(() => 'active').catch(() => 'deleted'),
                });
                $userSpan.after($status);
            }
        });

        // Delete all notes for user.
        $body.on('click', '.tb-un-delete', function () {
            const $this = $(this),
                  user = $this.attr('data-user'),
                  $userSpan = $this.parent();

            const r = confirm(`This will delete all notes for /u/${user}.  Would you like to proceed?`);
            if (r === true) {
                self.log(`deleting notes for ${user}`);
                delete subUsenotes.users[user];
                self.saveUserNotes(sub, subUsenotes, `deleted all notes for /u/${user}`);
                $userSpan.parent().remove();
                TB.ui.textFeedback(`Deleted all notes for /u/${user}`, TB.ui.FEEDBACK_POSITIVE);
            }
        });

        // Delete individual notes for user.
        $body.on('click', '.tb-un-notedelete', function () {
            const $this = $(this),
                  user = $this.attr('data-user'),
                  note = $this.attr('data-note'),
                  $noteSpan = $this.parent();

            self.log(`deleting note for ${user}`);
            subUsenotes.users[user].notes.splice(note, 1);
            self.saveUserNotes(sub, subUsenotes, `deleted a note for /u/${user}`);
            $noteSpan.remove();
            TB.ui.textFeedback(`Deleted note for /u/${user}`, TB.ui.FEEDBACK_POSITIVE);
        });

        self.endProfile('manager-run');
    }

    // Open the usernotes manager when the context item is clicked
    $body.on('click', '#tb-un-config-link, .tb-un-config-link', async function () {
        TB.ui.longLoadSpinner(true, 'Loading usernotes', TB.ui.FEEDBACK_NEUTRAL);
        const sub = $(this).attr('data-subreddit');

        // Grab the usernotes data
        let notes;
        try {
            // TODO: convert original function to promise
            notes = await new Promise((resolve, reject) => {
                self.getUserNotes(sub, (success, notes) => {
                    if (!success) {
                        reject();
                    } else {
                        resolve(notes);
                    }
                });
            });
            // TBui.pagerForItems can't handle an empty array yet, so just return early if there's nothing to display
            if (!Object.keys(notes.users).length) {
                throw new Error('No users found');
            }
        } catch (_) {
            self.error(`un status: ${status}\nnotes: ${notes}`);
            TB.ui.longLoadSpinner(false, 'No notes found', TB.ui.FEEDBACK_NEGATIVE);
            return;
        }

        subUsenotes = notes;
        self.log('showing notes');

        const $userContentTemplate = $(`
                <div class="tb-un-user" data-user="NONE">
                    <div class="tb-un-user-header">
                        <a class="tb-un-refresh tb-icons" data-user="NONE" href="javascript:;">${TBui.icons.refresh}</a>
                        <a class="tb-un-delete tb-icons tb-icons-negative" data-user="NONE" href="javascript:;">${TBui.icons.delete}</a>
                        <span class="user">
                            <a href="${TBCore.link('/u/NONE')}">/u/NONE</a>
                        </span>
                    </div>
                </div>
            `);

        // Grab the note types
        const colors = await self.getSubredditColors(sub);
        self.startProfile('manager-render');

        /**
             * Renders all of a single user's notes
             * @param {object} user The user's data object
             */
        function renderUsernotesUser (user) {
            self.startProfile('manager-render-user');
            const $userContent = $userContentTemplate.clone();
            $userContent.attr('data-user', user.name);
            $userContent.find('.tb-un-refresh, .tb-un-delete').attr('data-user', user.name);
            $userContent.find('.user a').attr('href', `/u/${user.name}`).text(`/u/${user.name}`);
            const $userNotes = $('<div>').addClass('tb-usernotes');// $userContent.find(".tb-usernotes");
            $userContent.append($userNotes);
            self.endProfile('manager-render-user');

            self.startProfile('manager-render-notes');

            // NOTE: I really hope that nobody has an insane amount of notes on a single user, otherwise all this perf work will be useless
            Object.entries(user.notes).forEach(([key, val]) => {
                const color = self._findSubredditColor(colors, val.type);

                const timeISO = new Date(val.time).toISOString(),
                      timeHuman = TBHelpers.timeConverterRead(val.time / 1000);

                const $note = $(`
                        <div class="tb-un-note-details">
                            <a class="tb-un-notedelete tb-icons tb-icons-negative" data-note="${key}" data-user="${user.name}" href="javascript:;">${TBui.icons.delete}</a>
                            <span class="note">
                                <span class="note-type">[${color.text}]</span>
                                <a class="note-content" href="${val.link}">${val.note}</a>
                            </span>
                            <span>-</span>
                            <span class="mod">by /u/${val.mod}</span>
                            <span>-</span>
                            <time class="live-timestamp timeago" datetime="${timeISO}" title="${timeHuman}">${timeISO}</time>
                        </div>
                    `);

                if (color.key === 'none') {
                    $note.find('.note-type').hide();
                }
                $userNotes.append($note);
            });

            // Set relative times on the notes
            $userContent.find('time.timeago').timeago();

            self.endProfile('manager-render-notes');
            return $userContent;
        }

        // Calculate the total number of users and notes
        let userCount = 0;
        let noteCount = 0;
        for (const user of Object.values(notes.users)) {
            userCount += 1;
            noteCount += user.notes.length;
        }

        // Create the base of the overlay content
        const $overlayContent = $(`
                <div id="tb-un-note-content-wrap">
                    <div class="tb-un-info">
                        <span class="tb-info">There are ${userCount} users with ${noteCount} notes.</span>
                        <br> <input id="tb-unote-user-search" type="text" class="tb-input" placeholder="search for user"> <input id="tb-unote-contents-search" type="text" class="tb-input" placeholder="search for note contents">
                        <br><br>
                        <button id="tb-un-prune-sb" class="tb-general-button">Prune deleted/suspended profiles</button>
                    </div></br></br>
                </div>
            `);

        const USERS_PER_PAGE = 50;

        // Create and add the pager for usernotes display
        const allUsers = Object.values(notes.users);
        let $pager = TBui.pagerForItems({
            items: allUsers,
            perPage: USERS_PER_PAGE,
            displayItem: renderUsernotesUser,
        });
        $overlayContent.append($pager);

        // Gang's all here, present the overlay
        TB.ui.overlay(
            `usernotes - /r/${sub}`,
            [
                {
                    title: `usernotes - /r/${sub}`,
                    tooltip: `edit usernotes for /r/${sub}`,
                    content: $overlayContent,
                    footer: '',
                },
            ],
            [], // extra header buttons
            'tb-un-editor', // class
            false, // single overriding footer
        ).appendTo('body');
        $body.css('overflow', 'hidden');

        // Variables to store the filter text
        let userText = '';
        let contentText = '';

        // Creates a new pager with the correct filtered items and replace
        // the current one with the new one, debounced because typing delay
        const refreshPager = TBHelpers.debounce(() => {
            // Create a new array of cloned user objects, and filter the
            // notes based on `userText` and `contentText`
            const filteredData = allUsers.map(user => ({
                name: user.name,
                // Filter out notes not matching `contentText`
                notes: user.notes.filter(note => note.note.toLowerCase().includes(contentText.toLowerCase())),
            })).filter(user => {
                // Filter out users not matching `userText`
                if (userText && !user.name.toLowerCase().includes(userText.toLowerCase())) {
                    return false;
                }

                // Filter out users with no notes left
                if (!user.notes.length) {
                    return false;
                }

                return true;
            });

            // Create the new pager
            const $newPager = TBui.pagerForItems({
                items: filteredData,
                perPage: USERS_PER_PAGE,
                displayItem: renderUsernotesUser,
            });

            // Replace the old pager with the new one, then update the
            // $pager variable so other references point to the new one
            $pager.replaceWith($newPager);
            $pager = $newPager;
        });

        // Listeners to update the filter text
        $body.find('#tb-unote-user-search').keyup(function () {
            userText = $(this).val();
            refreshPager();
        });
        $body.find('#tb-unote-contents-search').keyup(function () {
            contentText = $(this).val();
            refreshPager();
        });

        // Process done
        self.endProfile('manager-render');
        TB.ui.longLoadSpinner(false, 'Usernotes loaded', TB.ui.FEEDBACK_POSITIVE);

        // Set other events after all items are loaded.
        registerManagerEventListeners(sub);

        self.printProfiles();
    });

    $body.on('click', '.tb-un-editor .tb-window-header .close', () => {
        $('.tb-un-editor').remove();
        $body.css('overflow', 'auto');
    });
};

// Get usernotes from wiki
self.getUserNotes = async function (subreddit, callback, forceSkipCache) {
    self.log(`Getting usernotes (sub=${subreddit})`);

    if (!callback) {
        return;
    }
    if (!subreddit) {
        return returnFalse();
    }

    // Check cache (if not skipped)
    const cachedNotes = await TBStorage.getCache('Utils', 'noteCache', {});
    const cachedSubsWithNoNotes = await TBStorage.getCache('Utils', 'noNotes', []);
    if (!forceSkipCache) {
        if (cachedNotes[subreddit] !== undefined) {
            self.log('notes found in cache');
            callback(true, cachedNotes[subreddit], subreddit);
            return;
        }

        if (cachedSubsWithNoNotes.includes(subreddit)) {
            self.log('found in NoNotes cache');
            returnFalse();
            return;
        }
    }

    // Read notes from wiki page
    TBApi.readFromWiki(subreddit, 'usernotes', true).then(resp => {
        // Errors when reading notes
        // // These errors are bad
        if (resp === TBCore.WIKI_PAGE_UNKNOWN) {
            self.log('Usernotes read error: WIKI_PAGE_UNKNOWN');
            returnFalse(TBCore.WIKI_PAGE_UNKNOWN);
            return;
        }
        if (resp === TBCore.NO_WIKI_PAGE || !resp) {
            cachedSubsWithNoNotes.push(subreddit);
            TBStorage.setCache('Utils', 'noNotes', cachedSubsWithNoNotes);
            self.log('Usernotes read error: NO_WIKI_PAGE or wiki page empty');
            returnFalse(TBCore.NO_WIKI_PAGE);
            return;
        }

        // Success
        TBStorage.purifyObject(resp);
        self.log('We have notes!');
        const notes = convertNotes(resp, subreddit);

        // We have notes, cache them and return them.
        cachedNotes[subreddit] = notes;
        TBStorage.setCache('Utils', 'noteCache', cachedNotes);
        if (callback) {
            callback(true, notes, subreddit);
        }
    });

    function returnFalse (pageError) {
        callback(false, null, pageError);
    }

    // Inflate notes from the database, converting between versions if necessary.
    function convertNotes (notes, sub) {
        self.log(`Notes ver: ${notes.ver}`);

        if (notes.ver >= TBCore.notesMinSchema) {
            if (notes.ver <= 5) {
                notes = inflateNotes(notes, sub);
            } else if (notes.ver <= 6) {
                notes = decompressBlob(notes);
                notes = inflateNotes(notes, sub);
            }

            if (notes.ver <= TBCore.notesDeprecatedSchema) {
                self.log(`Found deprecated notes in ${subreddit}: S${notes.ver}`);

                TBCore.alert(
                    `The usernotes in /r/${subreddit} are stored using schema v${notes.ver}, which is deprecated. Please click here to updated to v${TBCore.notesSchema}.`,
                    clicked => {
                        if (clicked) {
                            // Upgrade notes
                            self.saveUserNotes(subreddit, notes, `Updated notes to schema v${TBCore.notesSchema}`, succ => {
                                if (succ) {
                                    TB.ui.textFeedback('Notes saved!', TB.ui.FEEDBACK_POSITIVE);
                                    TBCore.clearCache();
                                    window.location.reload();
                                }
                            });
                        }
                    },
                );
            }

            return notes;
        } else {
            returnFalse();
        }

        // Utilities
        function decompressBlob (notes) {
            const decompressed = TBHelpers.zlibInflate(notes.blob);

            // Update notes with actual notes
            delete notes.blob;
            notes.users = JSON.parse(decompressed);
            return notes;
        }
    }

    // Decompress notes from the database into a more useful format
    function inflateNotes (deflated, sub) {
        const inflated = {
            ver: deflated.ver,
            users: {},
        };

        const mgr = new self._constManager(deflated.constants);

        self.log('Inflating all usernotes');
        Object.entries(deflated.users).forEach(([name, user]) => {
            inflated.users[name] = {
                name,
                notes: user.ns.map(note => inflateNote(deflated.ver, mgr, note, sub)),
            };
        });

        return inflated;
    }

    // Inflates a single note
    function inflateNote (version, mgr, note, sub) {
        return {
            note: TBHelpers.htmlDecode(note.n),
            time: inflateTime(version, note.t),
            mod: mgr.get('users', note.m),
            link: self._unsquashPermalink(sub, note.l),
            type: mgr.get('warnings', note.w),
        };
    }

    // Date/time utilities
    function inflateTime (version, time) {
        if (version >= 5 && time.toString().length <= 10) {
            time *= 1000;
        }
        return time;
    }
};

// Save usernotes to wiki
self.saveUserNotes = function (sub, notes, reason, callback) {
    TBui.textFeedback('Saving user notes...', TBui.FEEDBACK_NEUTRAL);

    // Upgrade usernotes if only upgrading
    if (notes.ver < TBCore.notesSchema) {
        notes.ver = TBCore.notesSchema;
    }

    // Update cached notes with new notes object for this subreddit
    TBStorage.getCache('Utils', 'noteCache', {}).then(cachedNotes => {
        cachedNotes[sub] = notes;
        TBStorage.setCache('Utils', 'noteCache', cachedNotes);
    });

    // Deconvert notes to wiki format
    notes = deconvertNotes(notes);

    // Write to wiki page
    self.log('Saving usernotes to wiki...');
    TBApi.postToWiki('usernotes', sub, notes, reason, true, false).then(() => {
        self.log('Success!');
        TBui.textFeedback('Save complete!', TBui.FEEDBACK_POSITIVE, 2000);
        if (callback) {
            callback(true);
        }
    }).catch(jqXHR => {
        self.log(`Failure: ${jqXHR.status}`);
        let reason;
        if (jqXHR.status === 413) {
            reason = 'usernotes full';
        } else {
            reason = jqXHR.responseText;
        }
        self.log(`  ${reason}`);

        TBui.textFeedback(`Save failed: ${reason}`, TBui.FEEDBACK_NEGATIVE, 5000);
        if (callback) {
            callback(false);
        }
    });

    // Deconvert notes to wiki format based on version (note: deconversion is actually conversion in the opposite direction)
    function deconvertNotes (notes) {
        if (notes.ver <= 5) {
            self.log('  Is v5');
            return deflateNotes(notes);
        } else if (notes.ver <= 6) {
            self.log('  Is v6');
            notes = deflateNotes(notes);
            return compressBlob(notes);
        }
        return notes;

        // Utilities
        function compressBlob (notes) {
            // Make way for the blob!
            const users = JSON.stringify(notes.users);
            delete notes.users;

            notes.blob = TBHelpers.zlibDeflate(users);
            return notes;
        }
    }

    // Compress notes so they'll store well in the database.
    function deflateNotes (notes) {
        const deflated = {
            ver: TBCore.notesSchema > notes.ver ? TBCore.notesSchema : notes.ver, // Prevents downgrading usernotes version like a butt
            users: {},
            constants: {
                users: [],
                warnings: [],
            },
        };

        const mgr = new self._constManager(deflated.constants);

        Object.entries(notes.users).forEach(([name, user]) => {
            deflated.users[name] = {
                ns: user.notes.filter(note => {
                    if (note === undefined) {
                        self.log('WARNING: undefined note removed');
                    }
                    return note !== undefined;
                }).map(note => deflateNote(notes.ver, note, mgr)),
            };
        });

        return deflated;
    }

    // Compresses a single note
    function deflateNote (version, note, mgr) {
        self.log(note);
        return {
            n: note.note,
            t: deflateTime(version, note.time),
            m: mgr.create('users', note.mod),
            l: self._squashPermalink(note.link),
            w: mgr.create('warnings', note.type),
        };
    }

    // Compression utilities
    function deflateTime (version, time) {
        if (time === undefined) {
            // Yeah, you time deleters get no time!
            return 0;
        }
        if (version >= 5 && time.toString().length > 10) {
            time = Math.trunc(time / 1000);
        }
        return time;
    }
};

// Save/load util
self._constManager = function _constManager (init_pools) {
    return {
        _pools: init_pools,
        create (poolName, constant) {
            const pool = this._pools[poolName];
            const id = pool.indexOf(constant);
            if (id !== -1) {
                return id;
            }
            pool.push(constant);
            return pool.length - 1;
        },
        get (poolName, id) {
            return this._pools[poolName][id];
        },
    };
};

self._squashPermalink = function (permalink) {
    if (!permalink) {
        return '';
    }

    // Compatibility with Sweden
    const COMMENTS_LINK_RE = /\/comments\/(\w+)\/(?:[^/]+\/(?:(\w+))?)?/,
          MODMAIL_LINK_RE = /\/messages\/(\w+)/;

    const linkMatches = permalink.match(COMMENTS_LINK_RE),
          modMailMatches = permalink.match(MODMAIL_LINK_RE),
          newModMailMatches = permalink.startsWith('https://mod.reddit.com');

    if (linkMatches) {
        let squashed = `l,${linkMatches[1]}`;
        if (linkMatches[2] !== undefined) {
            squashed += `,${linkMatches[2]}`;
        }
        return squashed;
    } else if (modMailMatches) {
        return `m,${modMailMatches[1]}`;
    } else if (newModMailMatches) {
        return permalink;
    } else {
        return '';
    }
};

self._unsquashPermalink = function (subreddit, permalink) {
    if (!permalink) {
        return '';
    }

    if (permalink.startsWith('https://mod.reddit.com')) {
        return permalink;
    } else {
        const linkParams = permalink.split(/,/g);
        let link = `/r/${subreddit}/`;

        if (linkParams[0] === 'l') {
            link += `comments/${linkParams[1]}/`;
            if (linkParams.length > 2) {
                link += `-/${linkParams[2]}/`;
            }
        } else if (linkParams[0] === 'm') {
            link += `message/messages/${linkParams[1]}`;
        } else {
            return '';
        }

        return link;
    }
};

/**
     * Gets the usernote types to use for the given subreddit.
     * @param {string} subreddit The subreddit to fetch colors for
     * @returns {Promise} Resolves with the usernote types as an object
     */
self.getSubredditColors = async function (subreddit) {
    self.log(`Getting subreddit colors for /r/${subreddit}`);
    const config = await TBCore.getConfig(subreddit);
    if (config && config.usernoteColors && config.usernoteColors.length > 0) {
        self.log(`  Config retrieved for /r/${subreddit}`);
        return config.usernoteColors;
    } else {
        self.log(`  Config not retrieved for ${subreddit}, using default colors`);
        return TBCore.defaultUsernoteTypes;
    }
};

self._findSubredditColor = function (colors, key) {
    // TODO: make more efficient for repeated operations, like using an object
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].key === key) {
            return colors[i];
        }
    }
    return {key: 'none', color: '', text: ''};
};

export default self;
