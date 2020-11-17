'use strict';
// We have to call this after all of the modules are loaded.
// There's no super-clever way to trigger it automatically

(function TBObjectInit () {
    window.addEventListener('TBModuleLoaded', () => {
        $.log('TBModule loaded, getting TBStorage', false, 'TBinit');
        TB.init();
    }, {
        once: true,
    });
})();
