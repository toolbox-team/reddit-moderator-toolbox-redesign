import {Module} from '../tbmodule.js';
import {template} from '../tbhelpers.js';
import {debugInformation} from '../tbcore.js';

const self = new Module('Support Module');
self.shortname = 'support';

self.settings['enabled']['default'] = true;

// How about you don't disable support?  No other module should ever do this. Well except for modbar.
self.settings['enabled']['hidden'] = true; // Don't disable it, either!

self.init = function () {
    const $body = $('body');
    const debugTemplate = `

---
***Toolbox debug information***

Info| &nbsp;
---|---
*Toolbox version*|{{toolboxVersion}}
*Browser name*|{{browserName}}
*Browser version*|{{browserVersion}}
*Platform information*|{{platformInfo}}
*Beta Mode*|{{betaMode}}
*Debug Mode*|{{debugMode}}
*Compact Mode*|{{compactMode}}
*Advanced Settings*|{{advancedSettings}}
*Cookies Enabled*|{{cookiesEnabled}}
`;

    const debugInfo = debugInformation();
    const submissionAddition = template(debugTemplate, {
        toolboxVersion: debugInfo.toolboxVersion,
        browserName: debugInfo.browser,
        browserVersion: debugInfo.browserVersion,
        platformInfo: debugInfo.platformInformation,
        betaMode: debugInfo.betaMode,
        debugMode: debugInfo.debugMode,
        compactMode: debugInfo.compactMode,
        advancedSettings: debugInfo.advancedSettings,
        cookiesEnabled: debugInfo.cookiesEnabled,
    });

    // If we are on the submit page we add debug information when a user makes a post.
    if (location.pathname.match(/\/r\/toolbox\/submit\/?/) || location.pathname.match(/\/r\/tb_dev\/submit\/?/)) {
        const $submissionTextArea = $('.usertext-edit.md-container textarea');

        $body.on('click', '.submit.content .btn[name="submit"]', () => {
            // First we stop the action on the button for a bit.
            // event.preventDefault();
            const submissionText = $submissionTextArea.val();

            $submissionTextArea.val(submissionText + submissionAddition);
        });
    }

    // If we are in the comment section we offer a button to insert the info.
    if (location.pathname.match(/\/r\/toolbox\/comments\/?/) || location.pathname.match(/\/r\/tb_dev\/comments\/?/)) {
        const $usertextButtons = $body.find('.usertext-edit .usertext-buttons');

        const $saveButton = $usertextButtons.find('.save');
        const $tbUsertextButtons = $saveButton.parent().find('.tb-usertext-buttons');

        // This needs to be a div otherwise reddit thinks a save button is clicked.
        const $debugInsertButton = $('<div class="tb-action-button tb-insert-debug">Insert debug info</div>');
        if ($tbUsertextButtons.length) {
            $tbUsertextButtons.before($debugInsertButton);
        } else {
            $saveButton.parent().find('.status').before($('<div>').addClass('tb-usertext-buttons').append($debugInsertButton));
        }

        $('body').on('click', 'div.tb-insert-debug', function () {
            self.log('Insert debug clicked!');
            const $commentTextArea = $(this).closest('.usertext-edit.md-container').find('.md textarea');
            const currentComment = $commentTextArea.val();

            $commentTextArea.val(currentComment + submissionAddition);
        });
    }
};

export default self;
