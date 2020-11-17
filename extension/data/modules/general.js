'use strict';

function generalSettings () {
    const self = new TB.Module('General Settings');

    self.shortname = 'GenSettings';
    self.settings['enabled']['default'] = true;

    // How about you don't disable the general settings module?  No other module should ever do this. Well except for the support module and the old reddit module..
    // So yeah it depends... But seriously normal modules should not do this.
    self.settings['enabled']['hidden'] = true; // Don't disable it, either!

    // This controls settings for multiple modules, so we sort it outside the
    // module list in the settings window
    self.sort = {
        location: 'beforeModules',
        order: 2, // below core settings, above toggle modules
    };

    self.register_setting('nativeNotifications', {
        type: 'boolean',
        default: true,
        title: 'Display native operating system notifications rather than in-page notifications',
    });

    self.register_setting('onlyshowInhover', {
        type: 'boolean',
        default: true,
        advanced: false,
        title: 'Only show user related buttons (mod, history, usernotes) in the hover card',
    });

    self.register_setting('contextMenuLocation', {
        type: 'selector',
        default: 'left',
        values: ['left', 'right'],
        advanced: false,
        title: 'Side of the screen the context menu is shown',
    });

    self.register_setting('contextMenuAttention', {
        type: 'selector',
        default: 'open',
        values: ['open', 'fade', 'none'],
        advanced: false,
        title: 'Select what effect the context menu uses to show that new items are available',
    });

    self.register_setting('contextMenuClick', {
        type: 'boolean',
        default: false,
        advanced: false,
        title: 'Make the context menu only open when you click on it',
    });

    self.init = function () {
        self.log('general reporting for duty!');
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    generalSettings();
}, {
    once: true,
});
