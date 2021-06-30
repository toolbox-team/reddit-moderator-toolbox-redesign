import TBLog from './tblog.js';
import * as TBStorage from './tbstorage.js';
import {delay} from './tbhelpers.js';

/**
 * Checks for reset conditions. Promises `true` if settings are being reset and
 * the rest of toolbox's init process should be cancelled.
 * @returns {Promise<boolean>}
 */
async function checkReset () {
    if (window.location.href.includes('/r/tb_reset/comments/26jwfh')) {
        if (!confirm('This will reset all your toolbox settings. Would you like to proceed?')) {
            return false;
        }

        // Clear local extension storage if we have access to extension storage
        await browser.storage.local.remove('tbsettings');

        // Clear background page localStorage (stores cache information)
        await browser.runtime.sendMessage({
            action: 'tb-cache',
            method: 'clear',
        });

        // Delay for one second to be extra sure everything has been processed
        await delay(1000);

        // Send the user to the confirmation page
        const domain = window.location.hostname.split('.')[0];
        window.location.href = `//${domain}.reddit.com/r/tb_reset/comments/26jwpl/your_toolbox_settings_have_been_reset/`;
        return true;
    }
}

/**
 * Checks whether or not there's a user logged in, retrying a handful of times
 * in case new Reddit hasn't fully loaded yet. Also checks if we've already
 * loaded in this window, and whether we're in a Firefox incognito window. If
 * this function ultimately returns `false`, the init process should end early.
 * @param {number} [tries=3] Number of times to try getting a logged-in user
 * @returns {Promise<void>}
 */
async function checkLoadConditions (tries = 3) {
    let loggedinRedesign = false,
        loggedinOld = false;

    const $body = $('body');

    // Check for redesign
    if ($body.find('#USER_DROPDOWN_ID').text() || $body.find('.BlueBar__account a.BlueBar__username').text() || $body.find('.Header__profile').length) {
        loggedinRedesign = true;
    }

    // Check for old reddit
    if ($body.find('form.logout input[name=uh]').val() || $body.find('.Header__profile').length || $body.hasClass('loggedin')) {
        loggedinOld = true;
    }

    if (!loggedinOld && !loggedinRedesign) {
        if (tries < 1) {
            // We've tried a bunch of times and still don't have anything, so
            // assume there's no logged-in user
            throw new Error('Did not detect a logged in user, Toolbox will not start');
        } else {
            // Give it another go
            await new Promise(resolve => setTimeout(resolve, 500));
            return checkLoadConditions(tries - 1);
        }
    }

    // When firefox updates extension they get reloaded including all content scripts. Old elements remain on the page though.
    // Toolbox doesn't like this very much.
    // We are using this class because of the migration mess with v4.
    if ($body.hasClass('mod-toolbox')) {
        $body.attr('toolbox-warning', 'This page must be reloaded for toolbox to function correctly.');
        throw new Error('Toolbox has already been loaded in this window');
    }

    // https://bugzilla.mozilla.org/show_bug.cgi?id=1380812#c7
    // https://github.com/toolbox-team/reddit-moderator-toolbox/issues/98
    if ((typeof InstallTrigger !== 'undefined' || 'MozBoxSizing' in document.body.style) && browser.extension.inIncognitoContext) {
        throw new Error('Firefox is in Incognito mode, Toolbox will not work');
    }

    $body.addClass('mod-toolbox');
}

/** A promise that will resolve once TBCore is ready. */
// TODO
const coreLoadedPromise = new Promise(resolve => {
    window.addEventListener('_coreLoaded', resolve, {once: true});
});

(async () => {
    // Handle settings reset and return early if we're doing that
    if (await checkReset()) {
        return;
    }

    // HACK: We still need to export TBLog to some stuff for legacy logging
    window.TBLog = TBLog;

    // Create a logger
    const logger = TBLog('Init');

    // Ensure that other conditions are met, and return early if not
    try {
        await checkLoadConditions();
    } catch (error) {
        logger.error('Load condition not met:', error.message);
        return;
    }

    // Do settings echo before anything else.  If it fails, exit toolbox.
    if (await TBStorage.setSettingAsync('Utils', 'echoTest', 'echo') !== 'echo') {
        alert('toolbox can not save settings\n\ntoolbox will now exit');
        return;
    }

    import(browser.runtime.getURL('data/tbcore.js'));
    await coreLoadedPromise;

    // Load feature modules and register them
    await Promise.all([
        'data/modules/devtools.js',
        'data/modules/support.js',
        'data/modules/modbar.js',
        'data/modules/config.js',
        'data/modules/betterbuttons.js',
        'data/modules/domaintagger.js',
        'data/modules/modmatrix.js',
        'data/modules/syntax.js',
        'data/modules/modbutton.js',
        'data/modules/general.js',
        'data/modules/notifier.js',
        'data/modules/usernotes.js',
        'data/modules/comment.js',
        'data/modules/newmodmailpro.js',
        'data/modules/modmailpro.js',
        'data/modules/macros.js',
        'data/modules/personalnotes.js',
        'data/modules/historybutton.js',
        'data/modules/removalreasons.js',
        'data/modules/nukecomments.js',
        'data/modules/trouble.js',
        'data/modules/profile.js',
        'data/modules/queue_overlay.js',
        'data/modules/flyingsnoo.js',
        'data/modules/queuetools.js',
        'data/modules/achievements.js',
        'data/modules/oldreddit.js',
    ].map(async modulePath => {
        const {default: m} = await import(browser.runtime.getURL(modulePath));
        logger.debug('Registering module', m);
        window.TB.register_module(m);
    }));

    // Once all modules are registered, call TB.init() to run them
    window.TB.init();
})();
