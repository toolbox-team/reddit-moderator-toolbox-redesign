'use strict';
// This is here because we load even before TBCore.
const domain = window.location.hostname.split('.')[0];

// Reset toolbox settings support
// load storage if we're not on the reset page.
if (window.location.href.indexOf('/r/tb_reset/comments/26jwfh/click_here_to_reset_all_your_toolbox_settings/') < 0) {
    storagewrapper();
} else {
    startReset();
}

// Clear all toolbox related items.
// After that direct users to a page confirming settings have been reset.
function clearLocal () {
    // Cache.
    browser.runtime.sendMessage({
        action: 'tb-cache',
        method: 'clear',
    }).then(() => {
        // Wait a sec for stuff to clear.
        setTimeout(() => {
            window.location.href = `//${domain}.reddit.com/r/tb_reset/comments/26jwpl/your_toolbox_settings_have_been_reset/`;
        }, 1000);
    });
}

function startReset () {
    const r = confirm('This will reset all your toolbox settings.  Would you like to proceed?');
    if (r === true) {
        // Chrome, Edge en firefox webextensions.
        if (typeof chrome !== 'undefined') {
            browser.storage.local.remove('tbsettings').then(() => {
                // Wait a sec for stuff to clear.
                setTimeout(() => {
                    clearLocal();
                }, 1000);
            });

        // Shouldn't happen as they don't have storage if this happens. But... you never know..
        } else {
            setTimeout(() => {
                clearLocal();
            }, 1000);
        }
    }
}

function storagewrapper () {
    (function (TBStorage) {
        const logger = TBLog('TBStorage');
        profileResults('storageStart', performance.now());

        const SHORTNAME = 'TBStorage';

        TBStorage.settings = [];

        let TBsettingsObject;
        TBStorage.domain = window.location.hostname.split('.')[0];

        $.log(`Domain: ${TBStorage.domain}`, false, SHORTNAME);

        TBStorage.isLoaded = false;

        browser.storage.local.get('tbsettings').then(sObject => {
            if (sObject.tbsettings) {
                TBsettingsObject = sObject.tbsettings;

                // Paranoid, malicious settings might be stored.
                purifyObject(TBsettingsObject);

                SendInit();
            } else {
                TBsettingsObject = {};
                SendInit();
            }

            // Listen for updated settings and update the settings object.
            browser.runtime.onMessage.addListener(message => {
                // A complete settings object. Likely because settings have been saved or imported. Make sure to notify the user if they have settings open in this tab.
                if (message.action === 'tb-settings-update') {
                    TBsettingsObject = message.payload.tbsettings;
                    const $body = $('body');
                    $body.find('.tb-window-footer').addClass('tb-footer-save-warning');
                    $('body').find('.tb-personal-settings .tb-save').before('<div class="tb-save-warning">Settings have been saved in a different browser tab! Saving from this window will overwrite those settings.</div>');
                }

                // Single setting. Usually reserved for background operations as such we'll simply update it in the backround.
                if (message.action === 'tb-single-setting-update') {
                    TBsettingsObject[message.payload.key] = message.payload.value;
                    const keySplit = message.payload.key.split('.');
                    const detailObject = {
                        module: keySplit[1],
                        setting: keySplit[2],
                        value: message.payload.value,
                    };

                    window.dispatchEvent(new CustomEvent('tbSingleSettingUpdate', {
                        detail: detailObject,
                    }));
                }
            });
        });

        // public methods.
        TBStorage.setSetting = setSetting;
        TBStorage.getSetting = getSetting;

        TBStorage.setCache = setCache;

        TBStorage.getCache = getCache;

        TBStorage.unloading = saveSettingsToBrowser;

        TBStorage.purify = purify;

        TBStorage.purifyObject = purifyObject;

        TBStorage.getAnonymizedSettingsObject = function (callback) {
            if (!callback) {
                return;
            }
            settingsToObject(sObject => {
                // settings we delete
                delete sObject['Toolbox.Achievements.lastSeen'];
                delete sObject['Toolbox.Achievements.last_seen'];
                delete sObject['Toolbox.Bagels.bagelType'];
                delete sObject['Toolbox.Bagels.enabled'];
                delete sObject['Toolbox.Modbar.customCSS'];
                delete sObject['Toolbox.ModMail.lastVisited'];
                delete sObject['Toolbox.ModMail.replied'];
                delete sObject['Toolbox.ModMail.subredditColorSalt'];
                delete sObject['Toolbox.Notifier.lastChecked'];
                delete sObject['Toolbox.Notifier.lastSeenModmail'];
                delete sObject['Toolbox.Notifier.lastSeenUnmoderated'];
                delete sObject['Toolbox.Notifier.modmailCount'];
                delete sObject['Toolbox.Notifier.modqueueCount'];
                delete sObject['Toolbox.Notifier.modqueuePushed'];
                delete sObject['Toolbox.Notifier.unmoderatedCount'];
                delete sObject['Toolbox.Notifier.unreadMessageCount'];
                delete sObject['Toolbox.Notifier.unreadPushed'];
                delete sObject['Toolbox.QueueTools.kitteh'];
                delete sObject['Toolbox.RReasons.customRemovalReason'];
                delete sObject['Toolbox.Snoo.enabled'];
                delete sObject['Toolbox.Storage.settings'];
                delete sObject['Toolbox.Utils.echoTest'];
                delete sObject['Toolbox.Utils.tbDevs'];

                // these settings we want the length of the val.
                sObject['Toolbox.Comments.highlighted'] = undefindedOrLength(sObject['Toolbox.Comments.highlighted']);
                sObject['Toolbox.ModButton.savedSubs'] = undefindedOrLength(sObject['Toolbox.ModButton.savedSubs']);
                sObject['Toolbox.ModMail.botsToFilter'] = undefindedOrLength(sObject['Toolbox.ModMail.botsToFilter']);
                sObject['Toolbox.ModMail.filteredSubs'] = undefindedOrLength(sObject['Toolbox.ModMail.filteredSubs']);
                sObject['Toolbox.Modbar.shortcuts'] = undefindedOrLength(sObject['Toolbox.Modbar.shortcuts']);
                sObject['Toolbox.QueueTools.botCheckmark'] = undefindedOrLength(sObject['Toolbox.QueueTools.botCheckmark']);
                sObject['Toolbox.Utils.seenNotes'] = undefindedOrLength(sObject['Toolbox.Utils.seenNotes']);

                // these settings we just want to know if they are populated at all
                sObject['Toolbox.Achievements.save'] = undefindedOrTrue(sObject['Toolbox.Achievements.save']);
                sObject['Toolbox.ModButton.lastAction'] = undefindedOrTrue(sObject['Toolbox.ModButton.lastAction']);
                sObject['Toolbox.Modbar.lastExport'] = undefindedOrTrue(sObject['Toolbox.Modbar.lastExport']);
                sObject['Toolbox.Notifier.modSubreddits'] = undefindedOrTrue(sObject['Toolbox.Notifier.modSubreddits']);
                sObject['Toolbox.Notifier.modmailSubreddits'] = undefindedOrTrue(sObject['Toolbox.Notifier.modmailSubreddits']);
                sObject['Toolbox.Notifier.unmoderatedSubreddits'] = undefindedOrTrue(sObject['Toolbox.Notifier.unmoderatedSubreddits']);
                sObject['Toolbox.PNotes.noteWiki'] = undefindedOrTrue(sObject['Toolbox.PNotes.noteWiki']);
                sObject['Toolbox.QueueTools.queueCreature'] = undefindedOrTrue(sObject['Toolbox.QueueTools.queueCreature']);
                sObject['Toolbox.QueueTools.subredditColorSalt'] = undefindedOrTrue(sObject['Toolbox.QueueTools.subredditColorSalt']);
                sObject['Toolbox.Utils.settingSub'] = undefindedOrTrue(sObject['Toolbox.Utils.settingSub']);

                callback(sObject);

                function undefindedOrLength (setting) {
                    return setting === undefined ? 0 : setting.length;
                }

                function undefindedOrTrue (setting) {
                    if (!setting) {
                        return false;
                    }
                    if (setting.length > 0) {
                        return true;
                    }
                }
            });
        };

        TBStorage.clearCache = async function () {
            await clearCache();

            await setCache('Utils', 'configCache', {});
            await setCache('Utils', 'noteCache', {});
            await setCache('Utils', 'rulesCache', {});
            await setCache('Utils', 'noConfig', []);
            await setCache('Utils', 'noNotes', []);
            await setCache('Utils', 'noRules', []);
            await setCache('Utils', 'moderatedSubs', []);
            await setCache('Utils', 'moderatedSubsData', []);
        };

        // The below block of code will keep watch for events that require clearing the cache like account switching and people accepting mod invites.
        $('body').on('click', '#RESAccountSwitcherDropdown .accountName, #header-bottom-right .logout, .toggle.moderator .option', () => {
            TBStorage.clearCache();
        });

        TBStorage.verifiedSettingsSave = function (callback) {
            settingsToObject(sObject => {
                const settingsObject = sObject;

                // save settings
                browser.storage.local.set({
                    tbsettings: sObject,
                }).then(() => {
                    // now verify them
                    browser.storage.local.get('tbsettings').then(returnObject => {
                        if (returnObject.tbsettings && returnObject.tbsettings !== undefined
                        && isEquivalent(returnObject.tbsettings, settingsObject)) {
                            // Succes, tell other browser tabs with toolbox that there are new settings.
                            browser.runtime.sendMessage({
                                action: 'tb-global',
                                globalEvent: 'tb-settings-update',
                                payload: returnObject,
                            });
                            callback(true);
                        } else {
                            $.log('Settings could not be verified', false, SHORTNAME);
                            callback(false);
                        }
                    });
                });
            });
        };

        // private methods.
        function SendInit () {
            // Check if we are logged in and if we want to activate on old reddit as well.
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

            // When firefox updates extension they get reloaded including all content scripts. Old elements remain on the page though.
            // Toolbox doesn't like this very much.
            // We are using this class because of the migration mess with v4.
            if ($body.hasClass('mod-toolbox')) {
                $body.attr('toolbox-warning', 'This page must be reloaded for toolbox to function correctly.');
                return;
            }

            // https://bugzilla.mozilla.org/show_bug.cgi?id=1380812#c7
            // https://github.com/toolbox-team/reddit-moderator-toolbox/issues/98
            if ((typeof InstallTrigger !== 'undefined' || 'MozBoxSizing' in document.body.style) && browser.extension.inIncognitoContext) {
                logger.error('firefox is in incognito mode, toolbox will not work.');
                return;
            }

            // Check for mobile reddit
            if ($body.find('.AppMainPage').length && getSetting('GenSettings', 'redirectMobileToDesktop', false)) {
                browser.runtime.sendMessage({
                    action: 'tb-mobile-cookie',
                }).then(() => {
                    window.location.reload();
                });
            }

            if (loggedinOld || loggedinRedesign) {
                $body.addClass('mod-toolbox-rd');
                $body.addClass('mod-toolbox');
                setTimeout(() => {
                    profileResults('storageLoaded', performance.now());
                    const event = new CustomEvent('TBStorageLoaded');
                    window.dispatchEvent(event);
                }, 10);
            }
        }

        function purify (input) {
            return DOMPurify.sanitize(input, {SAFE_FOR_JQUERY: true});
        }

        function registerSetting (module, setting) {
        // First parse out any of the ones we never want to save.
            if (module === undefined || module === 'cache') {
                return;
            }

            const keyName = `${module}.${setting}`;

            if (!TBStorage.settings.includes(keyName)) {
                TBStorage.settings.push(keyName);
            }
        }

        function purifyObject (input) {
            for (const key in input) {
                if (Object.prototype.hasOwnProperty.call(input, key)) {
                    const itemType = typeof input[key];
                    switch (itemType) {
                    case 'object':
                        purifyObject(input[key]);
                        break;
                    case 'string':
                        // Let's see if we are dealing with json.
                        // We want to handle json properly otherwise the purify process will mess up things.
                        try {
                            const jsonObject = JSON.parse(input[key]);
                            purifyObject(jsonObject);
                            input[key] = JSON.stringify(jsonObject);
                        } catch (e) {
                            // Not json, simply purify
                            input[key] = TBStorage.purify(input[key]);
                        }
                        break;
                    case 'function':
                        // If we are dealing with an actual function something is really wrong and we'll overwrite it.
                        input[key] = 'function';
                        break;
                    case 'number':
                    case 'boolean':
                    case 'undefined':
                        // Do nothing with these as they are supposed to be safe.
                        break;
                    default:
                        // If we end here we are dealing with a type we don't expect to begin with. Begone!
                        input[key] = `unknown item type ${itemType}`;
                    }
                }
            }
        }

        function purifyThing (input) {
            let output;
            const itemType = typeof input;
            switch (itemType) {
            case 'object':
                purifyObject(input);
                output = input;
                break;
            case 'string':
                // Let's see if we are dealing with json.
                // We want to handle json properly otherwise the purify process will mess up things.
                try {
                    const jsonObject = JSON.parse(input);
                    purifyObject(jsonObject);
                    output = JSON.stringify(jsonObject);
                } catch (e) {
                    // Not json, simply purify
                    output = purify(input);
                }
                break;
            case 'function':
                // If we are dealing with an actual function something is really wrong and we'll overwrite it.
                output = 'function';
                break;
            case 'number':
            case 'boolean':
            case 'undefined':
                // Do nothing with these as they are supposed to be safe.
                output = input;
                break;
            default:
                // If we end here we are dealing with a type we don't expect to begin with. Begone!
                output = `unknown item type ${itemType}`;
            }

            return output;
        }

        function settingsToObject (callback) {
            // We make a deep clone of the settings object so it can safely be used and manipulated for things like anonymized exports.
            const settingsObject = JSON.parse(JSON.stringify(TBsettingsObject));

            // We are paranoid, so we are going to purify the object first.s
            purifyObject(settingsObject);

            callback(settingsObject);
        }

        function saveSettingsToBrowser () {
            settingsToObject(sObject => {
                browser.storage.local.set({
                    tbsettings: sObject,
                });
            });
        }

        function getSetting (module, setting, defaultVal) {
            const storageKey = `Toolbox.${module}.${setting}`;
            registerSetting(module, setting);

            defaultVal = defaultVal !== undefined ? defaultVal : null;
            let result;

            if (TBsettingsObject[storageKey] === undefined) {
                return defaultVal;
            } else {
                result = TBsettingsObject[storageKey];

                // send back the default if, somehow, someone stored `null`
                // NOTE: never, EVER store `null`!
                if (result === null
                && defaultVal !== null
                ) {
                    result = defaultVal;
                }

                // Again, being extra paranoid here but let's sanitize.
                const sanitzedResult = purifyThing(result);
                return sanitzedResult;
            }
        }

        // SyncSetting is responsible for saving the setting from the local object to extension storage.
        // As such it should ALMOST ALWAYS be left default. You only use false if you are 100% sure all settings will be stored later.
        function setSetting (module, setting, value, syncSettings = true) {
            const storageKey = `Toolbox.${module}.${setting}`;
            registerSetting(module, setting);

            // Sanitize the setting
            const sanitzedValue = purifyThing(value);

            TBsettingsObject[storageKey] = sanitzedValue;
            // try to save our settings.
            if (syncSettings) {
                saveSettingsToBrowser();

                // Communicate the new setting to other open tabs.
                browser.runtime.sendMessage({
                    action: 'tb-global',
                    globalEvent: 'tb-single-setting-update',
                    excludeBackground: true,
                    payload: {
                        key: storageKey,
                        value: sanitzedValue,
                    },
                });
            }

            return getSetting(module, setting);
        }

        function getCache (module, setting, defaultVal) {
            return new Promise(resolve => {
                const storageKey = `TBCache.${module}.${setting}`;
                const inputValue = defaultVal !== undefined ? defaultVal : null;
                browser.runtime.sendMessage({
                    action: 'tb-cache',
                    method: 'get',
                    storageKey,
                    inputValue,
                }).then(response => {
                    if (response.errorThrown !== undefined) {
                        $.log(`${storageKey} is corrupted.  Sending default.`, false, SHORTNAME);
                        resolve(defaultVal);
                    } else {
                        resolve(response.value);
                    }
                });
            });
        }

        function setCache (module, setting, inputValue) {
            const storageKey = `TBCache.${module}.${setting}`;
            return new Promise(resolve => {
                browser.runtime.sendMessage({
                    action: 'tb-cache',
                    method: 'set',
                    storageKey,
                    inputValue,
                }).then(async () => {
                    const value = await getCache(module, setting);
                    resolve(value);
                });
            });
        }

        function clearCache () {
            return new Promise(resolve => {
                browser.runtime.sendMessage({
                    action: 'tb-cache',
                    method: 'clear',
                }).then(() => {
                    resolve();
                });
            });
        }

        // based on: http://designpepper.com/blog/drips/object-equality-in-javascript.html
        // added recursive object checks - al
        function isEquivalent (a, b) {
        // Create arrays of property names
            const aProps = Object.getOwnPropertyNames(a),
                  bProps = Object.getOwnPropertyNames(b);

            // If number of properties is different,
            // objects are not equivalent
            if (aProps.length !== bProps.length) {
                $.log(`length :${aProps.length} ${bProps.length}`);
                return false;
            }

            for (let i = 0; i < aProps.length; i++) {
                const propName = aProps[i];
                const propA = a[propName],
                      propB = b[propName];

                // If values of same property are not equal,
                // objects are not equivalent
                if (propA !== propB) {
                    if (typeof propA === 'object' && typeof propB === 'object') {
                        if (!isEquivalent(propA, propB)) {
                            $.log(`prop :${propA} ${propB}`);
                            return false;
                        }
                    } else {
                        $.log(`prop :${propA} ${propB}`);
                        return false;
                    }
                }
            }

            // If we made it this far, objects
            // are considered equivalent
            return true;
        }
    })(window.TBStorage = window.TBStorage || {});
}
