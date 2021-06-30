import TBLog from './tblog.js';
import * as TBStorage from './tbstorage.js';
import * as TBApi from './tbapi.js';
import * as TBHelpers from './tbhelpers.js';
import * as TBCore from './tbcore.js';

const logger = TBLog('TBui');
const $body = $('body');

export const longLoadArray = [];
export const longLoadArrayNonPersistent = [];

// We don't want brack-buttons to propagate to parent elements as that often triggers the reddit lightbox
$body.on('click', '.tb-bracket-button', event => {
    event.stopPropagation();
});

let subredditColorSalt;
let contextMenuLocation = 'left';
let contextMenuAttention = 'open';
let contextMenuClick = false;

(async () => {
    subredditColorSalt = await TBStorage.getSettingAsync('QueueTools', 'subredditColorSalt', 'PJSalt');
    contextMenuLocation = await TBStorage.getSettingAsync('GenSettings', 'contextMenuLocation', 'left');
    contextMenuAttention = await TBStorage.getSettingAsync('GenSettings', 'contextMenuAttention', 'open');
    contextMenuClick = await TBStorage.getSettingAsync('GenSettings', 'contextMenuClick', false);
})();

/**
 * Material design icons mapped to toolbox names through their hexcode.
 *
 * Usage `<div class="tb-icon">${icons.NAME}</div>`
 * @constant {object}
 */
export const icons = {
    add: '&#xe145;', // add
    addBox: '&#xe146;', // add_box
    addCircle: '&#xe148;', // add_circle_outline
    arrowLeft: '&#xe314;', // keyboard_arrow_left
    arrowRight: '&#xe315;', // keyboard_arrow_right
    close: '&#xe5cd;', // close
    comments: '&#xe0b7;', // chat
    delete: '&#xe872;', // delete
    dotMenu: '&#xe5d4;', // more_vert
    edit: '&#xe3c9;', // edit
    help: '&#xe8fd;', // help_outline
    history: '&#xe889;', // history
    list: '&#xe896;', // list
    modlog: '&#xe3ec;', // grid_on
    modqueue: '&#xe8b2;', // report_problem
    newModmail: '&#xe168;', // move_to_inbox
    oldModmail: '&#xe156;', // inbox
    overlay: '&#xe8ea;', // view_array
    profile: '&#xe853;', // account_circle
    refresh: '&#xe5d5;', // refresh
    remove: '&#xe15b;', // remove
    settings: '&#xe8b8;', // settings
    sortDown: '&#xe5db;', // arrow_downward
    sortUp: '&#xe5d8;', // arrow_upward
    subTraffic: '&#xe6e1;', // show_chart
    tbConsole: '&#xe868;', // bug_report
    tbReload: '&#xe86a;', // cached
    tbSettingLink: '&#xe157;', // link
    tbSubConfig: '&#xe869;', // build
    unmoderated: '&#xe417;', // remove_red_eye
    userInbox: '&#xe0be;', // email
    usernote: '&#xe06f;', // note
};
    // Icons NOTE: string line length is ALWAYS 152 chars

export const logo64 = `iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsRAAALEQF/ZF+R
                    AAAAGHRFWHRTb2Z0d2FyZQBwYWludC5uZXQgNC4wLjVlhTJlAAAD1ElEQVR4Xu1ZS0hUURg+WY0tNFy0qCiCGpoaC8fXqBEZPWfRsgdRtCgkKBfRIqpFmZugAisLd9YiQsw2thGtsDYVQURBSRQ9FxER
                    FaRm5vT9+h853DmT3uE4Vzzng++e4/863/nvY+44wsFh6qG8vHx9aWnpLfBVSUnJG4xPi4uLz8A+l0MmF8rKyjZA5FmI3QLOY7NvoM5i1LkPJnVE7V/gCYTmjGRMEkDUdUXoX/zdg/EaxhqctRjmMzk0
                    LYqKigoR94VrjMWbSJk2khkwotFoCIK+ewR6+Q28jYbUg5sxn8Ppw4hEIvmwveNYyVbEbqd48BBITVX9pzg9WEDYJikK817wqyJSS8QMgs8xb8a9vRvjZcXfRzW5/CgSiUQufFdkHGL+4JZZyO7gACFN
                    iqimcDici7ECfx8G2zH/LP3jZC2X1iEH9ahxMraO7YEhByI+SUE4mwm2q5gO0SvBGsS0YHwr472E7yedac7TAnH7lPhONgcDCKhUxPwYS7wEGhVG/C7kNWN8rdR4zCFpgbi4Et/N5mAAAaelGLCFzb6A
                    vNWyBur1sDktELdRib/H5mAAAS+lGDyQdrDZF3A1zJc1wCFwGbu0QHyDjMf6bWzOPmKxWFQKAfvj8fhsdvkGNvJQ2VQXTNoXHTR5BWJ+y1hwD7uyDwg9rgjpYHNGQDO3KrWoCZ3gEnYT6GFLMaMvSvB/
                    oE8c9mcfEPBIisFluZ/NGQP1bsh6vEF6V3iC+R3wo+oDh+Bbx6nZBy73BSRCiqH7mF0Zo7q6ehZqtXPNtMTG+zDu5LRgABEHFFEP2GwEqFeL+u+V+pLU8A56DnBocICQLkXYUTYbA66GGdjoKnAvmnEQ
                    a2zDVbaI3cEC39oKIGpANgDClrPLDmDz9AYnz/4LNtuDpVVVbYWVlckoGKmoCPzLiDgvxN2LQnRni/V5eQP1+flJ4rlQ6FmjJiZbpL0LTPrBpKXsdw2gg8doE10DXAPo4DHaxIwacPWCEHU6ks8TOxE0
                    ub7/BlwSYg2/QqSAfLockzS8/nADemkyXuLFZS2vlwLy6XJM0vD6vaJViJAfnvzP72rk0+WYpOn1OdVi0H3TgEvHBws4NQXk88ROBI2tP/w8wdNzEPeC7gGhJeJTfneTIJ8uxyRNrk979/0pQJ3j9VJA
                    Pl2OSRpe3//HoPUNMPw57JuG13dvgpk0YCrRNcA1gA4eo010DXANoIPHaBNdA1wD6OAx2kTXANcAOniMNtE1wDWADh6jTXQNcA2gg8doE10DfP8wMpVIe6cr4EijEMdsJO2d/6Pu4GAnhPgH06SDEG5p
                    qnUAAAAASUVORK5CYII=`;

export const iconBot = `iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACz0lEQVQ4T3VTXUhTYRh+zzbdNHZ0E5sjdLOiLnTahQaCFGiIwSK9iIGhGQjOM3GgN0MENYTJYGKiG91kPxe5qxkJk0jQ7EKwvHAarMTM
                    tvYD+2XqnHPr/Q4Jm60PDt95v/f7nvM8z/ccCs4NrVY7I5FIng4ODn5Lb+n1ernX69VNTk6q09ep8wAjIyOcvb09o0wm04+OjvpIX6PR3OJyuU1isfgJ9uP/BZiYmLgUDAYtqVTqSjKZFOKhMM5crGl8
                    D+LBHyKRSNXf3+86A8lgYDAYOuRy+UuFQgFutwdKS0tBIBDAzs4OFBTQ7Ly7u/tIp9O9ygowPm7oKSoSmQKBAJSVlYHP5wOhkMa9KQiFQsDhcCAWizEIYM4KYDQaew4PD01VVVXQ2HgHTKYZODqKQW+v
                    BhwOB9hsNigsLGQGBgayA0xNTfXQNG3yeDzA4/EA9UJ+/gXY3/8J6APKKICTkxOmr6/vXwCz2VzpcrneV1YqpHV1dSxloVDIMo1Go4DAsLa2Bltbdjf61NTV1bVFeqyJeLfX/X7/SnPzXcnq6kc4PT0F
                    dD3jhgmDRCIBDQ2NsLho80ql0tsMwzio6enpa0h5Wam8JyXuz829gerqG2iijNBlqefk5MDBQRTm563Q3a0Gu90OCwvv3Bi4GmpoaGgVDauvra2B7e2vpAEtLS1QXn6ZBSCD+BEOh2F29jkolUqoqKiA
                    9fXPsLT04RM1PDzsV6lU4ng8DlarNcLn82kMDxwfH2dIwHUgD/qRaG1t5eXm5oLFYglQY2Nj9filtxRFEe3a4uLi1+3tHZBMpmBlZRmczl+QXm9sfHmGjB78lXafNRHzLUCXKdR6FRubbW0PWQBiqMvl
                    hPTa7f7NINsXkUgkhediGVHGf0HB5fI2Ozs70TwgGpGBE9JrBMyeA8IEg8TH69zPy8u7SGqMbQgZxdPrkhLZTbX68fczg/4A1KNbXBApXrkAAAAASUVORK5CYII=`;

/** Map of commonly used color names to CSS color values. */
export const standardColors = {
    red: '#FF0000',
    softred: '#ED4337',
    green: '#347235',
    lightgreen: '#00F51E',
    blue: '#0082FF',
    magenta: '#DC00C8',
    cyan: '#00F0F0',
    yellow: '#EAC117',
    softyellow: '#FFFC7F',
    black: '#000000',
};

export const FEEDBACK_NEUTRAL = 'neutral';
export const FEEDBACK_POSITIVE = 'positive';
export const FEEDBACK_NEGATIVE = 'negative';

export const DISPLAY_CENTER = 'center';
export const DISPLAY_BOTTOM = 'bottom';
export const DISPLAY_CURSOR = 'cursor';

/**
 * Generates HTML for a general button.
 * @param {string} text Raw HTML string rendered inside the button
 * @param {string} classes Extra text added to the button's `class` attribute
 * @returns {string}
 */
export const button = (text, classes) => `
    <a href="javascript:;" class="tb-general-button ${classes}">${text}</a>
`;

/**
 * Generates HTML for an action button.
 * @param {string} text Raw HTML string rendered inside the button
 * @param {string} classes Extra text added to the button's `class` attribute
 * @returns {string}
 */
export const actionButton = (text, classes) => `
    <a href="javascript:;" class="tb-action-button ${classes}">${text}</a>
`;

// Notification stuff

/**
 * Show an in-page notification on the current tab.
 * @function
 * @param {object} options The options for the notification
 * @param {string} options.id The notification's ID
 * @param {string} options.title The notification's title
 * @param {string} options.body The notification's body
 */
export const showNotification = ({id, title, body}) => {
    let $notificationDiv = $('#tb-notifications-wrapper');
    if (!$notificationDiv.length) {
        // Create the wrapper element if it's not already there
        $notificationDiv = $(`
                <div id="tb-notifications-wrapper"></div>
            `).appendTo($body);
    }

    // Make lines of the message into paragraphs
    body = body
        .split('\n')
        .filter(line => line) // Ignore empty lines
        .map(line => `<p>${TBHelpers.escapeHTML(line)}</p>`)
        .join('');

    $notificationDiv.prepend(`
            <div class="tb-window tb-notification" data-id="${id}">
                <div class="tb-window-header">
                    <div class="tb-window-title">${title}</div>
                    <div class="buttons">
                        <a class="close">
                            <i class="tb-icons">${icons.close}</i>
                        </a>
                    </div>
                </div>
                <div class="tb-window-content">${body}</div>
            </div>
        `);
};

/**
 * Clears an in-page notification on the current tab.
 * @function
 * @param {string} id The ID of the notification to clear
 */
export const clearNotification = id => {
    $(`.tb-notification[data-id="${id}"]`).remove();
};

// Handle notification updates from the background page
browser.runtime.onMessage.addListener(message => {
    if (message.action === 'tb-show-page-notification') {
        logger.log('Notifier message get:', message);
        showNotification(message.details);
    } else if (message.action === 'tb-clear-page-notification') {
        logger.log('Notifier message clear:', message);
        clearNotification(message.id);
    }
});

// Notification click handlers
$body.on('click', '.tb-notification .close', function (event) {
    event.stopPropagation(); // don't open the linked page
    browser.runtime.sendMessage({
        action: 'tb-page-notification-close',
        id: $(this).closest('.tb-notification').attr('data-id'),
    });
});
$body.on('click', '.tb-notification', function () {
    browser.runtime.sendMessage({
        action: 'tb-page-notification-click',
        id: $(this).attr('data-id'),
    });
});

/**
 * Generate a popup.
 * @function
 * @param {object} options Options for the popup
 * @param {string} options.title The popup's title (raw HTML)
 * @param {object[]} options.tabs The tabs for the popup
 * @param {string?} options.cssClass Extra CSS class to add to the popup
 * @param {string?} options.meta Raw HTML to add to a "meta" container
 * @param {boolean?} [draggable=true] Whether the user can move the popup
 * @returns {jQuery}
 */
export function popup ({
    title,
    tabs,
    cssClass = '',
    meta,
    draggable = true,
    closable = true,
}) {
    // tabs = [{id:"", title:"", tooltip:"", help_text:"", help_url:"", content:"", footer:""}];
    const $popup = $(`
            <div class="tb-window ${draggable ? 'tb-window-draggable' : ''} ${cssClass}">
                ${meta ? `<div class="meta" style="display: none;">${meta}</div>` : ''}
                <div class="tb-window-header">
                    <div class="tb-window-title">${title}</div>
                    <div class="buttons">
                        <a class="close" href="javascript:;">
                            <i class="tb-icons">${icons.close}</i>
                        </a>
                    </div>
                </div>
            </div>
        `);
    if (tabs.length === 1) {
        // We don't use template literals here as the content can be a jquery object.
        $popup.append($('<div class="tb-window-content"></div>').append(tabs[0].content));
        $popup.append($('<div class="tb-window-footer"></div>').append(tabs[0].footer));
    } else {
        const $tabs = $('<div class="tb-window-tabs"></div>');
        $popup.append($tabs);

        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];
            if (tab.id === 'undefined' || !tab.id) {
                tab.id = tab.title.trim().toLowerCase().replace(/\s/g, '_');
            }

            // Create tab button
            const $button = $(`
                    <a class="${tab.id}" title="${tab.tooltip || ''}">
                        ${tab.title}
                    </a>
                `);

            $button.click({tab}, function (e) {
                const tab = e.data.tab;

                // hide others
                $tabs.find('a').removeClass('active');
                $popup.find('.tb-window-tab').hide();

                // show current
                $popup.find(`.tb-window-tab.${tab.id}`).show();
                $(this).addClass('active');

                e.preventDefault();
            });

            // default first tab is active tab
            if (i === 0) {
                $button.addClass('active');
            }

            $button.appendTo($tabs);

            // We don't use template literals here as the content can be a jquery object.
            const $tab = $(`<div class="tb-window-tab ${tab.id}"></div>`);
            $tab.append($('<div class="tb-window-content"></div>').append(tab.content));
            $tab.append($('<div class="tb-window-footer""></div>').append(tab.footer));

            // default first tab is visible; hide others
            if (i === 0) {
                $tab.show();
            } else {
                $tab.hide();
            }

            $tab.appendTo($popup);
        }
    }

    if (draggable) {
        $popup.drag($popup.find('.tb-window-header'));
        // Don't let people drag by the buttons, that gets confusing
        $popup.find('.buttons a').on('mousedown', e => e.stopPropagation());
    }

    if (closable) {
        $popup.on('click', '.close', event => {
            event.stopPropagation();
            $popup.remove();
        });
    }

    return $popup;
}

export function drawPosition (event) {
    const positions = {
        leftPosition: '',
        topPosition: '',
    };

    const $overlay = $(event.target).closest('.tb-page-overlay');

    if (document.documentElement.clientWidth - event.pageX < 400) {
        positions.leftPosition = event.pageX - 600;
    } else {
        positions.leftPosition = event.pageX - 50;
    }

    if (document.documentElement.clientHeight - event.pageY < 200 && location.host === 'mod.reddit.com') {
        const topPosition = event.pageY - 600;

        if (topPosition < 0) {
            positions.topPosition = 5;
        } else {
            positions.topPosition = event.pageY - 600;
        }
    } else {
        positions.topPosition = event.pageY - 50;
    }

    if ($overlay.length) {
        const scrollTop = $overlay.scrollTop();
        positions.topPosition = event.clientY + scrollTop;
    }

    if (positions.topPosition < 0) {
        positions.topPosition = 5;
    }

    return positions;
}

export function switchOverlayTab (overlayClass, tabName) {
    const $overlay = $body.find(`.${overlayClass}`);

    const $tab = $overlay.find(`[data-module="${tabName}"]`);

    $overlay.find('.tb-window-tabs a').removeClass('active');
    $tab.addClass('active');

    $('.tb-window .tb-window-tab').hide();
    $(`.tb-window .tb-window-tab.${tabName}`).show();
}

/**
 * Generates an overlay containing a single large window.
 * @param {string} title The title of the window
 * @param {object[]} tabs An array of tab objects
 * @param {string} buttons Additional buttons to add to the window's header
 * as an HTML string
 * @param {string} css_class Additional CSS classes to add to the overlay
 * @param {string} single_footer If provided, a single footer to use for all
 * tabs rather than relying on the footer data from each provided tab object
 * @param {object} details An object of metadata attached to the overlay,
 * where each key:val of the object is mapped to a `data-key="val"` attribute
 * @param {bool} verticalTabs Pass false to use horizontal tabs instead
 */
export function overlay (title, tabs, buttons, css_class, single_footer, details, verticalTabs = true) {
    buttons = typeof buttons !== 'undefined' ? buttons : '';
    css_class = typeof css_class !== 'undefined' ? css_class : '';
    single_footer = typeof single_footer !== 'undefined' ? single_footer : false;

    // tabs = [{id:"", title:"", tooltip:"", help_page:"", content:"", footer:""}];
    const $overlay = $(`
            <div class="tb-page-overlay ${css_class ? ` ${css_class}` : ''}">
                <div class="tb-window tb-window-large ${verticalTabs ? 'tb-window-vertical-tabs' : ''}">
                    <div class="tb-window-header">
                        <div class="tb-window-title">${title}</div>
                        <div class="buttons">
                            ${buttons}
                            <a class="close" href="javascript:;">
                                <i class="tb-icons">${icons.close}</i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `);

    if (details) {
        Object.entries(details).forEach(([key, value]) => {
            $overlay.attr(`data-${key}`, value);
        });
    }

    // we need a way to handle closing the overlay with a default, but also with use-specific cleanup code to run
    // NOTE: Click handler binds should be attached to the parent element of the relevant object, not $(body).
    // $overlay.on('click', '.buttons .close', function () {});
    if (tabs.length === 1) {
        $overlay.find('.tb-window').append($('<div class="tb-window-content"></div>').append(tabs[0].content));
        $overlay.find('.tb-window').append($('<div class="tb-window-footer"></div>').append(single_footer ? single_footer : tabs[0].footer));
    } else if (tabs.length > 1) {
        $overlay.find('.tb-window').append($('<div class="tb-window-tabs"></div>'));
        $overlay.find('.tb-window').append($('<div class="tb-window-tabs-wrapper"></div>'));

        for (let i = 0; i < tabs.length; i++) {
            const tab = tabs[i];

            tab.disabled = typeof tab.disabled === 'boolean' ? tab.disabled : false;
            tab.help_page = typeof tab.help_page !== 'undefined' ? tab.help_page : '';

            if (!TBStorage.getSetting('Utils', 'advancedMode', false) && tab.advanced) {
                continue;
            }

            if (tab.id === 'undefined' || !tab.id) {
                tab.id = tab.title.trim().toLowerCase();
                tab.id = tab.id.replace(/\s/g, '_');
            }

            const $button = $(`<a${tab.tooltip ? ` title="${tab.tooltip}"` : ''} ${tab.id ? ` data-module="${tab.id}"` : ''} class="${tab.id}" >${tab.title} </a>`);

            $button.data('help_page', tab.help_page);

            if (tab.disabled) {
                $button.addClass('tb-module-disabled');
                $button.attr('title', 'This module is not active, you can activate it in the "Toggle Modules" tab.');
            }

            // click handler for tabs
            $button.click({tab}, function (e) {
                const tab = e.data.tab;

                // hide others
                $overlay.find('.tb-window-tabs a').removeClass('active');
                $overlay.find('.tb-window-tab').hide();

                // show current
                $overlay.find(`.tb-window-tab.${tab.id}`).show();

                // Only hide and show the footer if we have multiple options for it.
                if (!single_footer) {
                    $overlay.find('.tb-window-footer').hide();
                    $overlay.find(`.tb-window-footer.${tab.id}`).show();
                }

                $(this).addClass('active');

                e.preventDefault();
            });

            $button.appendTo($overlay.find('.tb-window-tabs'));

            const $tab = $(`<div class="tb-window-tab ${tab.id}"></div>`);
            // $tab.append($('<div class="tb-window-content">' + tab.content + '</div>'));
            $tab.append($('<div class="tb-window-content"></div>').append(tab.content));
            // individual tab footers (as used in .tb-config)
            if (!single_footer) {
                $overlay.find('.tb-window').append($(`<div class="tb-window-footer ${tab.id}"></div>`).append(tab.footer));

                const $footer = $overlay.find(`.tb-window-footer.${tab.id}`);
                if (i === 0) {
                    $footer.show();
                } else {
                    $footer.hide();
                }
            }

            // default first tab is active = visible; hide others
            if (i === 0) {
                $button.addClass('active');

                $tab.show();
            } else {
                $tab.hide();
            }

            $tab.appendTo($overlay.find('.tb-window .tb-window-tabs-wrapper'));
        }
    }

    // single footer for all tabs (as used in .tb-settings)
    if (single_footer) {
        $overlay.find('.tb-window').append($('<div class="tb-window-footer"></div>').append(single_footer));
    }

    return $overlay;
}

export function selectSingular (choices, selected) {
    const $selector = $(`
        <div class="select-single">
            <select class="selector tb-action-button"></select>
        </div>`),
          $selector_list = $selector.find('.selector');

    // Add values to select
    choices.forEach(keyValue => {
        const value = keyValue.toLowerCase().replace(/\s/g, '_');
        $selector_list.append($('<option>').attr('value', value).text(keyValue));
    });

    // Set selected value
    $selector_list.val(selected).prop('selected', true);

    return $selector;
}

export function selectMultiple (available, selected) {
    available = available instanceof Array ? available : [];
    selected = selected instanceof Array ? selected : [];

    const $select_multiple = $(`
                  <div class="select-multiple">
                      <select class="selected-list left tb-action-button"></select>&nbsp;<button class="remove-item right tb-action-button">remove</button>&nbsp;
                      <select class="available-list left tb-action-button"></select>&nbsp;<button class="add-item right tb-action-button">add</button>&nbsp;
                      <div style="clear:both"></div>
                  </div>
              `),
          $selected_list = $select_multiple.find('.selected-list'),
          $available_list = $select_multiple.find('.available-list');

    $select_multiple.on('click', '.remove-item', e => {
        const $select_multiple = $(e.delegateTarget);
        $select_multiple.find('.selected-list option:selected').remove();
    });

    $select_multiple.on('click', '.add-item', e => {
        const $select_multiple = $(e.delegateTarget);
        const $add_item = $select_multiple.find('.available-list option:selected');

        // Don't add the sub twice.
        let exists = false;
        $selected_list.find('option').each(function () {
            if (this.value === $add_item.val()) {
                exists = true;
                return false;
            }
        });

        if (!exists) {
            $selected_list.append($add_item.clone()).val($add_item.val());
        }
    });

    available.forEach(value => {
        $available_list.append($('<option>').attr('value', value).text(value));
    });

    selected.forEach(value => {
        $selected_list.append($('<option>').attr('value', value).text(value));
    });

    return $select_multiple;
}

export function mapInput (labels, items) {
    const keyLabel = labels[0],
          valueLabel = labels[1];

    const $mapInput = $(`<div>
            <table class="tb-map-input-table">
                <thead><tr>
                    <td>${keyLabel}</td>
                    <td>${valueLabel}</td>
                    <td class="tb-map-input-td-remove">remove</td>
                </tr></thead>
                <tbody></tbody>
            </table>
            <a class="tb-map-input-add tb-icons tb-icons-positive" href="javascript:void(0)">${icons.addBox}</a></div>`);

    const emptyRow = `
            <tr class="tb-map-input-tr">
                <td><input type="text" class="tb-input" name="key"></td>
                <td><input type="text" class="tb-input" name="value"></td>
                <td class="tb-map-input-td-remove">
                    <a class="tb-map-input-td-remove" href="javascript:void(0)"></a>
                </td>
            </tr>`;

    // remove item
    $mapInput.on('click', '.tb-map-input-remove', function () {
        $(this).closest('.tb-map-input-tr').remove();
    });

    // add empty item
    $mapInput.on('click', '.tb-map-input-add', () => {
        $(emptyRow).appendTo($mapInput.find('.tb-map-input-table tbody'));
    });

    // populate items
    if ($.isEmptyObject(items)) {
        $(emptyRow).appendTo($mapInput.find('.tb-map-input-table tbody'));
    } else {
        Object.entries(items).forEach(([key, value]) => {
            const $item = $(`
                <tr class="tb-map-input-tr">
                    <td><input type="text" class="tb-input" value="${TBHelpers.htmlEncode(unescape(key))}" name="key"></td>
                    <td><input type="text" class="tb-input" value="${TBHelpers.htmlEncode(unescape(value))}" name="value"></td>
                    <td class="tb-map-input-td-remove">
                        <a class="tb-map-input-remove tb-icons tb-icons-negative tb-icons-align-middle" href="javascript:void(0)">${icons.delete}</a>
                    </td>
                </tr>`);
            $item.appendTo($mapInput.find('.tb-map-input-table tbody'));
        });
    }

    return $mapInput;
}

export function textFeedback (feedbackText, feedbackKind, displayDuration, displayLocation) {
    if (!displayLocation) {
        displayLocation = DISPLAY_CENTER;
    }

    // Without text we can't give feedback, the feedbackKind is required to avoid problems in the future.
    if (feedbackText && feedbackKind) {
        // If there is still a previous feedback element on the page we remove it.
        $body.find('#tb-feedback-window').remove();

        // build up the html, not that the class used is directly passed from the function allowing for easy addition of other kinds.
        const feedbackElement = TBStorage.purify(`<div id="tb-feedback-window" class="${feedbackKind}"><span class="tb-feedback-text">${feedbackText}</span></div>`);

        // Add the element to the page.
        $body.append(feedbackElement);

        // center it nicely, yes this needs to be done like this if you want to make sure it is in the middle of the page where the user is currently looking.
        const $feedbackWindow = $body.find('#tb-feedback-window');

        switch (displayLocation) {
        case DISPLAY_CENTER: {
            const feedbackLeftMargin = $feedbackWindow.outerWidth() / 2,
                  feedbackTopMargin = $feedbackWindow.outerHeight() / 2;

            $feedbackWindow.css({
                'margin-left': `-${feedbackLeftMargin}px`,
                'margin-top': `-${feedbackTopMargin}px`,
            });
        }
            break;
        case DISPLAY_BOTTOM: {
            $feedbackWindow.css({
                left: '5px',
                bottom: '40px',
                top: 'auto',
                position: 'fixed',
            });
        }
            break;
        case DISPLAY_CURSOR: {
            $(document).mousemove(e => {
                const posX = e.pageX,
                      posY = e.pageY;

                $feedbackWindow.css({
                    left: posX - $feedbackWindow.width() + 155,
                    top: posY - $feedbackWindow.height() - 15,
                    position: 'fixed',
                });
            });
        }
            break;
        }

        // And fade out nicely after 3 seconds.
        $feedbackWindow.delay(displayDuration ? displayDuration : 3000).fadeOut();
    }
}

// Our awesome long load spinner that ended up not being a spinner at all. It will attend the user to ongoing background operations with a warning when leaving the page.
export function longLoadSpinner (createOrDestroy, feedbackText, feedbackKind, feedbackDuration, displayLocation) {
    if (createOrDestroy !== undefined) {
        // if requested and the element is not present yet
        if (createOrDestroy && longLoadArray.length === 0) {
            $('head').append(`<style id="tb-long-load-style">
                .mod-toolbox-rd #tb-bottombar, .mod-toolbox-rd #tb-bottombar-hidden {
                    bottom: 10px !important
                }
                </style>`);

            $body.append(`<div id="tb-loading-stuff"><span class="tb-loading-content"><img src="${browser.runtime.getURL('data/images/snoo_running.gif')}" alt="loading"> <span class="tb-loading-text">${TBCore.RandomFeedback}</span></span></div>`);
            $body.append('<div id="tb-loading"></div>');

            const $randomFeedbackWindow = $('body').find('#tb-loading-stuff'),
                  randomFeedbackLeftMargin = $randomFeedbackWindow.outerWidth() / 2,
                  randomFeedbackTopMargin = $randomFeedbackWindow.outerHeight() / 2;

            $randomFeedbackWindow.css({
                'margin-left': `-${randomFeedbackLeftMargin}px`,
                'margin-top': `-${randomFeedbackTopMargin}px`,
            });

            longLoadArray.push('load');

            // if requested and the element is already present
        } else if (createOrDestroy && longLoadArray.length > 0) {
            longLoadArray.push('load');

            // if done and the only instance
        } else if (!createOrDestroy && longLoadArray.length === 1) {
            $('head').find('#tb-long-load-style').remove();
            $('body').find('#tb-loading').remove();
            $('body').find('#tb-loading-stuff').remove();
            longLoadArray.pop();

            // if done but other process still running
        } else if (!createOrDestroy && longLoadArray.length > 1) {
            longLoadArray.pop();
        }

        // Support for text feedback removing the need to fire two function calls from a module.
        if (feedbackText !== undefined && feedbackKind !== undefined) {
            textFeedback(feedbackText, feedbackKind, feedbackDuration, displayLocation);
        }
    }
}

// Our awesome long load spinner that ended up not being a spinner at all. It will attend the user to ongoing background operations, this variant will NOT warn when you leave the page.
export function longLoadNonPersistent (createOrDestroy, feedbackText, feedbackKind, feedbackDuration, displayLocation) {
    if (createOrDestroy !== undefined) {
        // if requested and the element is not present yet
        if (createOrDestroy && longLoadArrayNonPersistent.length === 0) {
            $('head').append(`<style id="tb-long-load-style-non-persistent">
                .mod-toolbox-rd #tb-bottombar, .mod-toolbox-rd #tb-bottombar-hidden {
                    bottom: 10px !important
                }
                </style>`);

            $body.append('<div id="tb-loading-non-persistent"></div>');

            longLoadArrayNonPersistent.push('load');

            // if requested and the element is already present
        } else if (createOrDestroy && longLoadArrayNonPersistent.length > 0) {
            longLoadArrayNonPersistent.push('load');

            // if done and the only instance
        } else if (!createOrDestroy && longLoadArrayNonPersistent.length === 1) {
            $('head').find('#tb-long-load-style-non-persistent').remove();
            $('body').find('#tb-loading-non-persistent').remove();
            longLoadArrayNonPersistent.pop();

            // if done but other process still running
        } else if (!createOrDestroy && longLoadArrayNonPersistent.length > 1) {
            longLoadArrayNonPersistent.pop();
        }

        // Support for text feedback removing the need to fire two function calls from a module.
        if (feedbackText !== undefined && feedbackKind !== undefined) {
            textFeedback(feedbackText, feedbackKind, feedbackDuration, displayLocation);
        }
    }
}

export function beforeunload () {
    if (longLoadArray.length > 0) {
        return 'toolbox is still busy!';
    }
}

let contextTimeout;

/**
 * Add or remove a menu element to the context aware menu. Makes the menu
 * shows if it was empty before adding, hides menu if it is empty after removing.
 * @function
 * @param {string} triggerId This will be part of the id given to the element.
 * @param {object} options
 * @param {boolean} options.addTrigger Indicates of the menu item needs to
 * be added or removed.
 * @param {string} options.triggerText Text displayed in menu. Not needed
 * when addTrigger is false.
 * @param {string} options.triggerIcon The material icon that needs to be
 * displayed before the menu item. Defaults to 'label'
 * @param {string} options.title Title to be used in title attribute. If no
 * title is given the triggerText will be used.
 * @param {object} options.dataAttributes Any data attribute that might be
 * needed. Object keys will be used as the attribute name and value as value.
 */
export function contextTrigger (triggerId, options) {
    // We really don't need two context menus side by side.
    if (TBCore.isEmbedded) {
        return;
    }
    const addTrigger = options.addTrigger;
    // These elements we will need in the future.
    let $tbContextMenu = $body.find('#tb-context-menu');
    if (!$tbContextMenu.length) {
        // Toolbox context action menu.
        $tbContextMenu = $(`
                <div id="tb-context-menu" class="show-context-${contextMenuLocation}">
                    <div id="tb-context-menu-wrap">
                        <div id="tb-context-header">Toolbox context menu</div>
                        <ul id="tb-context-menu-list"></ul>
                    </div>
                    <i class="tb-icons tb-context-arrow" href="javascript:void(0)">${contextMenuLocation === 'left' ? icons.arrowRight : icons.arrowLeft}</i>
                </div>
            `).appendTo($body);
        $body.addClass(`tb-has-context-${contextMenuLocation}`);

        if (contextMenuClick) {
            $tbContextMenu.addClass('click-activated');

            $tbContextMenu.on('click', () => {
                if ($tbContextMenu.hasClass('open')) {
                    $tbContextMenu.removeClass('open');
                } else {
                    $tbContextMenu.addClass('open');
                }
            });
        } else {
            $tbContextMenu.addClass('hover-activated');
        }
    }
    const $tbContextMenuList = $body.find('#tb-context-menu-list');
    // We are adding a menu item.
    if (addTrigger) {
        const triggerText = options.triggerText;
        let triggerIcon = 'label';
        if (options.triggerIcon) {
            triggerIcon = options.triggerIcon;
        }

        const title = options.triggerText;

        // Check if there are currently items in the menu.
        const lengthBeforeAdd = $tbContextMenuList.find('li').length;

        // Build the new menu item.
        const $newMenuItem = $(`
                <li id="${triggerId}" title="${title}">
                    <i class="tb-icons">${triggerIcon}</i>
                    <span>${triggerText}<span>
                </li>
            `);

        // Add data attributes if needed.
        if (options.dataAttributes) {
            Object.entries(options.dataAttributes).forEach(([name, value]) => {
                $newMenuItem.attr(`data-${name}`, value);
            });
        }

        const $checkExists = $tbContextMenuList.find(`#${triggerId}`);

        // Check if an item with the same id is already in the menu. If so we will replace it.
        if ($checkExists.length) {
            $checkExists.replaceWith($newMenuItem);
        } else {
            // Add the item to the menu.
            $tbContextMenuList.append($newMenuItem);

            // We are going a bit annoying here to draw attention to the fact that there is a new item in the menu.
            // The alternative would be to always show the entire menu.
            $tbContextMenu.addClass(contextMenuAttention);
            clearTimeout(contextTimeout);
            contextTimeout = setTimeout(() => {
                $tbContextMenu.removeClass(contextMenuAttention);
            }, contextMenuAttention === 'fade' ? 6000 : 1000);
        }

        // If the menu was empty it was hidden and we need to show it.
        if (!lengthBeforeAdd) {
            $tbContextMenu.addClass('show-tb-context');
        }
    } else {
        // We are removing a menu item.
        $tbContextMenuList.find(`#${triggerId}`).remove();
        // Check the new menu length
        const newLength = $tbContextMenuList.find('li').length;
        // If there is nothing to show anymore we hide the menu.
        if (newLength < 1) {
            $tbContextMenu.removeClass('show-tb-context');
        }
    }
}

/**
 * Handles toolbox generated `thing` items as they become visible in the viewport.
 * @function
 * @param {IntersectionObserverEntry[]} entries
 * @param {IntersectionObserver} observer
 */
function handleTBThings (entries, observer) {
    entries.forEach(entry => {
        // The observer fires for everything on page load.
        // This makes sure that we really only act on those items that are visible.
        if (!entry.isIntersecting) {
            return;
        }

        // Element is visible, we only want to handle it once. Stop observing.
        observer.unobserve(entry.target);
        const $element = $(entry.target);

        if ($element.hasClass('tb-comment')) {
            const $jsApiPlaceholderComment = $element.find('> .tb-comment-entry > .tb-jsapi-comment-container');
            $jsApiPlaceholderComment.append('<span data-name="toolbox">');
            const jsApiPlaceholderComment = $jsApiPlaceholderComment[0];
            const $jsApiPlaceholderAuthor = $element.find('> .tb-comment-entry > .tb-tagline .tb-jsapi-author-container');
            const jsApiPlaceholderAuthor = $jsApiPlaceholderAuthor[0];
            $jsApiPlaceholderAuthor.append('<span data-name="toolbox">');
            const commentAuthor = $element.attr('data-comment-author'),
                  postID = $element.attr('data-comment-post-id'),
                  commentID = $element.attr('data-comment-id'),
                  subredditName = $element.attr('data-subreddit'),
                  subredditType = $element.attr('data-subreddit-type');

            // Comment
            if (!$jsApiPlaceholderComment.hasClass('tb-frontend-container')) {
                const detailObject = {
                    type: 'TBcomment',
                    data: {
                        author: commentAuthor,
                        post: {
                            id: postID,
                        },
                        id: commentID,
                        subreddit: {
                            name: subredditName,
                            type: subredditType,
                        },
                    },
                };
                const tbRedditEventComment = new CustomEvent('tbReddit', {detail: detailObject});
                jsApiPlaceholderComment.dispatchEvent(tbRedditEventComment);
            }
            // Author
            // We don't want to send events for things already handled.
            if (!$jsApiPlaceholderAuthor.hasClass('tb-frontend-container')) {
                const detailObject = {
                    type: 'TBcommentAuthor',
                    data: {
                        author: commentAuthor,
                        post: {
                            id: postID,
                        },
                        comment: {
                            id: commentID,
                        },
                        subreddit: {
                            name: subredditName,
                            type: subredditType,
                        },
                    },
                };
                const tbRedditEventAuthor = new CustomEvent('tbReddit', {detail: detailObject});
                jsApiPlaceholderAuthor.dispatchEvent(tbRedditEventAuthor);
            }
        }

        if ($element.hasClass('tb-submission')) {
            const $jsApiPlaceholderSubmission = $element.find('.tb-jsapi-submission-container');
            $jsApiPlaceholderSubmission.append('<span data-name="toolbox">');
            const jsApiPlaceholderSubmission = $jsApiPlaceholderSubmission[0];
            const $jsApiPlaceholderAuthor = $element.find('.tb-jsapi-author-container');
            $jsApiPlaceholderAuthor.append('<span data-name="toolbox">');
            const jsApiPlaceholderAuthor = $jsApiPlaceholderAuthor[0];

            const submissionAuthor = $element.attr('data-submission-author'),
                  postID = $element.attr('data-post-id'),
                  subredditName = $element.attr('data-subreddit'),
                  subredditType = $element.attr('data-subreddit-type');

            if (!$jsApiPlaceholderSubmission.hasClass('tb-frontend-container')) {
                const detailObject = {
                    type: 'TBpost',
                    data: {
                        author: submissionAuthor,
                        id: postID,
                        permalink: `https://www.reddit.com/r/${subredditName}/comments/${postID.substring(3)}/`,
                        subreddit: {
                            name: subredditName,
                            type: subredditType,
                        },
                    },
                };

                const tbRedditEventSubmission = new CustomEvent('tbReddit', {detail: detailObject});
                jsApiPlaceholderSubmission.dispatchEvent(tbRedditEventSubmission);
            }
            // We don't want to send events for things already handled.
            if (!$jsApiPlaceholderAuthor.hasClass('tb-frontend-container')) {
                const detailObject = {
                    type: 'TBpostAuthor',
                    data: {
                        author: submissionAuthor,
                        post: {
                            id: postID,
                        },
                        subreddit: {
                            name: subredditName,
                            type: subredditType,
                        },
                    },
                };
                const tbRedditEventAuthor = new CustomEvent('tbReddit', {detail: detailObject});
                jsApiPlaceholderAuthor.dispatchEvent(tbRedditEventAuthor);
            }
        }
    });
}

const viewportObserver = new IntersectionObserver(handleTBThings, {
    rootMargin: '200px',
});
/**
 * Will send out events similar to the reddit jsAPI events for the elements given.
 * Only support 'comment' for now and will only send the commentAuthor event.
 * @function
 * @param {object} $elements jquery object containing the elements for which jsAPI events need to be send.
 */
export function tbRedditEvent ($elements) {
    // $elements can also be a parent container, so we find our things first.
    const $tbThings = $elements.find('.tb-thing');
    $tbThings.each(function () {
        viewportObserver.observe(this);
    });
}

/**
 * Will build a submission entry given a reddit API submission object.
 * @function
 * @param {object} submission reddit API submission object.
 * @param {object} submissionOptions object denoting what needs to be included.
 * @returns {object} jquery object with the build submission.
 */
export function makeSubmissionEntry (submission, submissionOptions) {
    TBStorage.purifyObject(submission);
    // Misc
    const canModsubmission = submission.data.can_mod_post,

        // submission basis (author, body, time)
          submissionAuthor = submission.data.author,
          submissionSelfTextHTML = TBStorage.purify(submission.data.selftext_html), // html string
          submissionCreatedUTC = submission.data.created_utc, // unix epoch
          submissionPermalink = TBCore.link(submission.data.permalink),
          submissionSubreddit = submission.data.subreddit,
          submissionSubredditType = submission.data.subreddit_type,
          submissionName = submission.data.name,
          submissionUrl = submission.data.is_self ? TBCore.link(submission.data.permalink) : submission.data.url,
          submissionTitle = submission.data.title,
          submissionThumbnail = submission.data.thumbnail,
          submissionDomain = submission.data.domain,

        // submission details
          submissionScore = submission.data.score, // integer
          submissionLikes = submission.data.likes, // boolean or null
          submissionIsSelf = submission.data.is_self,
          submissionEdited = submission.data.edited,
          submissionGildings = submission.data.gildings,
          submissionPinned = submission.data.pinned,
          submissionLocked = submission.data.locked,
          submissionOver18 = submission.data.over_18,
          submissionNumComments = submission.data.num_comments,
          submissionUserReports = submission.data.user_reports, // array with reports by users

        // submission details - mod related
          submissionDistinguished = submission.data.distinguished, // string containing "moderator" or "admin"
          submissionModReports = submission.data.mod_reports, // array with reports by mods

        // Author details
          submissionIsSubmitter = submission.data.is_submitter, // boolean - is OP

        // submission status - mod action
          submissionApproved = submission.data.approved, // boolean
          submissionApprovedAtUTC = submission.data.approved_at_utc, // unix epoch
          submissionApprovedBy = submission.data.approved_by, // unix epoch
          submissionSpam = submission.data.spam, // boolean
          submissionRemoved = submission.data.removed, // boolean
          submissionBannedAtUTC = submission.data.banned_at_utc, // unix epoch
          submissionBannedBy = submission.data.banned_by, // Mod that removed the submission
          submissionIgnoreReports = submission.data.ignore_reports, // boolean
          submissionBanNote = submission.data.ban_note;

    // Format the submission datetime nicely
    const submissionReadableCreatedUTC = TBHelpers.timeConverterRead(submissionCreatedUTC),
          createdTimeAgo = new Date(submissionCreatedUTC * 1000).toISOString();

    // vote status
    let voteState = 'neutral';
    if (submissionLikes !== null && !submissionLikes) {
        voteState = 'disliked';
    } else if (submissionLikes) {
        voteState = 'liked';
    }
    // Let's figure out what the current state is of the submission (approved, removed, spammed or neutral)
    let submissionStatus,
        submissionStatusUTC,
        submissionStatusReadableUTC,
        submissionStatusBy,
        submissionActionByOn;

    if (submissionSpam) {
        submissionStatus = 'spammed';
        submissionStatusUTC = submissionBannedAtUTC;
        submissionStatusReadableUTC = TBHelpers.timeConverterRead(submissionStatusUTC);
        submissionStatusBy = submissionBannedBy;
        submissionActionByOn = `by ${submissionStatusBy} on ${submissionStatusReadableUTC}`;
    } else if (submissionRemoved) {
        submissionStatus = 'removed';
        submissionStatusUTC = submissionBannedAtUTC;
        submissionStatusReadableUTC = TBHelpers.timeConverterRead(submissionStatusUTC);
        submissionStatusBy = submissionBannedBy;
        submissionActionByOn = `by ${submissionStatusBy} on ${submissionStatusReadableUTC}`;
    } else if (submissionApproved) {
        submissionStatus = 'approved';
        submissionStatusUTC = submissionApprovedAtUTC;
        submissionStatusReadableUTC = TBHelpers.timeConverterRead(submissionStatusUTC);
        submissionStatusBy = submissionApprovedBy;
        submissionActionByOn = `by ${submissionStatusBy} on ${submissionStatusReadableUTC}`;
    } else if (submissionBanNote && !submissionSpam && !submissionRemoved && !submissionApproved) {
        submissionStatus = 'removed';
        submissionStatusUTC = submissionBannedAtUTC;
        submissionStatusReadableUTC = TBHelpers.timeConverterRead(submissionStatusUTC);
        submissionStatusBy = submissionBannedBy;
        submissionActionByOn = `${submissionStatusBy ? `by ${submissionStatusBy}` : ''} on ${submissionStatusReadableUTC} [${submissionBanNote}]`;
    } else {
        submissionStatus = 'neutral';
    }

    // Let's figure out what sort of attributes we need to give the OP if any.
    let authorStatus = 'tb-regular';
    const authorAttributes = [];
    if (submissionIsSubmitter) {
        authorStatus = 'tb-submitter';
        authorAttributes.push(`<a class="tb-submitter" title="submitter" href="${submissionPermalink}">S</a>`);
    }
    if (submissionDistinguished) {
        authorStatus = `tb-${submissionDistinguished}`;
        if (submissionDistinguished === 'admin') {
            authorAttributes.push('<span class="tb-admin" title="reddit admin, speaking officially">A</span>');
        } else if (submissionDistinguished === 'moderator') {
            authorAttributes.push(`<a class="tb-moderator" title="moderator of /r/${submissionSubreddit}, speaking officially" href="${TBCore.link(`/r/${submissionSubreddit}/about/moderators`)}">M</a>`);
        } else {
            authorAttributes.push(`<a class="tb-unknown" title="Unknown distinguish type ${submissionDistinguished}">${submissionDistinguished}</a>`);
        }
    }

    let commentsButtonText = 'comment';
    if (submissionNumComments === 1) {
        commentsButtonText = '1 comment';
    } else if (submissionNumComments > 1) {
        commentsButtonText = `${submissionNumComments} comments`;
    }

    // Indicate if a submission has been edited or not.
    let editedHtml;
    if (submissionEdited) {
        const submissionReadableEdited = TBHelpers.timeConverterRead(submissionEdited),
              editedTimeAgo = new Date(submissionEdited * 1000).toISOString();
        editedHtml = `<span class="tb-submission-edited">*last edited <time title="${submissionReadableEdited}" datetime="${editedTimeAgo}" class="tb-live-timestamp timeago">${editedTimeAgo}</time></span>`;
    }

    const $buildsubmission = $(`
            <div class="tb-submission tb-thing ${submissionStatus} ${submissionPinned ? 'pinned' : ''}" data-submission-author="${submissionAuthor}" data-fullname="${submissionName}" data-post-id="${submissionName}" data-subreddit="${submissionSubreddit}" data-subreddit-type="${submissionSubredditType}">
                <div class="tb-submission-score ${voteState}">${submissionScore}</div>
                <a class="tb-submission-thumbnail ${submissionOver18 ? 'nsfw' : ''}" href="${submissionUrl}">
                    ${submissionThumbnail.startsWith('http') ? `<img src="${submissionThumbnail}" width="70">` : `<div class="tb-noImage-thumbnail">${submissionThumbnail}</div>`}
                </a>
                <div class="tb-submission-entry">
                    <div class="tb-submission-title">
                        <a class="tb-title" href="${submissionUrl}">${submissionTitle}</a>
                        <span class="tb-domain">
                            (<a href="${TBCore.link(`/domain/${submissionDomain}`)}">${submissionDomain}</a>)
                        </span>
                    </div>
                    ${submissionIsSelf && submissionSelfTextHTML ? `<div class="tb-self-expando-button"><i class="tb-icons">${icons.add}</i></div>` : ''}
                    <div class="tb-tagline">
                        submitted <time title="${submissionReadableCreatedUTC}" datetime="${createdTimeAgo}" class="tb-live-timestamp timeago">${createdTimeAgo}</time>
                        ${submissionEdited ? editedHtml : ''}
                        by ${submissionAuthor === '[deleted]' ? `
                            <span>[deleted]</span>
                        ` : `
                            <a href="${TBCore.link(`/user/${submissionAuthor}`)}" class="tb-submission-author ${authorStatus}">${submissionAuthor}</a>
                        `}
                        <span class="tb-userattrs">${authorAttributes}</span>
                        <span class="tb-jsapi-author-container"></span>
                        to <a href="${TBCore.link(`/r/${submissionSubreddit}`)}">/r/${submissionSubreddit}</a>
                        ${submissionPinned ? '- <span class="tb-pinned-tagline" title="pinned to this user\'s profile">pinned</span>' : ''}
                        ${submissionGildings.gid_1 ? `- <span class="tb-award-silver">silver x${submissionGildings.gid_1}</span>` : ''}
                        ${submissionGildings.gid_2 ? `- <span class="tb-award-gold">gold x${submissionGildings.gid_2}</span>` : ''}
                        ${submissionGildings.gid_3 ? `- <span class="tb-award-platinum">platinum x${submissionGildings.gid_3}</span>` : ''}
                    </div>
                    <div class="tb-submission-buttons">
                        <a class="tb-submission-button tb-submission-button-comments" href="${submissionPermalink}">${commentsButtonText}</a>
                    </div>
                    ${submissionIsSelf && submissionSelfTextHTML ? `
                    <div class="tb-self-expando">
                        ${submissionSelfTextHTML}
                    </div>
                    ` : ''}
                    <div class="tb-jsapi-submission-container"></div>
                </div>
            </div>
            `);

    // Now that we have the basic submission build we can go and add details where needed.
    // The two places where we will be adding data specific to the submission are either entry or the button list.
    const $submissionEntry = $buildsubmission.find('.tb-submission-entry');
    const $submissionButtonList = $buildsubmission.find('.tb-submission-buttons');

    if (submissionStatus !== 'neutral') {
        $submissionEntry.append(`
            <div class="tb-submission-data">
                <ul class="tb-submission-details">
                    <li class="tb-status-${submissionStatus}">${submissionStatus} ${submissionActionByOn ? submissionActionByOn : ''}.</li>
                    </ul>
            </div>`);
    }

    // Let's see if we need to add reports starting with user reports
    if (submissionUserReports.length && !submissionIgnoreReports) {
        const $submissionUserReports = $(`
            <ul class="tb-user-reports">
                <li>user reports</li>
            </ul>
            `);

        submissionUserReports.forEach(report => {
            const userReport = `
                <li class="tb-user-report">
                    <strong>
                        ${report[1]} :
                    </strong>
                    ${report[0]}
                </li>
                `;
            $submissionUserReports.append(userReport);
        });
        $submissionEntry.append($submissionUserReports);
    } else if (submissionIgnoreReports) {
        const $submissionIgnoredReports = $(`
            <span class="tb-ignored-user-reports">
                reports ignored (${submissionUserReports.length})
            </span>
            `);
        $submissionEntry.append($submissionIgnoredReports);
    }

    // Now we do the same for mod reports.
    // Not sure how ignoring reports works in this context so better to be safe than sorry and just show them.
    if (submissionModReports.length) {
        const $submissionModReports = $(`
                <ul class="tb-user-reports">
                    <li>mod reports</li>
                </ul>
            `);

        submissionModReports.forEach(report => {
            const modReport = `
                    <li class="tb-mod-report">
                        <strong>
                            ${report[1]} :
                        </strong>
                        ${report[0]}
                    </li>
                `;
            $submissionModReports.append(modReport);
        });
        $submissionEntry.append($submissionModReports);
    }

    if (submissionOver18) {
        $('<span class="tb-nsfw-stamp tb-stamp"><acronym title="Adult content: Not Safe For Work">NSFW</acronym></span>').prependTo($submissionButtonList);
    }

    // Now add mod action buttons if applicable.
    if (canModsubmission) {
        if (submissionStatus === 'removed' || submissionStatus === 'spammed' || submissionStatus === 'neutral') {
            $(`<a class="tb-submission-button tb-submission-button-approve" data-fullname="${submissionName}" href="javascript:void(0)">approve</a>`).appendTo($submissionButtonList);
        }

        if (submissionStatus === 'approved' || submissionStatus === 'neutral') {
            $(`<a class="tb-submission-button tb-submission-button-spam" data-fullname="${submissionName}" href="javascript:void(0)">spam</a>
                <a class="tb-submission-button tb-submission-button-remove" data-fullname="${submissionName}" href="javascript:void(0)">remove</a>`).appendTo($submissionButtonList);
        }

        if (submissionLocked) {
            $(`<a class="tb-submission-button tb-submission-button-unlock" data-fullname="${submissionName}" href="javascript:void(0)">unlock</a>`).appendTo($submissionButtonList);
        } else {
            $(`<a class="tb-submission-button tb-submission-button-lock" data-fullname="${submissionName}" href="javascript:void(0)">lock</a>`).appendTo($submissionButtonList);
        }

        if (submissionOver18) {
            $(`<a class="tb-submission-button tb-submission-button-unnsfw" data-fullname="${submissionName}" href="javascript:void(0)">un-nsfw</a>`).appendTo($submissionButtonList);
        } else {
            $(`<a class="tb-submission-button tb-submission-button-nsfw" data-fullname="${submissionName}" href="javascript:void(0)">nsfw</a>`).appendTo($submissionButtonList);
        }

        if (submissionStatus === 'removed' || submissionStatus === 'spammed') {
            browser.runtime.sendMessage({
                action: 'tb-modqueue',
                subreddit: submissionSubreddit,
                thingName: submissionName,
                thingTimestamp: submissionCreatedUTC,
            }).then(result => {
                if (result) {
                    $(`<a class="tb-submission-button tb-submission-button-spam" data-fullname="${submissionName}" href="javascript:void(0)">spam</a>
                        <a class="tb-submission-button tb-submission-button-remove" data-fullname="${submissionName}" href="javascript:void(0)">remove</a>`).appendTo($submissionButtonList);
                    $buildsubmission.addClass('filtered');
                }
            });
        }
    }
    $buildsubmission.find('p').addClass('tb-comment-p');
    if (submissionOptions && submissionOptions.subredditColor) {
        const subColor = TBHelpers.stringToColor(submissionSubreddit + subredditColorSalt);
        $buildsubmission.css('border-left', `solid 3px ${subColor}`);
    }

    return $buildsubmission;
}

/**
 * Will build a comment given a reddit API comment object.
 * @function
 * @param {object} comment reddit API comment object.
 * @param {object} commentOptions object denoting what needs to be included.
 * Object can contain 'parentLink', 'contextLink' and 'fullCommentsLink' as boolean.
 * @returns {object} jquery object with the build comment.
 */
export function makeSingleComment (comment, commentOptions = {}) {
    TBStorage.purifyObject(comment);
    // Misc
    const canModComment = comment.data.can_mod_post,

        // Comment basis (author, body, time)
          commentAuthor = comment.data.author,
          commentBodyHTML = TBStorage.purify(comment.data.body_html), // html string
        // commentMarkdownBody = comment.data.body, // markdown string
        // commentCreated = comment.data.created, // unix epoch
          commentCreatedUTC = comment.data.created_utc, // unix epoch
          commentDepth = commentOptions.commentDepthPlus ? comment.data.depth + 1 : comment.data.depth, // integer
          commentLinkId = comment.data.link_id, // parent submission ID
        // commentId = comment.data.id, // comment ID
          commentName = comment.data.name, // fullname t1_<comment ID>
          commentParentId = comment.data.parent_id,
          commentPermalink = TBCore.link(comment.data.permalink),
          commentSubreddit = comment.data.subreddit,
        // commentSubredditNamePrefixed = comment.data.subreddit_name_prefixed,
          commentSubredditType = comment.data.subreddit_type,
        // commentReplies = comment.data.replies, // object with replies

        // Comment details
        // commentScoreHidden = comment.data.score_hidden, // boolean
          commentScore = comment.data.score, // integer
          commentControversiality = comment.data.controversiality, // integer
          commentEdited = comment.data.edited,
          commentGildings = comment.data.gildings,
        // commentNumReports = comment.data.num_reports,
          commentUserReports = comment.data.user_reports, // array with reports by users

        // Comment details - mod related
          commentStickied = comment.data.stickied, // boolean
          commentDistinguished = comment.data.distinguished, // string containing "moderator" or "admin"
          commentModReports = comment.data.mod_reports, // array with reports by mods

        // Author details
          commentAuthorFlairCssClass = comment.data.author_flair_css_class,
          commentAuthorFlairText = comment.data.author_flair_text,
          commentIsSubmitter = comment.data.is_submitter, // boolean - is OP

        // Comment status - mod action
          commentApproved = comment.data.approved, // boolean
          commentApprovedAtUTC = comment.data.approved_at_utc, // unix epoch
          commentApprovedBy = comment.data.approved_by, // unix epoch
          commentSpam = comment.data.spam, // boolean
          commentRemoved = comment.data.removed, // boolean
          commentBannedAtUTC = comment.data.banned_at_utc, // unix epoch
          commentBannedBy = comment.data.banned_by, // Mod that removed the comment
          commentIgnoreReports = comment.data.ignore_reports, // boolean

        // Comment status - other
        // commentArchived = comment.data.archived,
        // commentCollapsed = comment.data.collapsed,
        // commentCollapsedReason = comment.data.collapsed_reason,
          commentBanNote = comment.data.ban_note;

    // Do we have overview data?
    let parentHtml;
    if (commentOptions.overviewData) {
        // `link_url` is the url to the linked content so can be anything for link posts.
        // For self posts reddit's api returns the full url including the subdomain the api request is done on.
        // As toolbox uses `old.reddit.com` for api calls this causes issues if we don't adjust for that.
        // One edge case we can't deal with is posts linking specifically to some parts of reddit on the `old` subdomain.
        let linkUrl = comment.data.link_url;
        if (comment.data.link_url.startsWith('https://old.reddit.com')) {
            // Rewrite url to be relative.
            linkUrl = linkUrl.replace('https://old.reddit.com', '');
            // Pass to `TBCore.link` to neatly deal with it.
            linkUrl = TBCore.link(linkUrl);
        }

        const linkTitle = comment.data.link_title,
              linkAuthor = comment.data.link_author;

        parentHtml = `
            <div class="tb-parent">
                <a class="tb-link-title" href="${linkUrl}">${linkTitle}</a>
                by ${linkAuthor === '[deleted]' ? `
                    <span>[deleted]</span>
                ` : `
                    <a class="tb-link-author" href="${TBCore.link(`/user/${linkAuthor}`)}">${linkAuthor}</a>
                `} in <a class="subreddit hover" href="${TBCore.link(`/r/${commentSubreddit}/`)}">${commentSubreddit}</a>
            </div>
            `;
    }

    // Format the comment datetime nicely
    const commentReadableCreatedUTC = TBHelpers.timeConverterRead(commentCreatedUTC),
          createdTimeAgo = new Date(commentCreatedUTC * 1000).toISOString();

    // If we want the permalink of the parent thread we simply remove the comment id from the comment permalink..
    const commentThreadPermalink = TBHelpers.removeLastDirectoryPartOf(commentPermalink);

    // Build a parentlink
    // Also determine if we are dealing with a top level comment.
    // let commentIsTopLevel = false;
    const commentParentKind = commentParentId.substring(0, 2);
    let commentParentLink;
    if (commentParentKind === 't1') {
        commentParentLink = commentThreadPermalink + commentParentId.substring(3);
        // commentIsTopLevel = true;
    } else {
        commentParentLink = commentThreadPermalink;
    }

    // Let's figure out what the current state is of the comment (approved, removed, spammed or neutral)
    let commentStatus,
        commentStatusUTC,
        commentStatusReadableUTC,
        commentStatusBy,
        commentActionByOn;

    if (commentSpam) {
        commentStatus = 'spammed';
        commentStatusUTC = commentBannedAtUTC;
        commentStatusReadableUTC = TBHelpers.timeConverterRead(commentStatusUTC);
        commentStatusBy = commentBannedBy;
        commentActionByOn = `by ${commentStatusBy} on ${commentStatusReadableUTC}`;
    } else if (commentRemoved) {
        commentStatus = 'removed';
        commentStatusUTC = commentBannedAtUTC;
        commentStatusReadableUTC = TBHelpers.timeConverterRead(commentStatusUTC);
        commentStatusBy = commentBannedBy;
        commentActionByOn = `by ${commentStatusBy} on ${commentStatusReadableUTC}`;
    } else if (commentApproved) {
        commentStatus = 'approved';
        commentStatusUTC = commentApprovedAtUTC;
        commentStatusReadableUTC = TBHelpers.timeConverterRead(commentStatusUTC);
        commentStatusBy = commentApprovedBy;
        commentActionByOn = `by ${commentStatusBy} on ${commentStatusReadableUTC}`;
    } else if (commentBanNote && !commentRemoved && !commentSpam && !commentApproved) {
        commentStatus = 'removed';
        commentStatusUTC = commentBannedAtUTC;
        commentStatusReadableUTC = TBHelpers.timeConverterRead(commentStatusUTC);
        commentStatusBy = commentBannedBy;
        commentActionByOn = `${commentStatusBy ? `by ${commentStatusBy}` : ''}  on ${commentStatusReadableUTC} [${commentBanNote}]`;
    } else {
        commentStatus = 'neutral';
    }

    // Let's figure out what sort of attributes we need to give the OP if any.
    let authorStatus = 'tb-regular';
    const authorAttributes = [];
    if (commentIsSubmitter) {
        authorStatus = 'tb-submitter';
        authorAttributes.push(`<a class="tb-submitter" title="submitter" href="${commentThreadPermalink}">S</a>`);
    }
    if (commentDistinguished) {
        authorStatus = `tb-${commentDistinguished}`;
        if (commentDistinguished === 'admin') {
            authorAttributes.push('<span class="tb-admin" title="reddit admin, speaking officially">A</span>');
        } else if (commentDistinguished === 'moderator') {
            authorAttributes.push(`<a class="tb-moderator" title="moderator of /r/${commentSubreddit}, speaking officially" href="${TBCore.link(`/r/${commentSubreddit}/about/moderators`)}">M</a>`);
        } else {
            authorAttributes.push(`<a class="tb-unknown" title="Unknown distinguish type ${commentDistinguished}">${commentDistinguished}</a>`);
        }
    }

    // Nicely format if we are talking about point or points
    let commentScoreText;
    if (commentScore > 1 || commentScore < -1) {
        commentScoreText = `${commentScore} points`;
    } else {
        commentScoreText = `${commentScore} point`;
    }

    // Indicate if a comment has been edited or not.
    let editedHtml;
    if (commentEdited) {
        const commentReadableEdited = TBHelpers.timeConverterRead(commentEdited),
              editedTimeAgo = new Date(commentEdited * 1000).toISOString();
        editedHtml = `<span class="tb-comment-edited">*last edited <time title="${commentReadableEdited}" datetime="${editedTimeAgo}" class="tb-live-timestamp timeago">${editedTimeAgo}</time></span>`;
    }

    let commentDepthClass;

    if (commentOptions.noOddEven) {
        commentDepthClass = commentDepth;
    } else {
        commentDepthClass = commentDepth % 2 ? 'odd' : 'even';
    }

    const commentOptionsJSON = TBHelpers.escapeHTML(JSON.stringify(commentOptions));
    // Let's start building our comment.
    const $buildComment = $(`
            <div class="tb-thing tb-comment tb-comment-${commentDepthClass}" data-thread-permalink="${commentThreadPermalink}" data-comment-options="${commentOptionsJSON}" data-subreddit="${commentSubreddit}" data-subreddit-type="${commentSubredditType}"  data-comment-id="${commentName}" data-fullname="${commentName}" data-comment-author="${commentAuthor}" data-comment-post-id="${commentLinkId}" >
                <div class="tb-comment-entry ${commentStatus} ${commentStickied ? 'tb-stickied' : ''} ${commentAuthorFlairCssClass ? `tb-user-flair-${commentAuthorFlairCssClass}` : ''}">
                    ${commentOptions.overviewData ? parentHtml : ''}
                    <div class="tb-tagline">
                        <a class="tb-comment-toggle" href="javascript:void(0)">[–]</a>
                        ${commentAuthor === '[deleted]' ? `
                            <span>[deleted]</span>
                        ` : `
                            <a class="tb-comment-author ${authorStatus}" href="${TBCore.link(`/user/${commentAuthor}`)}">${commentAuthor}</a>
                        `}
                        ${commentAuthorFlairText ? `<span class="tb-comment-flair ${commentAuthorFlairCssClass}" title="${commentAuthorFlairText}">${commentAuthorFlairText}</span>` : ''}
                        ${authorAttributes.length ? `<span class="tb-userattrs">[${authorAttributes.join(' ')}]</span>` : ''}
                        <span class="tb-jsapi-author-container"></span>
                        <span class="tb-comment-score ${commentControversiality ? 'tb-iscontroversial' : ''}" title="${commentScore}">${commentScoreText}</span>
                        <time title="${commentReadableCreatedUTC}" datetime="${createdTimeAgo}" class="tb-live-timestamp timeago">${createdTimeAgo}</time>
                        ${commentEdited ? editedHtml : ''}
                        ${commentStickied ? '<span class="tb-comment-stickied">stickied</span>' : ''}
                        ${commentGildings.gid_1 ? `<span class="tb-award-silver">silver x${commentGildings.gid_1}</span>` : ''}
                        ${commentGildings.gid_2 ? `<span class="tb-award-gold">gold x${commentGildings.gid_2}</span>` : ''}
                        ${commentGildings.gid_3 ? `<span class="tb-award-platinum">platinum x${commentGildings.gid_3}</span>` : ''}
                    </div>
                    <div class="tb-comment-body">
                        ${commentBodyHTML}
                    </div>
                    <div class="tb-comment-buttons">
                            <a class="tb-comment-button tb-comment-button-permalink" href="${commentPermalink}">permalink</a>
                    </div>
                    <div class="tb-jsapi-comment-container"></div>
                </div>
            </div>
        `);

    // Now that we have the basic comment build we can go and add details where needed.
    // The two places where we will be adding data specific to the comment are either entry or the button list.
    const $commentEntry = $buildComment.find('.tb-comment-entry');
    const $commentButtonList = $buildComment.find('.tb-comment-buttons');

    // Add some data that is otherwise hidden.
    const $commentData = $(`
        <div class="tb-comment-data">
            <ul class="tb-comment-details">
                ${commentControversiality ? `<li> Controversial score: ${commentControversiality}.</li>` : ''}
             </ul>
        </div>`);
    if (commentStatus !== 'neutral') {
        $commentData.find('.tb-comment-details').append(`<li class="tb-status-${commentStatus}">${commentStatus} ${commentActionByOn ? commentActionByOn : ''}.</li>`);
    }

    if ($commentData.find('li').length) {
        $commentEntry.append($commentData);
    }

    // Let's see if we need to add reports starting with user reports
    if (commentUserReports.length && !commentIgnoreReports) {
        $commentEntry.addClass('filtered');
        const $commentUserReports = $(`
            <ul class="tb-user-reports">
                <li>user reports</li>
            </ul>
            `);

        commentUserReports.forEach(report => {
            const userReport = `
                <li class="tb-comment-user-report">
                    <strong>
                        ${report[1]} :
                    </strong>
                    ${report[0]}
                </li>
                `;
            $commentUserReports.append(userReport);
        });
        $commentEntry.append($commentUserReports);
    } else if (commentIgnoreReports) {
        const $commentIgnoredReports = $(`
            <span class="tb-ignored-user-reports">
                reports ignored (${commentUserReports.length})
            </span>
            `);
        $commentEntry.append($commentIgnoredReports);
    }

    // Now we do the same for mod reports.
    // Not sure how ignoring reports works in this context so better to be safe than sorry and just show them.
    if (commentModReports.length) {
        $commentEntry.addClass('filtered');
        const $commentModReports = $(`
                <ul class="tb-user-reports">
                    <li>mod reports</li>
                </ul>
            `);

        commentModReports.forEach(report => {
            const modReport = `
                    <li class="tb-mod-report">
                        <strong>
                            ${report[1]} :
                        </strong>
                        ${report[0]}
                    </li>
                `;
            $commentModReports.append(modReport);
        });
        $commentEntry.append($commentModReports);
    }

    // Now we move on to the buttons. Starting with the more general buttons depending on what the options tell us.
    if (commentOptions.parentLink) {
        const $parentLink = $(`<a class="tb-comment-button tb-comment-button-parent" href="${commentParentLink}">parent</a>`);
        $commentButtonList.append($parentLink);
    }

    if (commentOptions.contextLink) {
        const $contextLink = $(`<a class="tb-comment-button tb-comment-button-context" href="${commentPermalink}?context=3">context</a>`);
        $commentButtonList.append($contextLink);
    }

    if (commentOptions.contextPopup) {
        const $contextLink = $(`<a class="tb-comment-button tb-comment-context-popup" href="javascript:;" data-comment-id="${commentName}" data-context-json-url="${commentPermalink}.json?context=3">context-popup</a>`);
        $commentButtonList.append($contextLink);
    }

    if (commentOptions.fullCommentsLink) {
        const $fullCommentsLink = $(`<a class="tb-comment-button tb-comment-button-fullcomments" href="${commentThreadPermalink}">full comments</a>`);
        $commentButtonList.append($fullCommentsLink);
    }

    // Now add mod action buttons if applicable.
    if (canModComment) {
        if (commentStatus === 'approved' || commentStatus === 'neutral') {
            $(`<a class="tb-comment-button tb-comment-button-spam" data-fullname="${commentName}" href="javascript:void(0)">spam</a>
                <a class="tb-comment-button tb-comment-button-remove" data-fullname="${commentName}" href="javascript:void(0)">remove</a>`).appendTo($commentButtonList);
        }

        if (commentStatus === 'removed' || commentStatus === 'spammed' || commentStatus === 'neutral') {
            $(`<a class="tb-comment-button tb-comment-button-approve" data-fullname="${commentName}" href="javascript:void(0)">approve</a>`).appendTo($commentButtonList);
        }

        if (commentStatus === 'removed' || commentStatus === 'spammed') {
            browser.runtime.sendMessage({
                action: 'tb-modqueue',
                subreddit: commentSubreddit,
                thingName: commentName,
                thingTimestamp: commentCreatedUTC,
            }).then(result => {
                if (result) {
                    $(`<a class="tb-comment-button tb-comment-button-spam" data-fullname="${commentName}" href="javascript:void(0)">spam</a>
                        <a class="tb-comment-button tb-comment-button-remove" data-fullname="${commentName}" href="javascript:void(0)">remove</a>`).appendTo($commentButtonList);
                    $commentEntry.addClass('filtered');
                }
            });
        }
    }
    $buildComment.find('p').addClass('tb-comment-p');

    if (commentOptions.subredditColor) {
        const subColor = TBHelpers.stringToColor(commentSubreddit + subredditColorSalt);
        $buildComment.css('border-left', `solid 3px ${subColor}`);
    }

    return $buildComment;
}

/**
 * Will build a comment given a reddit API comment object.
 * @function
 * @param {object} jsonInput reddit API comments object.
 * @param {object} commentOptions object denoting what needs to included.
 * Object can contain 'parentLink', 'contextLink' and 'fullCommentsLink' as
 * boolean.
 * @returns {object} jquery object with the build comment thread.
 */
export function makeCommentThread (jsonInput, commentOptions) {
    const $commentContainer = $('<div class="tb-comment-children"></div>');

    jsonInput.forEach(comment => {
        let $childComments;

        if (comment.kind === 't1') {
            const $comment = makeSingleComment(comment, commentOptions);
            if (comment.data.replies) {
                $childComments = makeCommentThread(comment.data.replies.data.children, commentOptions);
                $comment.append($childComments);
            }
            $commentContainer.append($comment);
        } else if (comment.kind === 'more') {
            const count = comment.data.count;
            const commentIDs = comment.data.children.toString();

            $commentContainer.append(`<span class="tb-more-comments"><a class="tb-load-more-comments" data-ids="${commentIDs}" href="javascript:void(0)">load more comments</a> (${count} replies)</span>`);
        }
    });

    return $commentContainer;
}

/**
 * Creates a jQuery element that dynamically displays paginated content.
 * @param {object} options Options for the pager
 * @param {number} options.pageCount The number of pages to present
 * @param {string} options.controlPosition Where to display the pager's
 * controls, either 'top' or 'bottom'
 * @param {TBui~pagerCallback} contentFunction A function which generates
 * content for a given page
 * @returns {jQuery}
 */
// TODO: optionally support caching calls to the content function to avoid wasting time regenerating identical pages
export function pager ({pageCount, controlPosition = 'top'}, contentFunction) {
    // Create elements for the content view and the pagination controls
    const $pagerContent = $('<div class="tb-pager-content"/>');
    const $pagerControls = $('<div class="tb-pager-controls"/>');

    // An array of all the button elements that could be displayed, one for each page
    const buttons = [];

    // A function that refreshes the displayed buttons based on the selected page
    function loadPage (pageIndex) {
        // If we have more than 10 pages, refresh the buttons that are being actively displayed
        if (pageCount > 10) {
            // Empty the existing buttons out, using .detach to maintain event listeners, then using .empty() to
            // remove the text left behind (thanks jQuery)
            $pagerControls.children().detach();
            $pagerControls.empty();

            // Add the buttons in the center
            const leftBound = Math.max(pageIndex - 4, 0);
            const rightBound = Math.min(pageIndex + 4, pageCount - 1);
            for (let buttonIndex = leftBound; buttonIndex <= rightBound; buttonIndex += 1) {
                $pagerControls.append(buttons[buttonIndex]);
            }

            // Add the first and last page buttons, along with "..." between them and the other buttons if there's
            // distance between them
            if (leftBound > 1) {
                $pagerControls.prepend('...');
            }
            if (leftBound > 0) {
                $pagerControls.prepend(buttons[0]);
            }
            if (rightBound < pageCount - 2) {
                $pagerControls.append('...');
            }
            if (rightBound < pageCount - 1) {
                $pagerControls.append(buttons[pageCount - 1]);
            }
        } else if ($pagerControls.children().length === 0) {
            // If we have less than 10 items, then we only need to refresh the buttons the first time they're loaded
            buttons.forEach($button => $pagerControls.append($button));
        }

        // Move selection to the correct button
        $pagerControls.children().toggleClass('tb-pager-control-active', false);
        buttons[pageIndex].toggleClass('tb-pager-control-active', true);

        // Generate and display content for the new page
        /**
         * @callback TBui~pagerCallback
         * @param {number} page The zero-indexed number of the page to generate
         * @returns {string | jQuery} The content of the page
         */
        $pagerContent.empty().append(contentFunction(pageIndex));
    }

    // Create all the buttons
    for (let page = 0; page < pageCount; page += 1) {
        // Create the button, translating 0-indexed to 1-indexed pages fur human eyes
        const $button = $(button(page + 1, 'tb-pager-control'));

        // When the button is clicked, go to the correct page
        $button.on('click', () => {
            logger.info(jQuery._data(buttons[0], 'events'));
            logger.info(jQuery._data(buttons[0][0], 'events'));
            // Update the button display
            loadPage(page);
        });

        // Add to the array
        buttons.push($button);
    }

    // Construct the pager itself
    const $pager = $('<div class="tb-pager"/>');
    $pager.append($pagerContent);
    if (controlPosition === 'top') {
        $pager.prepend($pagerControls);
    } else if (controlPosition === 'bottom') {
        $pager.append($pagerControls);
    } else {
        throw new TypeError('Invalid controlPosition');
    }

    // Preload the content for the first page
    loadPage(0);

    return $pager;
}

/**
 * Creates a pager over a dataset.
 * @param {object} options
 * @param {any[]} items The items to display in the pager
 * @param {number} perPage The number of items to display on each page
 * @param {TBui~pagerForItemsCallback} displayItem A function that generates
 * content for each individual item in the dataset
 * @param {string} controlPosition Where to display the pager's controls,
 * either 'top' or 'bottom'
 * @returns {jQuery}
 */
export function pagerForItems ({
    items,
    perPage,
    displayItem,
    controlPosition,
}) {
    return pager({
        controlPosition,
        pageCount: Math.ceil(items.length / perPage),
    }, page => {
        const $wrapper = $('<div>');
        const start = page * perPage;
        const end = (page + 1) * perPage;
        for (let i = start; i < end && i < items.length; i += 1) {
            $wrapper.append(displayItem(items[i], i));
        }
        return $wrapper;
    });
}

// handling of comment & submisstion actions.
// TODO make this into command pattern
$body.on('click', '.tb-comment-button-approve, .tb-submission-button-approve,  .tb-thing-button-approve', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.approveThing(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">approved</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-comment-button-remove, .tb-submission-button-remove, .tb-thing-button-remove', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.removeThing(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">removed</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-comment-button-spam, .tb-submission-button-spam, .tb-thing-button-spam', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.removeThing(fullname, true).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">spammed</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-submission-button-lock', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.lock(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">locked</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-submission-button-unlock', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.unlock(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">unlocked</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-submission-button-nsfw', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.markOver18(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">marked nsfw</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-submission-button-unsfw', function () {
    const $this = $(this);
    const fullname = $this.attr('data-fullname');
    TBApi.unMarkOver18(fullname).then(() => {
        $this.replaceWith('<span class="tb-actioned-button">unmarked nsfw</span>');
    }).catch(error => {
        $this.replaceWith(`<span class="tb-actioned-button tb-actioned-error">${error || 'something went wrong'}</span>`);
    });
});

$body.on('click', '.tb-comment-toggle', function () {
    const $this = $(this);
    const thisState = $this.text();
    const $comment = $this.closest('.tb-comment');
    $comment.find('.tb-comment-children').first().toggle();
    $comment.find('.tb-comment-body').first().toggle();
    $comment.find('.tb-comment-buttons').first().toggle();
    $comment.find('.tb-comment-details').first().toggle();

    if (thisState === '[–]') {
        $this.text('[+]');
    } else {
        $this.text('[–]');
    }
});

$body.on('click', '.tb-load-more-comments', function () {
    const $this = $(this);
    const $thisMoreComments = $this.closest('.tb-more-comments');
    const commentIDs = $this.attr('data-ids').split(',');
    const commentIDcount = commentIDs.length;
    const $thisComment = $this.closest('.tb-comment');
    const threadPermalink = $thisComment.attr('data-thread-permalink');
    const commentOptionsData = $thisComment.attr('data-comment-options');

    const commentOptions = JSON.parse(commentOptionsData);
    // This is to make sure comment coloring still is correct.
    commentOptions.commentDepthPlus = true;
    let processCount = 0;
    TB.ui.longLoadSpinner(true); // We are doing stuff, fire up the spinner that isn't a spinner!
    commentIDs.forEach(id => {
        const fetchUrl = `/${threadPermalink}${id}.json?limit=1500`;
        // Lets get the comments.
        TBApi.getJSON(fetchUrl, {raw_json: 1}).then(data => {
            TBStorage.purifyObject(data);
            const $comments = makeCommentThread(data[1].data.children, commentOptions);
            window.requestAnimationFrame(() => {
                $thisMoreComments.before($comments.html());
            });

            tbRedditEvent($comments);

            processCount += 1;
            if (processCount === commentIDcount) {
                $thisMoreComments.remove();
                $('time.timeago').timeago();
                TB.ui.longLoadSpinner(false);
            }
        });
    });
});

$body.on('click', '.tb-self-expando-button', function () {
    const $this = $(this);
    const thisState = $this.attr('data-state') || 'collapsed';
    const $selfText = $this.closest('.tb-submission').find('.tb-self-expando');
    $selfText.toggle();

    if (thisState === 'collapsed') {
        $this.html(`<i class="tb-icons">${icons.remove}</i>`);
        $this.attr('data-state', 'expanded');
    } else {
        $this.html(`<i class="tb-icons">${icons.add}</i>`);
        $this.attr('data-state', 'collapsed');
    }
});

// Utilities

export function getBestTextColor (bgColor) {
    if (!getBestTextColor.cache[bgColor]) {
        const textColors = ['black', 'white'];
        getBestTextColor.cache[bgColor] = tinycolor.mostReadable(bgColor, textColors).toHexString();
    }
    return getBestTextColor.cache[bgColor];
}
getBestTextColor.cache = {};

// Trigger a prompt if the user tries to close the tab while we're doing things
window.onbeforeunload = function () {
    if (longLoadArray.length > 0) {
        return 'toolbox is still busy!';
    }
};
