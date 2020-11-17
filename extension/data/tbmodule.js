'use strict';
function tbmodule () {
    window.TB = {
        ui: TBui,
        storage: TBStorage,
        listener: TBListener,

        modules: {},
        moduleList: [],

        register_module (module) {
            this.moduleList.push(module.shortname);
            this.modules[module.shortname] = module;
        },

        init: function tbInit () {
            profileResults('tbInit', performance.now());
            initLoop();

            function initLoop () {
                setTimeout(() => {
                    $.log('TBModule has TBStorage, loading modules', false, 'TBinit');
                    // call every module's init() method on page load
                    for (let i = 0; i < TB.moduleList.length; i++) {
                        const module = TB.modules[TB.moduleList[i]];

                        // Don't do anything with beta modules unless beta mode is enabled
                        // Need TB.setting() call for non-module settings
                        // if (!TB.setting('betamode') && module.setting('betamode')) {
                        if (!TB.storage.getSetting('Utils', 'betaMode', false) && module.config['betamode']) {
                        // skip this module entirely
                            $.log(`Beta  mode not enabled. Skipping ${module.name} module`, false, 'TBinit');
                            continue;
                        }

                        // Don't do anything with dev modules unless debug mode is enabled
                        // Need TB.setting() call for non-module settings
                        // if (!TB.setting('betamode') && module.setting('betamode')) {

                        if (!TB.storage.getSetting('Utils', 'debugMode', false) && module.config['devmode']) {
                        // skip this module entirely
                            $.log(`Debug mode not enabled. Skipping ${module.name} module`, false, 'TBinit');
                            continue;
                        }

                        if (!TBCore.isOldReddit && module.oldReddit) {
                            $.log(`Module not suitable for new reddit. Skipping ${module.name} module`, false, 'TBinit');
                            continue;
                        }

                        // lock 'n load
                        if (module.setting('enabled')) {
                            $.log(`Loading ${module.name} module`, false, 'TBinit');
                            module.init();
                        }
                    }

                    // Start the event listener once everything else is initialized
                    TB.listener.start();
                    profileResults('tbInitDone', performance.now());
                }, 50);
            }
        },

        showSettings () {
            const self = this,
                  $body = $('body');

            //
            // preload some generic variables
            //
            const debugMode = TBCore.debugMode,
                  betaMode = TBCore.betaMode,
                  devMode = TBCore.devMode,
                  advancedMode = TBCore.advancedMode,

                  settingSub = TB.storage.getSetting('Utils', 'settingSub', ''),
                  shortLength = TB.storage.getSetting('Utils', 'shortLength', 15),
                  longLength = TB.storage.getSetting('Utils', 'longLength', 45),

                  // last export stuff
                  lastExport = self.modules['Modbar'].setting('lastExport'),
                  showExportReminder = self.modules['Modbar'].setting('showExportReminder'),
                  lastExportDays = Math.round(TBHelpers.millisecondsToDays(TBHelpers.getTime() - lastExport)),
                  lastExportLabel = lastExport === 0 ? 'Never' : `${lastExportDays} days ago`;

            let lastExportState = '';

            if (lastExportDays > 30 || lastExport === 0) {
                lastExportState = 'sad';

                if (showExportReminder && settingSub !== '' && lastExport !== 0) {
                    TB.ui.textFeedback(`Last toolbox settings backup: ${lastExportLabel}`, TB.ui.FEEDBACK_NEGATIVE, 3000, TB.ui.DISPLAY_BOTTOM);
                }
            } else if (lastExportDays < 15) {
                lastExportState = 'happy';
            }

            // Template for 'general settings'.
            const displayNone = 'display: none;';
            let coreSettingsContent = '';

            const coreSettings = [
                {
                    settingName: 'settingssub',
                    content: `
                        Backup/restore toolbox settings to a wiki page:<br>
                        <input type="text" class="tb-input" name="settingssub" placeholder="Fill in a private subreddit where you are mod..." value="${TBHelpers.htmlEncode(unescape(settingSub))}">
                        <input class="tb-settings-export tb-action-button" type="button" value="backup">
                        <input class="tb-settings-import tb-action-button" type="button" value="restore">
                        <b> Important:</b> This will reload the page without saving!
                        <label class="backup-warning ${lastExportState}">Last backup: <b>${lastExportLabel}</b></label>
                        `,
                    display: '',
                },
                {
                    settingName: 'showexportreminder',
                    content: `<label><input type="checkbox" id="showExportReminder" ${showExportReminder ? 'checked' : ''}> Show reminder after 30 days of no backup.</label>`,
                    display: '',
                },
                {
                    settingName: 'debugmode',
                    content: `<label><input type="checkbox" id="debugMode" ${debugMode ? 'checked' : ''}> Enable debug mode</label>`,
                    display: advancedMode ? '' : displayNone,
                },
                {
                    settingName: 'betamode',
                    content: `<label><input type="checkbox" id="betaMode" ${betaMode ? 'checked' : ''}> Enable beta features</label>`,
                    display: '',
                },
                {
                    settingName: 'advancedmode',
                    content: `<label><input type="checkbox" id="advancedMode" ${advancedMode ? 'checked' : ''}> Show advanced settings</label>`,
                    display: '',
                },
                {
                    settingName: 'longlength',
                    content: `Cache subreddit config (removal reasons, domain tags, mod macros) time (in minutes):<br>
                        <input type="number" class="tb-input" name="longLength" value="${longLength}">`,
                    display: advancedMode ? '' : displayNone,
                },
                {
                    settingName: 'shortlength',
                    content: `Cache subreddit user notes time (in minutes):<br>
                      <input type="number" class="tb-input" name="shortLength" value="${shortLength}">`,
                    display: advancedMode ? '' : displayNone,
                },
                {
                    settingName: 'clearcache',
                    content: '<label><input type="checkbox" id="clearcache"> Clear cache on save. (NB: please close all other reddit tabs before clearing your cache.)</label>',
                    display: '',
                },
                {
                    settingName: 'showsettings',
                    content: '<input type="button" id="showRawSettings" class="tb-action-button" value="Show Settings" />',
                    display: '',
                },
            ];

            coreSettings.forEach(({settingName, content, display}) => {
                coreSettingsContent += `
                <p id="tb-toolbox-${settingName}" class="tb-settings-p" style="${display}">
                    ${content}&nbsp;
                    <a data-setting="${settingName}" href="javascript:;" class="tb-gen-setting-link tb-setting-link-${settingName} tb-icons">
                    ${TBui.icons.tbSettingLink}
                    </a>&nbsp;
                </p>
                <div style="display: none;" class="tb-setting-input tb-setting-input-${settingName}">
                    <input type="text" class="tb-input" readonly="readonly" value="[${settingName}](#?tbsettings=toolbox&setting=${settingName})"><br>
                    <input type="text" class="tb-input" readonly="readonly" value="https://www.reddit.com/#?tbsettings=toolbox&setting=${settingName}">
                </div>
                `;
            });

            $body.on('click', '.tb-gen-setting-link, .tb-module-setting-link', function () {
                const $this = $(this),
                      tbSet = $this.attr('data-setting'),
                      $inputSetting = $(`.tb-setting-input-${tbSet}`);

                if ($inputSetting.is(':visible')) {
                    $this.css('opacity', '0.5');
                    $inputSetting.hide();
                } else {
                    $this.css('opacity', '1');
                    $inputSetting.show(function () {
                        $(this).find('input:first-child').select();
                    });
                }
            });

            const settingsTabs = [
                {
                    title: 'Core Settings',
                    tooltip: 'Edit toolbox core settings',
                    help_page: 'toolbox',
                    id: 'toolbox',
                    content: coreSettingsContent,
                },
                {
                    title: 'Toggle Modules',
                    tooltip: 'Enable/disable individual modules',
                    help_page: 'toggle-modules',
                    content: '', // this gets propagated magically
                },
                {
                    title: 'About',
                    tooltip: '',
                    help_page: 'about',
                    id: 'about',
                    content: `
                <h1 id="tb-random-about-quote">"${TBCore.RandomQuote}"</h1>
                <h3>About:</h3> <a href="${TBCore.link('/r/toolbox')}" target="_blank">/r/toolbox ${TBCore.toolboxVersionName}</a>
                    <h3> Open source </h3>
                    Toolbox is an open source software project. The source code and project can be found on <a href="https://github.com/toolbox-team" target="_blank">GitHub</a>.
                    <h3> Privacy </h3>
                    The toolbox development team highly values privacy. <br>
                    The toolbox privacy policy can be <a href="https://www.reddit.com/r/toolbox/wiki/privacy" target="_blank">found on this wiki page</a>.
                    <h3> made and maintained by: </h3>
                    <table class="tb-about-credits">
                        <tr>
                            <td><a href="https://www.reddit.com/user/creesch/">/u/creesch</a></td>
                            <td><a href="https://www.reddit.com/user/agentlame">/u/agentlame</a></td>
                            <td><a href="https://www.reddit.com/user/LowSociety">/u/LowSociety</a></td>
                        </tr><tr>
                            <td><a href="https://www.reddit.com/user/TheEnigmaBlade">/u/TheEnigmaBlade</a></td>
                            <td><a href="https://www.reddit.com/user/dakta">/u/dakta</a></td>
                            <td><a href="https://www.reddit.com/user/largenocream">/u/largenocream</a></td>
                        </tr><tr>
                            <td><a href="https://www.reddit.com/user/noeatnosleep">/u/noeatnosleep</a></td>
                            <td><a href="https://www.reddit.com/user/psdtwk">/u/psdtwk</a></td>
                            <td><a href="https://www.reddit.com/user/garethp">/u/garethp</a></td>
                        </tr><tr>
                            <td><a href="https://www.reddit.com/user/WorseThanHipster" title="Literally">/u/WorseThanHipster</a></td>
                            <td><a href="https://www.reddit.com/user/amici_ursi">/u/amici_ursi</a></td>
                            <td><a href="https://www.reddit.com/user/geo1088">/u/geo1088</a></td>
                        </tr><tr>
                            <td><a href="https://www.reddit.com/user/SpyTec13">/u/SpyTec13</a></td>
                            <td><a href="https://www.reddit.com/user/kenman">/u/kenman</a></td>
                            <td></td>
                        </tr>
                    </table>
                    <h3>Documentation by:</h3>
                    <table class="tb-about-credits">
                        <tr>
                            <td><a href="https://www.reddit.com/user/psdtwk">/u/psdtwk</a></td>
                            <td><a href="https://www.reddit.com/user/gorillagnomes">/u/gorillagnomes</a></td>
                            <td><a href="https://www.reddit.com/user/x_minus_one">/u/x_minus_one</a></td>
                        </tr><tr>
                            <td><a href="https://www.reddit.com/user/Gustavobc">/u/Gustavobc</a></td>
                            <td><a href="https://www.reddit.com/user/hermithome">/u/hermithome</a></td>
                            <td><a href="https://www.reddit.com/user/amici_ursi">/u/amici_ursi</a></td>
                        </tr>
                    </table>
                    <h3>Special thanks to:</h3>
                    <a href="https://www.reddit.com/user/andytuba">/u/andytuba</a> & <a href="https://www.reddit.com/user/erikdesjardins">/u/erikdesjardins</a>
                    <br>for all their amazing help and support of the TB team in resolving complex issues (and really simple ones)<br>
                    <h3>Credits:</h3>
                    <a href="https://www.reddit.com/user/ShaneH7646">/u/ShaneH7646 for the snoo running gif</a><br>
                    <a href="https://material.io/tools/icons/" target="_blank">Material icons</a><br>
                    <a href="${TBCore.link('/user/DEADB33F')}" target="_blank">Modtools base code by DEADB33F</a><br>
                    <a href="https://chrome.google.com/webstore/detail/reddit-mod-nuke-extension/omndholfgmbafjdodldjlekckdneggll?hl=en" target="_blank">Comment Thread Nuke Script</a> by <a href="${TBCore.link('/u/djimbob')}" target="_blank">/u/djimbob</a><br>
                    <a href="https://github.com/gamefreak/snuownd" target="_blank">snuownd.js by gamefreak</a><br>
                    <a href="https://codemirror.net/ target="_blank">CodeMirror code editor</a><br>
                    <h3>License:</h3>
                    <span>© 2013-2020 toolbox development team. </span>
                    <p class="tb-settings-p">Licensed under the Apache License, Version 2.0 (the "License");
                        <br> you may not use this file except in compliance with the License.
                        <br> You may obtain a copy of the License at </p>
                    <p class="tb-settings-p"><a href="http://www.apache.org/licenses/LICENSE-2.0">http://www.apache.org/licenses/LICENSE-2.0</a></p>
                    <p class="tb-settings-p">Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
                        <br> See the License for the specific language governing permissions and limitations under the License.</p>
                    <p class="tb-settings-p" ${debugMode && !TBCore.devModeLock ? ' ' : 'style="display:none;" '}>
                        <label><input type="checkbox" id="devMode" ${devMode ? 'checked' : ''}> DEVMODE: DON'T EVER ENABLE THIS!</label>
                    </p>`,
                },
            ];

            // This was a clever idea, but for now it's easier to inject them
            // settingsTabs.push.apply(settingsTabs, this.generateSettings());

            const $settingsDialog = TB.ui.overlay(
                // title
                'toolbox Settings',
                // tabs
                settingsTabs,
                // extra header buttons TODO: make this generic
                `<a class="tb-help-main" href="javascript:;" currentpage="" title="Help"><i class="tb-icons">${TBui.icons.help}</i></a>`,
                // overlay main class
                'tb-settings tb-personal-settings', // TODO: remove tb-settings from this after port is complete
                // optional, overriding single footer
                `<input class="tb-save tb-action-button" type="button" value="save">${TBCore.devMode ? '&nbsp;<input class="tb-save-reload tb-action-button" type="button" value="save and reload">' : ''}`
            );

            // Add ordering attributes to the existing tabs so we can insert other special tabs around them
            $settingsDialog.find('a[data-module="toolbox"]').attr('data-order', 1);
            $settingsDialog.find('a[data-module="toggle_modules"]').attr('data-order', 3);
            $settingsDialog.find('a[data-module="about"]').attr('data-order', 2);

            // This div contains the module links, separate from everything else
            const $moduleCategory = $(`
                <div class="tb-window-tabs-category">
                    <h2 class="tb-window-tabs-header">Modules</h2>
                </div>
            `);
            // TODO: this basically hardcodes where in the list the modules
            // category goes, but if we wanted it to not be hardcoded then we'd
            // have to rewrite how this window is generated, so it's good enough
            $settingsDialog.find('a[data-module="about"]').before($moduleCategory);

            $settingsDialog.on('click', '.tb-help-main', e => {
                const settingsDialog = e.delegateTarget;
                const page = $(settingsDialog).find('.tb-window-tabs a.active').data('help_page');
                window.open(`https://www.reddit.com/r/toolbox/wiki/livedocs/${page}`, '', 'width=500,height=600,location=0,menubar=0,top=100,left=100');
            });

            $settingsDialog.on('click', '.buttons .close', e => {
                // By binding the click handler to $settingsDialog, we get to use event.delegateTarget to refer to that element.
                // We also encapsulate the handler to the injected content, so we don't have to worry about selector overlap between multiple open dialogs.

                // "event.delegateTarget" always refers to the element that .on() is bound to, e.g. $settingsDialog
                // "this" always refers to the element matched by the selector, e.g. '.buttons .close'
                // "element.target" always refers to the clicked element, e.g. also '.buttons .close'

                // NOTE: "this" is not always the same element as "event.target", e.g. when the clicked element is a descendant of the selector
                // So, we had '.buttons' for our selector, and clicked on '.close' (a descendant of '.buttons'), then:
                //  - "this" would be '.buttons' and
                //  - "element.target" would be '.buttons .close'
                const settingsDialog = e.delegateTarget;

                $(settingsDialog).remove();
                // Settings can go on top of other overlays.
                if (!$('body').find('.tb-page-overlay').length) {
                    $('body').css('overflow', 'auto');
                }
            });

            $settingsDialog.on('click', '.tb-save, .tb-save-reload', e => {
                const settingsDialog = e.delegateTarget,
                      reload = $(e.target).hasClass('tb-save-reload');

                // save export sub
                let sub = $('input[name=settingssub]').val();
                if (sub) {
                // Just to be safe.
                    sub = TBHelpers.cleanSubredditName(sub);

                    // Save the sub, first.
                    TB.storage.setSetting('Utils', 'settingSub', sub);
                }

                TB.storage.setSetting('Utils', 'debugMode', $('#debugMode').prop('checked'), false);
                TB.storage.setSetting('Utils', 'betaMode', $('#betaMode').prop('checked'), false);
                TB.storage.setSetting('Utils', 'devMode', $('#devMode').prop('checked'), false);
                TB.storage.setSetting('Utils', 'advancedMode', $('#advancedMode').prop('checked'), false);

                self.modules['Modbar'].setting('showExportReminder', $('#showExportReminder').prop('checked'));

                // save cache settings.
                TB.storage.setSetting('Utils', 'longLength', parseInt($('input[name=longLength]').val()), false);

                TB.storage.setSetting('Utils', 'shortLength', parseInt($('input[name=shortLength]').val()), false);

                if ($('#clearcache').prop('checked')) {
                    TBCore.clearCache();
                }

                $(settingsDialog).remove();
                // Settings can go on top of other overlays.
                if (!$('body').find('.tb-page-overlay').length) {
                    $('body').css('overflow', 'auto');
                }

                TB.storage.verifiedSettingsSave(succ => {
                    if (succ) {
                        TB.ui.textFeedback('Settings saved and verified', TB.ui.FEEDBACK_POSITIVE);
                        setTimeout(() => {
                        // Only reload in dev mode if we asked to.
                            if (!devMode || reload) {
                                window.location.reload();
                            }
                        }, 1000);
                    } else {
                        TB.ui.textFeedback('Save could not be verified', TB.ui.FEEDBACK_NEGATIVE);
                    }
                });
            });

            $settingsDialog.on('click', '.tb-settings-import, .tb-settings-export', e => {
                let sub = $('input[name=settingssub]').val();
                if (!sub) {
                    TB.ui.textFeedback('You have not set a subreddit to backup/restore settings', TB.ui.FEEDBACK_NEGATIVE);

                    $.log('no setting sub');
                    return;
                }

                // Just to be safe.
                sub = TBHelpers.cleanSubredditName(sub);

                // Save the sub, first.
                TB.storage.setSetting('Utils', 'settingSub', sub);

                if ($(e.target).hasClass('tb-settings-import')) {
                    TBCore.importSettings(sub, () => {
                        self.modules['Modbar'].setting('lastExport', TBHelpers.getTime());
                        TBCore.clearCache();
                        TB.storage.verifiedSettingsSave(succ => {
                            if (succ) {
                                TB.ui.textFeedback('Settings imported and verified, reloading page', TB.ui.FEEDBACK_POSITIVE);
                                setTimeout(() => {
                                    window.location.reload();
                                }, 1000);
                            } else {
                                TB.ui.textFeedback('Imported settings could not be verified', TB.ui.FEEDBACK_NEGATIVE);
                            }
                        });
                    });
                } else {
                    TB.ui.textFeedback(`Backing up settings to /r/${sub}`, TB.ui.FEEDBACK_NEUTRAL);
                    TBCore.exportSettings(sub, () => {
                        self.modules['Modbar'].setting('lastExport', TBHelpers.getTime());
                        TBCore.clearCache();
                        window.location.reload();
                    });
                }
            });

            $settingsDialog.on('click', '#showRawSettings', () => {
                const $viewSettings = TB.ui.overlay(
                    'toolbox raw setting display',
                    [
                        {
                            title: '',
                            tooltip: '',
                            content: `
                <span class="tb-settings-display">
                <textarea class="tb-input edit-settings" rows="20" cols="20"></textarea>
                </br>
                </span>
                `,
                            footer: '<input class="anonymize-settings tb-action-button" type="button" value="Anonymize Settings">',
                        },
                    ],
                    '', // meta
                    'tb-raw-settings'
                ).appendTo('body');
                $body.css('overflow', 'hidden');

                const $editSettings = $('.edit-settings');

                TB.storage.getSettingsObject(sObject => {
                    $editSettings.val(JSON.stringify(sObject, null, 2));
                });

                $viewSettings.on('click', '.anonymize-settings', () => {
                    TB.storage.getAnonymizedSettingsObject(sObject => {
                        $editSettings.val(JSON.stringify(sObject, null, 2));
                    });
                });

                $viewSettings.on('click', '.close', () => {
                    $viewSettings.remove(); // should we have some confirmation dialog here?
                });
            });

            $settingsDialog.on('click', '.tb-old-settings .tb-help-toggle, .toggle_modules .tb-help-toggle', function () {
                const module = $(this).attr('data-module');
                window.open(`https://www.reddit.com/r/toolbox/wiki/livedocs/${module}`, '', 'width=500,height=600,location=0,menubar=0,top=100,left=100');
            });

            // Lock 'n load
            $settingsDialog.appendTo('body').show();
            $body.css('overflow', 'hidden');

            // Sort the module list alphabetically
            this.moduleList.sort((a, b) => a.localeCompare(b)).forEach(moduleName => {
                const module = this.modules[moduleName];
                // Don't do anything with beta modules unless beta mode is enabled
                // Need TB.setting() call for non-module settings
                // if (!TB.setting('betamode') && module.setting('betamode')) {
                if (!TB.storage.getSetting('Utils', 'betaMode', false)
                    && module.config['betamode']
                ) {
                    // skip this module entirely
                    return;
                }
                // Don't do anything with dev modules unless debug mode is enabled
                // Need TB.setting() call for non-module settings
                // if (!TB.setting('betamode') && module.setting('betamode')) {
                if (!TB.storage.getSetting('Utils', 'debugMode', false)
                    && module.config['devmode']
                ) {
                    // skip this module entirely
                    return;
                }

                //
                // build and inject our settings tab
                //

                let moduleHasSettingTab = false, // we set this to true later, if there's a visible setting
                    moduleIsEnabled = false;
                const $tab = $(`<a href="javascript:;" class="tb-window-content-${module.shortname.toLowerCase()}" data-module="${module.shortname.toLowerCase()}">${module.name}</a>`),
                      $settings = $(`
                            <div class="tb-window-tab ${module.shortname.toLowerCase()}" style="display: none;">
                                <div class="tb-window-content">
                                    <div class="tb-settings"></div>
                                    <div class="tb-oldreddit-settings" style="display: none;">
                                        <h1>Settings below only affect things on old reddit</h1>
                                    </div>
                                </div>
                            </div>
                      `);

                $tab.data('module', module.shortname);
                $tab.data('help_page', module.shortname);

                const $body = $('body');
                const execAfterInject = [];
                for (let j = 0; j < module.settingsList.length; j++) {
                    const setting = module.settingsList[j],
                          options = module.settings[setting];
                    let $setting;

                    // "enabled" will eventually be special, but for now it just shows up like any other setting
                    // if (setting == "enabled") {
                    //     continue;
                    // }

                    // "enabled" is special during the transition period, while the "Toggle Modules" tab still exists
                    if (setting === 'enabled') {
                        moduleIsEnabled = module.setting(setting) ? true : false;
                        if (Object.prototype.hasOwnProperty.call(options, 'hidden') && options['hidden'] && !TBCore.devMode) {
                            continue;
                        }
                        const name = module.shortname.toLowerCase();

                        $setting = $(`
                            <p id="tb-toggle_modules-${name}" class="tb-settings-p">
                                <label><input type="checkbox" id="${module.shortname}Enabled" ${module.setting(setting) ? ' checked="checked"' : ''}>${options.title}</label>
                                        <a class="tb-help-toggle" href="javascript:;" data-module="${module.shortname}" title="Help">?</a>
                                <a data-setting="${name}" href="javascript:;" class="tb-module-setting-link tb-setting-link-${name}  tb-icons">
                                    ${TBui.icons.tbSettingLink}
                                </a>&nbsp;
                                ${module.oldReddit ? '<span class="tb-oldReddit-module">Only works on old reddit</span>' : ''}
                            </p>
                            <div style="display: none;" class="tb-setting-input tb-setting-input-${name}">
                                <input type="text" class="tb-input" readonly="readonly" value="[${name}](#?tbsettings=toggle_modules&setting=${name})"><br>
                                <input type="text" class="tb-input" readonly="readonly" value="https://www.reddit.com/#?tbsettings=toggle_modules&setting=${name}">
                            </div>
                        `);

                        // Add the setting in its place to keep ABC order
                        let added = false;
                        $('.tb-settings .tb-window-tab.toggle_modules .tb-window-content p').each(function () {
                            const $this = $(this);
                            if ($this.text().localeCompare($setting.text()) > 0) {
                                $this.before($setting);
                                added = true;
                                return false;
                            }
                        });
                        if (!added) {
                            $('.tb-settings .tb-window-tab.toggle_modules .tb-window-content').append($setting);
                        }

                        // Don't add this to the module's own settings page
                        continue;
                    }

                    // hide beta stuff unless beta mode enabled
                    if (Object.prototype.hasOwnProperty.call(options, 'betamode')
                        && !TB.storage.getSetting('Utils', 'betaMode', false)
                        && options['betamode']
                    ) {
                        continue;
                    }

                    // hide dev stuff unless debug mode enabled
                    if (Object.prototype.hasOwnProperty.call(options, 'devmode')
                        && !TB.storage.getSetting('Utils', 'debugMode', false)
                        && options['devmode']
                    ) {
                        continue;
                    }

                    // hide hidden settings, ofc
                    if (Object.prototype.hasOwnProperty.call(options, 'hidden')
                        && options['hidden'] && !TBCore.devMode
                    ) {
                        continue;
                    }

                    // hide advanced settings, but do it via CSS so it can be overridden.
                    let displaySetting = true;
                    if (Object.prototype.hasOwnProperty.call(options, 'advanced')
                        && options['advanced'] && !TBCore.advancedMode
                    ) {
                        displaySetting = false;
                    }

                    moduleHasSettingTab = true;

                    // blank slate
                    $setting = $(`<p  class="tb-settings-p" ${displaySetting ? '' : 'style="display:none;"'}></p>`);
                    const title = options.title ? options.title : `(${setting})`;
                    let noWrap = false;

                    // automagical handling of input types
                    switch (options.type) {
                    case 'action':
                    {
                        if (!options.event || !options.class) {
                            break;
                        }
                        const event = options.event;

                        $setting.append(TB.ui.actionButton(title, options.class));

                        $body.on('click', `.${options.class}`, () => {
                            TBCore.sendEvent(event);
                        });

                        break;
                    }
                    case 'boolean':
                    {
                        $setting.append($('<label>').append($('<input type="checkbox" />').prop('checked', module.setting(setting))).append(` ${title}`));
                        break;
                    }
                    case 'number':
                    {
                        $setting.append($('<label>').append($('<input type="number" class="tb-input" />').prop('min', options.min).prop('max', options.max).prop('step', options.step).val(module.setting(setting))).append(` ${title}`));
                        break;
                    }
                    case 'array':
                    case 'JSON':
                    {
                        const json = JSON.stringify(module.setting(setting), null, 0);
                        $setting.append(`${title}:<br />`);
                        $setting.append($('<textarea class="tb-input" rows="3" cols="80">').val(json)); // No matter shat I do, I can't get JSON to work with an input.
                        break;
                    }
                    case 'code':
                    {
                        $setting.append(`${title}:<br />`);
                        $setting.append($('<textarea class="tb-input" rows="25" cols="80">').val(module.setting(setting)));
                        break;
                    }
                    case 'subreddit':
                    case 'text':
                    case 'list':
                    {
                        $setting.append(`${title}:<br />`);
                        $setting.append($('<input type="text" class="tb-input" />').val(module.setting(setting)));
                        break;
                    }
                    case 'sublist':
                    {
                        $setting.append(`${title}:<br />`);
                        $setting.append(TB.ui.selectMultiple.apply(TB.ui, [TBCore.mySubs, module.setting(setting)]));
                        break;
                    }
                    case 'map':
                    {
                        $setting.append(`${title}:<br />`);
                        $setting.append(TB.ui.mapInput(options.labels, module.setting(setting)));
                        break;
                    }
                    case 'selector':
                    {
                        const v = module.setting(setting);
                        $setting.append(`${title}:<br />`);
                        $setting.append(TB.ui.selectSingular.apply(TB.ui, [options.values, v === undefined || v === null || v === '' ? options.default : v]));
                        break;
                    }
                    case 'syntaxTheme':
                    {
                        $setting.append(`${title}:<br/>`);
                        $setting.append(TB.modules.Syntax.themeSelect);
                        $setting.find('select').attr('id', `${module.shortname}_syntax_theme`);
                        $setting.append($(`
                    <textarea class="tb-input syntax-example" id="${module.shortname}_syntax_theme_css">
/* This is just some example code*/
body {
    font-family: sans-serif, "Helvetica Neue", Arial;
    font-weight: normal;
}

.md h3, .commentarea h3 {
    font-size: 1em;
}

#header {
    border-bottom: 1px solid #9A9A9A;
    box-shadow: 0px 1px 3px 1px #B3C2D1;
}
/* This is just some example code, this time to demonstrate word wrapping. If it is enabled this line will wrap to a next line as soon as it hits the box side, if it is disabled this line will just continue creating a horizontal scrollbar */\n
                    </textarea>`));
                        execAfterInject.push(() => {
                            // Syntax highlighter selection stuff
                            $body.addClass('mod-syntax');
                            let editorSettings;
                            const enableWordWrap = TB.storage.getSetting('Syntax', 'enableWordWrap', true);
                            $(`#${module.shortname}_syntax_theme_css`).each((index, elem) => {
                                // Editor setup.
                                editorSettings = CodeMirror.fromTextArea(elem, {
                                    mode: 'text/css',
                                    autoCloseBrackets: true,
                                    lineNumbers: true,
                                    theme: module.setting(setting),
                                    extraKeys: {
                                        'Ctrl-Alt-F': 'findPersistent',
                                        'Ctrl-Space': 'autocomplete',
                                        'F11' (cm) {
                                            cm.setOption('fullScreen', !cm.getOption('fullScreen'));
                                        },
                                        'Esc' (cm) {
                                            if (cm.getOption('fullScreen')) {
                                                cm.setOption('fullScreen', false);
                                            }
                                        },
                                    },
                                    lineWrapping: enableWordWrap,
                                });
                            });

                            TBCore.catchEvent(TBCore.events.TB_SYNTAX_SETTINGS, () => {
                                setTimeout(() => {
                                    editorSettings.refresh();
                                }, 5);
                            });

                            $(`#${module.shortname}_syntax_theme`).val(module.setting(setting));
                            $body.on('change keydown', `#${module.shortname}_syntax_theme`, function () {
                                const thingy = $(this);
                                setTimeout(() => {
                                    editorSettings.setOption('theme', thingy.val());
                                }, 0);
                            });
                        });
                        break;
                    }
                    case 'achievement_save':
                    {
                        noWrap = true;

                        $.log('----------', false, 'TBModule');
                        $.log('GENERATING ACHIEVEMENT PAGE', false, 'TBModule');
                        const total = module.manager.getAchievementTotal(),
                              unlocked = module.manager.getUnlockedCount();

                        $.log(`  total=${total}`, false, 'TBModule');
                        $.log(`  unlocked=${unlocked}`, false, 'TBModule');

                        $setting = $('<div>').attr('class', 'achievements');
                        $setting.append($('<h1>').text('Mod Achievements'));
                        $setting.append($('<p class="tb-settings-p">').text(`${unlocked} of ${total} unlocked`));
                        $setting.append('<br />');

                        let save = module.setting(setting);
                        save = module.manager.decodeSave(save);

                        const $list = $('<div>').attr('class', 'achievements-list');
                        for (let saveIndex = 0; saveIndex < module.manager.getAchievementBlockCount(); saveIndex++) {
                            $.log(`  saveIndex: ${saveIndex}`, false, 'TBModule');
                            for (let index = 0; index < module.manager.getAchievementCount(saveIndex); index++) {
                                $.log(`  index: ${index}`, false, 'TBModule');
                                let aTitle = '???',
                                    aDescr = '??????',
                                    aClass = '';

                                if (module.manager.isUnlocked(saveIndex, index, save) || TBCore.devMode) {
                                    const a = module.manager.getAchievement(saveIndex, index);
                                    aTitle = a.title;
                                    aDescr = a.descr;
                                    aClass = 'unlocked';
                                }

                                const $a = $('<div>').attr('class', `achievement ${aClass}`);
                                $a.append($('<p>').attr('class', 'title').html(TBStorage.purify(aTitle)));
                                $a.append($('<p>').attr('class', 'description').text(aDescr));
                                $list.append($a);
                            }
                        }
                        $setting.append($list);

                        break;
                    }
                    default:
                    {
                        // what in the world would we do here? maybe raw JSON?
                        // yes, we do raw JSON
                        const json = JSON.stringify(module.setting(setting), null, 0);
                        $setting.append(`${title}:<br />`);
                        $setting.append($('<textarea rows="1">').val(json)); // No matter shat I do, I can't get JSON to work with an input.
                        break;
                    }
                    }
                    if (!noWrap) {
                        const moduleName = module.shortname.toLowerCase(),
                              settingName = setting.toLowerCase(),
                              linkClass = `tb-setting-link-${settingName}`,
                              inputClass = `tb-setting-input-${settingName}`,
                              redditLink = `[${setting}](#?tbsettings=${moduleName}&setting=${settingName})`,
                              internetLink = `https://www.reddit.com/#?tbsettings=${moduleName}&setting=${settingName}`;

                        $setting.append(`&nbsp;<a ${displaySetting ? '' : 'style="display:none;"'
                        } data-setting="${settingName}" href="javascript:;"" class="tb-setting-link ${linkClass} tb-icons">${TBui.icons.tbSettingLink}</a>` +
                            `&nbsp;<div style="display:none;" class="tb-setting-input ${inputClass}">` +
                            `<input  type="text" class="tb-input" readonly="readonly" value="${redditLink}"/><br>` +
                            `<input  type="text" class="tb-input" readonly="readonly" value="${internetLink}"/></div>`);

                        $setting = $('<span>').attr('class', 'setting-item').append($setting);
                        $setting.attr('id', `tb-${moduleName}-${settingName}`);
                        $setting.attr('data-module', module.shortname);
                        $setting.attr('data-setting', setting);

                        // TODO: somebody document this
                        $body.on('click', `.${linkClass}`, function () {
                            const $this = $(this),
                                  tbSet = $this.attr('data-setting');

                            const $inputSetting = $(`.tb-setting-input-${tbSet}`);

                            if ($inputSetting.is(':visible')) {
                                $inputSetting.hide();
                                $this.css('opacity', '0.5');
                            } else {
                                $this.css('opacity', '1');
                                $inputSetting.show(function () {
                                    $(this).select();
                                });
                            }
                        });
                    }

                    if (options.oldReddit) {
                        const $oldRedditSettings = $settings.find('.tb-window-content .tb-oldreddit-settings');
                        $oldRedditSettings.append($setting);
                        $oldRedditSettings.show();
                    } else {
                        $settings.find('.tb-window-content .tb-settings').append($setting);
                    }
                }

                // if ($settings.find('input').length > 0) {
                if (moduleHasSettingTab) {
                    // attach tab and content
                    if (!moduleIsEnabled) {
                        $tab.addClass('tb-module-disabled');
                        $tab.attr('title', 'This module is not active, you can activate it in the "Toggle Modules" tab.');
                        $settings.prepend('<span class="tb-module-disabled">This module is not active, you can activate it in the "Toggle Modules" tab.</span>');
                    }

                    if (module.oldReddit) {
                        $settings.prepend('<span class="tb-module-disabled">This module only works on old reddit.</span>');
                    }
                    $('.tb-settings .tb-window-tabs-wrapper').append($settings);
                    if (module.sort) {
                        $tab.attr('data-order', module.sort.order);
                        // If the module specifies a sort, then we do that
                        if (module.sort.location === 'beforeModules') {
                            // Loop through the tabs above the modules list
                            $settingsDialog.find('.tb-window-tabs > *').each(function () {
                                const $existingTab = $(this);
                                if (module.sort.order < parseInt($existingTab.attr('data-order'), 10)) {
                                    // We found a tab bigger than us! We should be before it.
                                    $existingTab.before($tab);
                                    // Break out of the loop since we're done.
                                    return false;
                                } else if ($existingTab.is('div')) {
                                    // We hit the module list! If it hasn't been added yet, add it here.
                                    $existingTab.before($tab);
                                    // Break the loop so we don't go into the bottom elements.
                                    return false;
                                }
                            });
                        } else if (module.sort.location === 'afterModules') {
                            // Loop through the tabs below the modules list
                            let added = false;
                            $settingsDialog.find('.tb-window-tabs > div ~ a').each(function () {
                                const $existingTab = $(this);
                                if (module.sort.order < parseInt($existingTab.attr('data-order'), 10)) {
                                    // We found a tab bigger than us!
                                    $existingTab.before($tab);
                                    added = true;
                                    // We're added, so we don't need to continue
                                    return false;
                                }
                            });
                            if (!added) {
                                // Not added yet? To the bottom we go.
                                $('.tb-window-tabs').append($tab);
                            }
                        }
                    } else {
                        // Modules without a special sort just get added here
                        $moduleCategory.append($tab);
                    }

                    // stuff to exec after inject:
                    for (let i = 0; i < execAfterInject.length; i++) {
                        execAfterInject[i]();
                    }
                } else {
                    // module has no settings, for now don't inject a tab
                }

                // we use a jQuery hack to stick this bind call at the top of the queue,
                // so that it runs before the bind call in notifier.js
                // this way we don't have to touch notifier.js to make it work.
                //
                // We get one additional click handler for each module that gets injected.
                // NOTE: For this to work properly, the event delegate has to match the primary .tb-save handler (above)
                $('.tb-settings').bindFirst('click', '.tb-save', () => {
                    // handle module enable/disable on Toggle Modules first
                    const $moduleEnabled = $(`.tb-settings .tb-window-tabs-wrapper .tb-window-tab.toggle_modules #${module.shortname}Enabled`).prop('checked');
                    module.setting('enabled', $moduleEnabled);

                    // handle the regular settings tab
                    const $settings_page = $(`.tb-window-tab.${module.shortname.toLowerCase()} .tb-window-content`);

                    $settings_page.find('span.setting-item').each(function () {
                        const $this = $(this);
                        let value = '';

                        // automagically parse input types
                        switch (module.settings[$this.data('setting')].type) {
                        case 'action':
                            // this never needs to be saved.
                            break;
                        case 'boolean':
                            value = $this.find('input').prop('checked');
                            break;
                        case 'number':
                            value = JSON.parse($this.find('input').val());
                            break;
                        case 'array':
                        case 'JSON':
                            value = JSON.parse($this.find('textarea').val());
                            break;
                        case 'code':
                            value = $this.find('textarea').val();
                            break;
                        case 'subreddit':
                            value = TBHelpers.cleanSubredditName($this.find('input').val());
                            break;
                        case 'text':
                            value = $this.find('input').val();
                            break;
                        case 'list':
                            value = $this.find('input').val().split(',').map(str => str.trim()).clean('');
                            break;
                        case 'sublist':
                            value = [];
                            $this.find('.selected-list option').each(function () {
                                value.push($(this).val());
                            });
                            break;
                        case 'map':
                            value = {};
                            $this.find('.tb-map-input-table tbody tr').each(function () {
                                const key = escape($(this).find('input[name=key]').val()).trim(),
                                      val = escape($(this).find('input[name=value]').val()).trim();

                                if (key !== '' || val !== '') {
                                    value[key] = val;
                                }
                            });
                            break;
                        case 'selector':
                            value = $this.find('.selector').val();
                            break;
                        case 'syntaxTheme':
                            value = $this.find(`#${module.shortname}_syntax_theme`).val();
                            break;
                        default:
                            value = JSON.parse($this.find('textarea').val());
                            break;
                        }
                        module.setting($this.data('setting'), value, false);
                    });
                });
            });
        },
    };

    // Prototype for all toolbox modules
    TB.Module = function Module (name) {
    // PUBLIC: Module Metadata
        this.name = name;

        this.config = {
            betamode: false,
            devmode: false,
        };

        this.settings = {};
        this.settingsList = [];

        this.register_setting = function register_setting (name, setting) {
            this.settingsList.push(name);
            this.settings[name] = setting;
        };

        this.register_setting('enabled', { // this one serves as an example as well as the absolute minimum setting that every module has
            type: 'boolean',
            default: false,
            betamode: false, // optional
            hidden: false, // optional
            title: `Enable ${this.name}`,
        });

        // PUBLIC: settings interface
        this.setting = function (name, value, syncSetting = true) {
        // are we setting or getting?
            if (typeof value !== 'undefined') {
            // setting
                return TB.storage.setSetting(this.shortname, name, value, syncSetting);
            } else {
            // getting
            // do we have a default?
                if (Object.prototype.hasOwnProperty.call(this.settings, name)
                && Object.prototype.hasOwnProperty.call(this.settings[name], 'default')
                ) {
                // we know what the default should be
                    return TB.storage.getSetting(this.shortname, name, this.settings[name]['default']);
                } else {
                // getSetting defaults to null for default value, no need to pass it explicitly
                    return TB.storage.getSetting(this.shortname, name);
                }
            }
        };

        // Logging utilities
        Object.assign(this, TBLog(this));

        // Profiling

        const profile = new Map(),
              startTimes = new Map();

        this.startProfile = function (key) {
            if (!TBCore.debugMode) {
                return;
            }

            startTimes.set(key, performance.now());

            if (!profile.has(key)) {
                // New key: add a new profile
                profile.set(key, {time: 0, calls: 1});
            } else {
                // Existing key: increment calls
                profile.get(key).calls++;
            }
        };

        this.endProfile = function (key) {
            if (!TBCore.debugMode) {
                return;
            }

            // Never started profiling for the key
            if (!startTimes.has(key)) {
                return;
            }

            // Get spent time
            const diff = performance.now() - startTimes.get(key);
            startTimes.delete(key);

            // Must have been started, so the object exists
            profile.get(key).time += diff;
        };

        this.getProfiles = function () {
            return profile;
        };

        this.getProfile = function (key) {
            return profile.get(key);
        };

        this.printProfiles = function () {
            this.log(`Profiling results: ${this.name}`);
            this.log('--------------------------');
            const loopthis = this;
            this.getProfiles().forEach((profile, key) => {
                loopthis.log(`${key}:`);
                loopthis.log(`\tTime  = ${profile.time.toFixed(4)}`);
                loopthis.log(`\tCalls = ${profile.calls}`);
            });
            this.log('--------------------------');
        };

        // PUBLIC: placeholder init(), just in case
        this.init = function init () {
        // pass
        };
    };

    TB.Module.prototype = {
        _shortname: '',
        get shortname () {
            // return name.trim().toLowerCase().replace(' ', '_');
            return this._shortname.length > 0 ? this._shortname : this.name.trim().replace(/\s/g, '');
        },
        set shortname (val) {
            this._shortname = val;
        },
    };
}

window.addEventListener('TBCoreLoaded', () => {
    profileResults('moduleStart', performance.now());

    $.log('TBModule has TBCore', false, 'TBinit');
    tbmodule();
    profileResults('moduleLoaded', performance.now());
    const event = new CustomEvent('TBModuleLoaded');
    window.dispatchEvent(event);
}, {
    once: true,
});
