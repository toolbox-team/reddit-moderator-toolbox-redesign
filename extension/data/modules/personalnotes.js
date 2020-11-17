'use strict';

function personalnotes () {
    const self = new TB.Module('Personal Notes');
    self.shortname = 'PNotes';

    self.settings['enabled']['default'] = false;

    self.register_setting('noteWiki', {
        type: 'subreddit',
        default: '',
        title: 'Subreddit you want to use to store your personal notes.',
    });
    self.register_setting('popupHeight', {
        type: 'number',
        default: 300,
        title: 'Default height, in pixels, for the text editor',
    });
    self.register_setting('monospace', {
        type: 'boolean',
        default: false,
        title: 'Use a monospace font in the text editor',
    });

    self.init = function () {
        if (TBCore.isEmbedded) {
            return;
        }
        const notewiki = self.setting('noteWiki').toLowerCase(),
              popupHeight = self.setting('popupHeight'),
              monospace = self.setting('monospace'),
              $body = $('body');
        let notesArray = [],
            notesPopupContent;

        // Template HTML for each item in the note list
        const noteListTemplate = `
            <li>
                <a href="javascript:void(0)" class="tb-personal-note-delete tb-icons tb-icons-negative" data-wiki="{{name}}">
                    ${TBui.icons.delete}
                </a>
                <a href="javascript:void(0)" class="tb-personal-note-link" data-wiki="{{name}}">
                    {{name}}
                </a>
            </li>
        `;

        // Here we create the popup containing all relevant information
        function createPersonalNotesPopup (notesPopupContent) {
            TB.ui.popup({
                title: 'Personal notes',
                tabs: [
                    {
                        title: 'Personal notes',
                        id: 'personal-notes', // reddit has things with class .role, so it's easier to do this than target CSS
                        tooltip: 'Edit macro',
                        content: notesPopupContent,
                        footer: '<input type="button" class="tb-action-button" id="save-personal-note" value="save note">',
                    },
                ],
                cssClass: 'personal-notes-popup',
            }).appendTo('body');
        }

        // Let's load a note!

        function loadNoteWiki (wikiPage) {
            $body.find('#tb-personal-notes-landing').remove();

            const $editArea = $body.find('#tb-personal-notes-editarea');
            $editArea.val('loading stuff...').attr('disabled', true);
            $editArea.css('display', 'block');

            TBApi.readFromWiki(notewiki, `notes/${wikiPage}`, false).then(resp => {
                if (resp === TBApi.WIKI_PAGE_UNKNOWN) {
                    $editArea.val('error getting wiki data.');
                    TB.ui.textFeedback('error getting wiki data.', TB.ui.FEEDBACK_NEGATIVE);
                    return;
                }

                if (resp === TBApi.NO_WIKI_PAGE) {
                    $editArea.val('Not sure how you did this, but this is not an existing page.');
                    TB.ui.textFeedback('error getting wiki data.', TB.ui.FEEDBACK_NEGATIVE);
                    return;
                }

                resp = TBHelpers.unescapeJSON(resp);

                // Found it, show it.
                $editArea.val(resp).attr('disabled', false);
                const $saveButton = $body.find('#save-personal-note');

                $saveButton.attr('data-note', wikiPage);
                $saveButton.show();
            });
        }

        function saveNoteWiki (page, subreddit, data, reason, newnote) {
            self.log('posting to wiki');
            TB.ui.textFeedback('saving to wiki', TB.ui.FEEDBACK_NEUTRAL);
            TBApi.postToWiki(`notes/${page}`, subreddit, data, reason, false, false).then(() => {
                self.log('clearing cache');
                TB.ui.textFeedback('wiki page saved', TB.ui.FEEDBACK_POSITIVE);

                if (newnote) {
                    $body.find('.tb-personal-notes-active').removeClass('tb-personal-notes-active');

                    if (!$body.find('#tb-personal-notes-ul').length) {
                        $body.find('#tb-personal-notes-nonotes').replaceWith('<ul id="tb-personal-notes-ul"></ul>');
                    }
                    const $noteItem = $(TBHelpers.template(noteListTemplate, {name: page}));
                    $noteItem.toggleClass('tb-personal-notes-active', true);
                    $body.find('#tb-personal-notes-ul').append($noteItem);

                    loadNoteWiki(page);
                }
            }).catch(err => {
                self.log(err.responseText);
                TB.ui.textFeedback(err.responseText, TB.ui.FEEDBACK_NEGATIVE);
            });
        }

        // add the button to the modbar
        $body.find('#tb-toolbarshortcuts').before(' <a href="javascript:void(0)" class="tb-modbar-button" id="tb-personal-notes-button">Personal Notes</a>');

        // Since we have a button we can click on it!
        $body.on('click', '#tb-personal-notes-button', function () {
            const $this = $(this);

            // Making sure the ui is only created once.
            if (!$this.hasClass('tb-notes-activated')) {
                $this.addClass('tb-notes-activated');
                // We need to make sure we have access to our mod subs. Since this depends on an async call we have to wrap the below code in getModSubs
                TBCore.getModSubs(() => {
                    // We can't expect people to get the capitalizing right.
                    const mySubsLowerCase = [];
                    $(TBCore.mySubs).each(function () {
                        mySubsLowerCase.push(this.toLowerCase());
                    });

                    // Empty subreddit.
                    if (notewiki === '') {
                        notesPopupContent = '<span class="error">You have not set a subreddit in your settings to store your notes on.</span>';
                        createPersonalNotesPopup(notesPopupContent);

                    // You can only use subreddits you mod, simply because of privacy we set all notes to only visible for mods.
                    } else if (!mySubsLowerCase.includes(notewiki)) {
                        notesPopupContent = `<span class="error">You are not a mod of /r/${notewiki}.</span>`;
                        createPersonalNotesPopup(notesPopupContent);
                    } else {
                        // build a template, we only need to insert one variable but this is cleaner and more feature proof.
                        const notesPopupContentTemplate = `
                    <table style="height:${popupHeight}px;"><tr>
                        <td id="tb-personal-notes-listing">
                            <div id="tb-personal-notes-list">
                                {{notesList}}
                            </div>
                            <div id="tb-new-personal-note-div">
                                <label for="tb-new-personal-note">
                                    Create note:
                                </label>
                                <input type="text" class="tb-input" name="tb-new-personal-note" id="tb-new-personal-note" placeholder="note name"><br>
                                <input type="button" id="create-personal-note" class="tb-action-button" value="create note">
                            </div>

                        </td>
                        <td id="tb-personal-notes-content">
                            <div id="tb-personal-notes-landing">
                                <span>Welcome to your personal notes!</span>
                                <span class="tb-personal-notes-landing-subtitle">Click or create a note on the left to get started.</span>
                            </div>
                            <textarea class="tb-input" id="tb-personal-notes-editarea" ${monospace ? 'style="font-family: monospace;"' : ''}></textarea>
                        </td>
                    </tr></table>`;

                        // Lets get a list of notes!
                        TBApi.getJSON(`/r/${notewiki}/wiki/pages.json`)
                            .then(json => {
                                notesArray = [];
                                let notesList;
                                const count = json.data.length || 0;

                                if (count === 0) {
                                    notesList = '<span id="tb-personal-notes-nonotes">No notes found.</span>';
                                } else {
                                    let notecount = 0,
                                        noteListConstruction = '<ul id="tb-personal-notes-ul"> \n';

                                    json.data.forEach(value => {
                                        if (/notes\//.test(value)) {
                                            value = value.replace('notes/', '');
                                            notecount++;
                                            notesArray.push(value);
                                            noteListConstruction += TBHelpers.template(noteListTemplate, {name: value});
                                        }
                                    });

                                    if (notecount === 0) {
                                        notesList = '<span id="tb-personal-notes-nonotes">No notes found.</span>';
                                    } else {
                                        noteListConstruction += '</ul>';
                                        notesList = noteListConstruction;
                                    }
                                }

                                notesPopupContent = TBHelpers.template(notesPopupContentTemplate, {
                                    notesList,
                                });
                                createPersonalNotesPopup(notesPopupContent);
                            })
                            .catch(() => {
                                TB.ui.textFeedback('<s>Computer</s> reddit says noooo, try again.', TB.ui.FEEDBACK_NEGATIVE);
                                $this.removeClass('tb-notes-activated');
                            });
                    }
                });
            } else {
            // The UI already exists, so let's destroy it.
                $('.personal-notes-popup').remove();
                $this.removeClass('tb-notes-activated');
            }
        });

        // When clicking a wiki page.
        $body.on('click', '.personal-notes-popup .tb-personal-note-link', function () {
            const $this = $(this),
                  wikiPage = $this.data('wiki');
            // $body.find('.tb-personal-notes-active').removeClass('tb-personal-notes-active');
            $body.find('#tb-personal-notes-ul').find('li').removeClass('tb-personal-notes-active');
            // $this.addClass('tb-personal-notes-active');
            $this.closest('li').addClass('tb-personal-notes-active');

            loadNoteWiki(wikiPage);
        });

        // When clicking the delete button
        $body.on('click', '.tb-personal-note-delete', function () {
            const $this = $(this);
            const page = $this.data('wiki');

            const confirmDelete = confirm(`This will de-list "${page}", are you sure?`);
            if (confirmDelete) {
                TBApi.sendRequest({
                    okOnly: true,
                    method: 'POST',
                    endpoint: `/r/${notewiki}/wiki/settings/`,
                    body: {
                        page: `notes/${page}`,
                        listed: false,
                        permlevel: 2,
                        uh: TBCore.modhash,
                    },
                }).then(() => {
                    $this.closest('li').remove();
                }).catch(() => {
                    TB.ui.textFeedback('Could not de-list the note, try again in a bit.', TB.ui.FEEDBACK_NEGATIVE);
                });
            }
        });
        // When clicking 'create note'
        $body.on('click', '.personal-notes-popup #create-personal-note', function () {
            let newNotename = $(this).siblings('#tb-new-personal-note').val();

            newNotename = newNotename.trim();
            newNotename = TBHelpers.title_to_url(newNotename);

            if (newNotename === '') {
                TB.ui.textFeedback('You should try filling in an actual name...', TB.ui.FEEDBACK_NEGATIVE);
            } else if (notesArray.includes(newNotename)) {
                TB.ui.textFeedback('That already is a note.', TB.ui.FEEDBACK_NEGATIVE);
            } else {
                notesArray.push(newNotename);
                saveNoteWiki(newNotename, notewiki, 'New note', 'toolbox new personal note', true);
            }
        });

        // when clicking 'save note'

        $body.on('click', '.personal-notes-popup #save-personal-note', function () {
            const $this = $(this);
            const page = $this.attr('data-note'),
                  data = $body.find('#tb-personal-notes-editarea').val(),
                  reason = 'Saving personal toolbox note';
            saveNoteWiki(page, notewiki, data, reason, false);
        });

        $body.on('click', '.personal-notes-popup .close', function () {
            $(this).closest('.personal-notes-popup').remove();
            $body.find('#tb-personal-notes-button').removeClass('tb-notes-activated');
        });
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    personalnotes();
}, {
    once: true,
});
