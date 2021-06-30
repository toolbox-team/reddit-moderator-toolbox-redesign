'use strict';

require('../../extension/data/tbmodule');

describe('tbmodule.js', () => {
    const setupMockWindow = target => {
        const TBCore = {
            debugMode: false,
            devMode: false,
            isOldReddit: false,
            // showSettings()...
            // advancedMode: false,
            // devModeLock: false,
            // RandomQuote: '',
            // toolboxVersion: '',
            // releaseName: '',
            // catchEvent: jest.fn(),
            // clearCache: jest.fn(),
            // link: jest.fn(),
            // importSettings: jest.fn(),
            // exportSettings: jest.fn(),
            // sendEvent: jest.fn(),
            // mySubs: [],
            // and more...
        };

        const TBui = {
            // showSettings()...
            // DISPLAY_BOTTOM: null,
            // FEEDBACK_NEGATIVE: null,
            // FEEDBACK_POSITIVE: null,
            // actionButton: jest.fn(),
            // mapInput: jest.fn(),
            // overlay: jest.fn(),
            // selectMultiple: jest.fn(),
            // selectSingular: jest.fn(),
            // textFeedback: jest.fn(),
            // icons: {
            //     help: null,
            //     tbSettingLink: null,
            // },
        };

        const TBStorage = {
            getSetting: jest.fn(),
            setSetting: jest.fn(),
            // showSettings()...
            // getSettingsObject: jest.fn(),
            // getAnonymizedSettingsObject: jest.fn(),
            // purify: jest.fn(),
            // verifiedSettingsSave: jest.fn(),
        };

        const TBListener = {
            start: jest.fn(),
        };

        const TBLog = jest.fn(obj => {
            obj.log = jest.fn();
            return obj;
        });

        const TBHelpers = {
            // showSettings()...
            // getTime: jest.fn(),
            // millisecondsToDays: jest.fn(),
        };

        const mockWindow = {
            TBCore,
            TBui,
            TBStorage,
            TBListener,
            TBLog,
            TBHelpers,
        };

        Object.assign(target, mockWindow);
    };

    beforeEach(() => {
        setupMockWindow(window);
    });

    const dispatchTBCoreLoaded = () => window.dispatchEvent(new CustomEvent('TBCoreLoaded'));

    describe('tbmodule', () => {
        it('emits `TBModuleLoaded` when initializing completes', async () => {
            const eventName = 'TBModuleLoaded';
            const promise = new Promise(resolve => window.addEventListener(eventName, resolve));
            dispatchTBCoreLoaded();
            const tbModEvent = await promise;
            expect(tbModEvent.type).toStrictEqual(eventName);
        });

        describe('TB API', () => {
            beforeEach(() => {
                dispatchTBCoreLoaded();
            });

            it('creates the TB object', () => {
                expect(TB).toBeInstanceOf(Object);
            });

            describe('initializes TB with expected properties', () => {
                it('the `ui` property is `TBui`', () => {
                    expect(TB.ui).toStrictEqual(TBui);
                });
                it('the `storage` property is `TBStorage`', () => {
                    expect(TB.storage).toStrictEqual(TBStorage);
                });
                it('the `listener` property is `TBListener`', () => {
                    expect(TB.listener).toStrictEqual(TBListener);
                });
                it('the `modules` property is `{}`', () => {
                    expect(TB.modules).toStrictEqual({});
                });
                it('the `moduleList` property is `[]`', () => {
                    expect(TB.moduleList).toStrictEqual([]);
                });
            });

            describe('exposes static functions', () => {
                describe('showSettings()', () => {
                    it('is a function', () => {
                        expect(TB.showSettings).toBeInstanceOf(Function);
                    });
                });

                // `Module()` is tested elsewhere, just make sure it's in the public API
                it('TB.Module() is a constructor', () => {
                    expect(TB.Module).toBeInstanceOf(Function);
                });

                describe('TB.register_module({shortname}) registers a `Module`', () => {
                    let module;
                    beforeEach(() => {
                        module = new TB.Module('test shortname');
                        TB.register_module(module);
                    });

                    it('by adding its `shortname` to `TB.moduleList`', () => {
                        expect(TB.moduleList).toContain(module.shortname);
                    });
                    it('by adding it to `TB.modules`', () => {
                        expect(TB.modules).toHaveProperty(module.shortname, module);
                    });
                });

                describe('TB.init()', () => {
                    beforeAll(() => {
                        jest.useFakeTimers();
                    });

                    it('starts the event listener', () => {
                        TB.init();
                        jest.runAllTimers();
                        expect(TB.listener.start).toHaveBeenCalledTimes(1);
                    });
                    it('runs in the macro-task queue (setTimeout())', () => {
                        TB.init();
                        expect(TB.listener.start).not.toHaveBeenCalled();
                        jest.runAllTimers();
                        expect(TB.listener.start).toHaveBeenCalledTimes(1);
                    });
                    it('generates profiles', () => {
                        // clear the `moduleStart` & `moduleLoaded` profiles
                        jest.clearAllMocks();
                        TB.init();
                        jest.runAllTimers();
                    });

                    describe('`betaMode` setting + `betamode` module', () => {
                        let module;
                        beforeEach(() => {
                            module = new TB.Module('test shortname');
                            module.config.betamode = true;
                            module.init = jest.fn();
                            TB.register_module(module);
                        });
                        it('skips `betamode` modules when not `betaMode`', () => {
                            // `true` for all settings except `betaMode`
                            TB.storage.getSetting = jest.fn((module, setting) => setting !== 'betaMode');
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).not.toHaveBeenCalled();
                        });
                        it('inits `betamode` modules when `betaMode`', () => {
                            TB.storage.getSetting = jest.fn(() => true);
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).toHaveBeenCalledTimes(1);
                        });
                    });

                    describe('`debugMode` setting + `devmode` module', () => {
                        let module;
                        beforeEach(() => {
                            module = new TB.Module('test shortname');
                            module.config.devmode = true;
                            module.init = jest.fn();
                            TB.register_module(module);
                        });
                        it('skips `devmode` modules when not `debugMode`', () => {
                            TB.storage.getSetting = jest.fn((module, setting) => setting !== 'debugMode');
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).not.toHaveBeenCalled();
                        });
                        it('inits `devmode` modules when `debugMode`', () => {
                            TB.storage.getSetting = jest.fn(() => true);
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).toHaveBeenCalledTimes(1);
                        });
                    });

                    describe('`isOldReddit` setting + `oldReddit` module', () => {
                        let module;
                        beforeEach(() => {
                            module = new TB.Module('test shortname');
                            module.oldReddit = true;
                            module.init = jest.fn();
                            TB.register_module(module);
                        });
                        it('skips `oldReddit` modules when not `isOldReddit`', () => {
                            TBCore.isOldReddit = false;
                            TB.storage.getSetting = jest.fn(() => true);
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).not.toHaveBeenCalled();
                        });
                        it('inits `oldReddit` modules when `isOldReddit`', () => {
                            TBCore.isOldReddit = true;
                            TB.storage.getSetting = jest.fn(() => true);
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).toHaveBeenCalledTimes(1);
                        });
                    });

                    describe('enabled/disabled modules', () => {
                        let module;
                        beforeEach(() => {
                            module = new TB.Module('test shortname');
                            module.oldReddit = false;
                            module.init = jest.fn();
                            TB.register_module(module);
                        });
                        it('skips disabled modules', () => {
                            TB.storage.getSetting = jest.fn((module, setting) => setting !== 'enabled');
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).not.toHaveBeenCalled();
                        });
                        it('inits enabled modules', () => {
                            TB.storage.getSetting = jest.fn(() => true);
                            TB.init();
                            jest.runAllTimers();
                            expect(module.init).toHaveBeenCalledTimes(1);
                        });
                    });
                });
            });
        });
    });

    describe('TB.Module', () => {
        const moduleName = 'Test Module Name';
        let module;
        beforeEach(() => {
            dispatchTBCoreLoaded();
            module = new TB.Module(moduleName);
        });

        describe('constructor(name)', () => {
            it('sets "name" property from parameter', () => {
                expect(module.name).toStrictEqual(moduleName);
            });
            it('mixes-in `TBLog`', () => {
                expect(TBLog).toHaveBeenCalledWith(module);
                expect(typeof module.log).toBe('function');
            });

            describe('creates default properties', () => {
                it('the `settingsList` property is `["enabled"]`', () => {
                    expect(module.settingsList).toStrictEqual(['enabled']);
                });

                describe('the `shortname` property', () => {
                    it('strips spaces when derived from `name`', () => {
                        expect(module.shortname).toStrictEqual('TestModuleName');
                    });
                    it('does not strip spaces when explicitly set', () => {
                        const shortname = 'another test';
                        module.shortname = shortname;
                        expect(module.shortname).toStrictEqual(shortname);
                    });
                });

                describe('the `config` property', () => {
                    it('is an object', () => {
                        expect(module.config).toBeInstanceOf(Object);
                    });
                    it('defaults property `betamode` to `false`', () => {
                        expect(module.config.betamode).toBe(false);
                    });
                    it('defaults property `devmode` to `false`', () => {
                        expect(module.config.devmode).toBe(false);
                    });
                });

                describe('the `settings` property', () => {
                    it('is an object', () => {
                        expect(module.settings).toBeInstanceOf(Object);
                    });
                    it('creates a property `settings.enabled` that is an object', () => {
                        expect(module.settings.enabled).toBeInstanceOf(Object);
                    });
                    it('defaults `settings.enabled.type` to "boolean"', () => {
                        expect(module.settings.enabled.type).toBe('boolean');
                    });
                    it('defaults `settings.enabled.default` to `false`', () => {
                        expect(module.settings.enabled.default).toBe(false);
                    });
                    it('defaults `settings.enabled.betamode` to `false`', () => {
                        expect(module.settings.enabled.betamode).toBe(false);
                    });
                    it('defaults `settings.enabled.hidden` to `false`', () => {
                        expect(module.settings.enabled.hidden).toBe(false);
                    });
                    it('defaults `settings.enabled.title` to "Enable $name"', () => {
                        expect(module.settings.enabled.title).toBe(`Enable ${moduleName}`);
                    });
                });
            });
        });

        describe('instance methods', () => {
            it('init() is a function', () => {
                expect(module.init).toBeInstanceOf(Function);
                expect(typeof module.init()).toBe('undefined');
            });

            describe('register_setting(name, setting)', () => {
                const name = 'test name';
                const setting = 'test setting';
                beforeEach(() => {
                    module.register_setting(name, setting);
                });
                it('adds the setting name to `settingsList`', () => {
                    expect(module.settingsList).toContain(name);
                });
                it('adds the setting to `settings`', () => {
                    expect(module.settings).toHaveProperty(name, setting);
                });
            });

            describe('setting(name, value, syncSetting)', () => {
                const name = 'test name';
                const value = 'test value';
                describe('when called as a setter', () => {
                    const MOCK_RETURN = Symbol('mock return');
                    let result;
                    beforeEach(() => {
                        TB.storage.setSetting.mockImplementationOnce(() => MOCK_RETURN);
                        result = module.setting(name, value);
                    });
                    it('sets a setting', () => {
                        expect(TB.storage.setSetting).toHaveBeenLastCalledWith(
                            module.shortname,
                            name,
                            value,
                            expect.anything(),
                        );
                    });
                    it('defaults `syncSetting` parameter to `true`', () => {
                        const syncSetting = true;
                        expect(TB.storage.setSetting).toHaveBeenLastCalledWith(
                            expect.anything(),
                            expect.anything(),
                            expect.anything(),
                            syncSetting,
                        );
                    });
                    it('honors `false` for `syncSetting` parameter', () => {
                        const syncSetting = false;
                        module.setting(name, value, syncSetting);
                        expect(TB.storage.setSetting).toHaveBeenLastCalledWith(
                            expect.anything(),
                            expect.anything(),
                            expect.anything(),
                            syncSetting,
                        );
                    });
                    it('propagates the return value', () => {
                        expect(result).toStrictEqual(MOCK_RETURN);
                    });
                });

                describe('when called as a getter without a default setting', () => {
                    const MOCK_RETURN = Symbol('mock return');
                    let result;
                    beforeEach(() => {
                        TB.storage.getSetting.mockImplementationOnce(() => MOCK_RETURN);
                        result = module.setting(name);
                    });
                    it('gets a setting', () => {
                        expect(TB.storage.getSetting).toHaveBeenLastCalledWith(module.shortname, name);
                    });
                    it('propagates the return value', () => {
                        expect(result).toStrictEqual(MOCK_RETURN);
                    });
                });

                describe('when called as a getter with a default setting', () => {
                    const MOCK_RETURN = Symbol('mock return');
                    const defaultValue = 'test default';
                    let result;
                    beforeEach(() => {
                        TB.storage.getSetting.mockImplementationOnce(() => MOCK_RETURN);
                        module.settings[name] = {default: defaultValue};
                        result = module.setting(name);
                    });
                    it('gets a default setting', () => {
                        expect(TB.storage.getSetting).toHaveBeenLastCalledWith(
                            module.shortname,
                            name,
                            defaultValue,
                        );
                    });
                    it('propagates the return value', () => {
                        expect(result).toStrictEqual(MOCK_RETURN);
                    });
                });
            });

            describe('profiling', () => {
                const key = 'test key';
                beforeEach(() => {
                    TBCore.debugMode = true;
                });

                it('getProfiles() returns a `Map`', () => {
                    module.startProfile(key);
                    expect(module.getProfiles()).toBeInstanceOf(Map);
                });

                it('getProfile(key) returns a profile', () => {
                    module.startProfile(key);
                    expect(module.getProfile(key)).toMatchObject({time: 0, calls: 1});
                });

                it('printProfiles()', () => {
                    module.startProfile(key);
                    module.printProfiles();
                    expect(module.log).toHaveBeenCalledTimes(6);
                });

                it('does not run when not `TBCore.debugMode`', () => {
                    TBCore.debugMode = false;
                    module.startProfile(key);
                    expect(module.getProfiles().size).toStrictEqual(0);
                });

                describe('startProfile(key)', () => {
                    it('initializes a new profile for `key`', () => {
                        module.startProfile(key);
                        expect(module.getProfile(key)).toMatchObject({time: 0, calls: 1});
                    });
                    it('increments `calls` for existing profile', () => {
                        module.startProfile(key);
                        module.startProfile(key);
                        expect(module.getProfile(key).calls).toStrictEqual(2);
                    });
                    it('calls `performance.now()`', () => {
                        performance.now = jest.fn();
                        module.startProfile(key);
                        expect(performance.now).toHaveBeenCalledTimes(1);
                    });
                });

                describe('endProfile(key)', () => {
                    it('does nothing when not `TBCore.debugMode`', () => {
                        performance.now = jest.fn();
                        TBCore.debugMode = false;
                        module.endProfile(key);
                        expect(performance.now).not.toHaveBeenCalled();
                    });
                    it('calculates spent time', () => {
                        performance.now = jest.fn()
                            .mockReturnValueOnce(1)
                            .mockReturnValueOnce(3);
                        module.startProfile(key);
                        module.endProfile(key);
                        expect(module.getProfile(key).time).toEqual(2);
                    });
                    it('ignores bogus keys', () => {
                        module.endProfile(key);
                        expect(module.getProfile(key)).toBeUndefined();
                    });
                    it('calls `performance.now()`', () => {
                        module.startProfile(key);
                        performance.now = jest.fn();
                        module.endProfile(key);
                        expect(performance.now).toHaveBeenCalledTimes(1);
                    });
                });
            });
        });
    });
});
