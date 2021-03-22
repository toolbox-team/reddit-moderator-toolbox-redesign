'use strict';

function modmatrix () {
    const self = new TB.Module('Mod Log Matrix');
    self.shortname = 'ModMatrix'; // backwards compatibility
    self.oldReddit = true;

    // //Default settings
    self.settings['enabled']['default'] = true;
    self.settings['betamode'] = false;

    self.version = 2.0;
    self.limit = 500;
    self.after = null;
    self.subredditUrl = null;
    self.subredditName = null;

    self.firstEntry = null;
    self.lastEntry = null;

    self.subredditModerators = null;
    self.subredditActions = null;
    self.total = 0;

    // These need moved into TB.ui.
    self.downSortingIcon = 'iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAQklEQVQoU2NkoAAwUqCXYVQziaGHLcD+4zEDRT2u0MZmAIZafFGFbABWdYTiGWQATjWENOMNQoo1M5EYQ3DlFNkMAOsiBBL3uxzDAAAAAElFTkSuQmCC';
    self.upSortingIcon = 'iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAAAQ0lEQVQoU2NkoAAwUqCXAaSZiVwDKLaZXIvBzsYH/gMlcarBpxmkEQawqsOlGVkjTgOwacamEasBhPyMN0BGNZOY1gDYfgQSUTVBXwAAAABJRU5ErkJggg==';

    self.run = function () {
        this.addButton();

        let subredditUrl = this.getSubredditUrl();
        if (subredditUrl.charAt(subredditUrl.length - 1) !== '/') {
            subredditUrl += '/';
        }
        this.subredditUrl = subredditUrl;

        const regex = /reddit\.com\/r\/([^/]+)\//g;
        const matches = regex.exec(subredditUrl);

        if (matches != null) {
            this.subredditName = matches[1];
        }

        if (location.hash != null && location.hash === '#matrix') {
            self.renderMatrix();
        }
    };

    self.addButton = function () {
        // The reason for the <span> is in case the user has both report matrix AND report gen: http://i.imgur.com/Izbm6Rh.png,
        // the reason the &nbsp; is before and after is becase we don't know which script will load first.  Not a great solution, but it works.
        $('.menuarea').append(`
<div class="spacer">
<a class="reddit-moderationlog tb-general-button" href="#matrix" >toggle moderation log matrix</a>&nbsp
</div>
`);

        $('.reddit-moderationlog').click(e => {
            e.preventDefault();
            self.renderMatrix();
            return false;
        });
    };

    self.currentSorting = {
        index: null,
        direction: 1,
    };

    self.sort = function (index, direction) {
        const rows = $('#mod-matrix tbody tr');

        direction = direction != null ? direction : index === this.currentSorting.index ? this.currentSorting.direction * -1 : index === 0 ? -1 : 1;

        const newArray = [];

        rows.each(function () {
            newArray.push(this);
        });

        function tdValue (td) {
            if (index === 0) {
                return $.text(td).toLowerCase();
            } else {
                return parseInt($.text(td));
            }
        }

        newArray.sort((a, b) => {
            const aValue = tdValue($(a).find('td').get(index));
            const bValue = tdValue($(b).find('td').get(index));

            if (aValue === bValue) {
                return 0;
            } else {
                return aValue > bValue ? direction * -1 : direction;
            }
        });

        this.currentSorting = {index, direction};
        $('#mod-matrix tbody').html('').append($(newArray));

        const header = $('#mod-matrix thead');
        header.find('.sorting-icon').remove();
        $(header.find('th').get(index)).append(`<img src="data:image/png;base64,${direction === -1 ? self.upSortingIcon : self.downSortingIcon}" alt="" class="sorting-icon" />`);
    };

    self.renderMatrix = function () {
        const siteTable = $('#siteTable');

        $('.drop-choices.lightdrop a').each(function () {
            $(this).attr('href', `${$(this).attr('href')}#matrix`);
        });

        this.resetData();

        let previousContent = siteTable.children();
        // Hide next/prev (if RES, not an issue).
        previousContent = previousContent.add('.content > .nextprev');
        previousContent.hide();

        const wrapper = $('<div></div>').attr('id', 'mod-matrix-wrapper');
        siteTable.append(wrapper);

        // Create table
        const matrix = $('<table></table>').addClass('generic-table mod-matrix').attr('id', 'mod-matrix');

        const header = $('<tr></tr>').wrap('<thead></thead>');
        header.append('<th></th>');
        const footer = $('<tr class="totals"></tr>').wrap('<tfoot></tfoot>');
        footer.append('<td>Total</td>');

        for (const subredditAction of Object.keys(this.subredditActions)) {
            header.append(`<th class="action-cell action-${subredditAction}"><a class="modactions ${subredditAction}" title="${this.subredditActions[subredditAction].title}"></a></th>`);
            footer.append(`<td class="action-cell action-${subredditAction}"><a target="_blank" title="Total ${this.subredditActions[subredditAction].title}" href="${this.subredditUrl}about/log?type=${subredditAction}" class="action-number">0</span></td>`);
        }
        header.append('<th>Total</th>');
        header.append('<th class="action-percentage">%</th>');
        footer.append('<td class="action-total"><span class="action-number">0</span></td>');
        footer.append('<td class="action-percentage"></td>');

        const body = $('<tbody></tbody>');

        header.parent().appendTo(matrix);
        footer.parent().appendTo(matrix);
        body.appendTo(matrix);
        wrapper.append(matrix);

        wrapper.append('<div id="mod-matrix-statistics"></div>');

        wrapper.append(`<div id="mod-matrix-settings"><form action="" method="GET">
<table><tr><td>between:</td><td><input type="date" name="from" /> and <input type="date" name="to" /></td></table>
</form></div>`);

        const modMatrixSettings = $('#mod-matrix-settings');

        $('.reddit-moderationlog').off('click').click(() => {
            self.getActions();
        });

        header.find('th').click(function () {
            self.sort($(this).index());
        });

        modMatrixSettings.find('form').on('submit', function (e) {
            e.preventDefault();
            self.submitForm(this);

            return false;
        });

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 6);
        const toDate = new Date();
        const minDate = new Date();
        minDate.setDate(toDate.getDate() - 90);

        modMatrixSettings.find('input[name=from]').val(fromDate.toJSON().slice(0, 10));
        // modMatrixSettings.find("input[name=from],#mod-matrix-settings input[name=to]").attr("min", minDate.toJSON().slice(0,10));
        modMatrixSettings.find('input[name=to]').val(toDate.toJSON().slice(0, 10));
        modMatrixSettings.find('input[name=from],#mod-matrix-settings input[name=to]').attr('max', toDate.toJSON().slice(0, 10));

        // Moderator filter
        const modFilterRow = $('<tr><td>moderators:</td></tr>');
        const modFilterCell = $('<div></div>').wrap('<td></td>').hide().attr('id', 'modfilter');
        modFilterCell.append('<div><input type="checkbox" value="" id="modmatrixmodfilter-all" checked="checked" /><label for="modmatrixmodfilter-all">All</label></div>');
        for (const moderator of Object.keys(this.subredditModerators)) {
            modFilterCell.append(`<div style="padding-left: 10px;"><input class="mod-filter" type="checkbox" value="${moderator}" id="modmatrixmodfilter-${moderator}" /><label for="modmatrixmodfilter-${moderator}">${moderator}</label></div>`);
        }
        modMatrixSettings.find('table').append(modFilterRow);
        const addButton = $('<a></a>').text('show moderator filter').insertBefore(modFilterCell);
        modFilterCell.parent().appendTo(modFilterRow);
        $('#modmatrixmodfilter-all').change(function () {
            if (this.checked) {
                $('#mod-matrix-settings .mod-filter').prop('checked', 'checked');
            } else {
                $('#mod-matrix-settings .mod-filter').removeAttr('checked');
            }
        });
        modFilterCell.find('.mod-filter').change(() => {
            if ($('#mod-matrix-settings .mod-filter:not(:checked)').length > 0) {
                $('#modmatrixmodfilter-all').removeAttr('checked');
            } else {
                $('#modmatrixmodfilter-all').prop('checked', 'checked');
            }
        });
        addButton.click(function () {
            if (modFilterCell.is(':hidden')) {
                modFilterCell.show();
                $(this).text('hide moderator filter');
            } else {
                modFilterCell.hide();
                $(this).text('show moderator filter');
            }
        });

        // Unless we're on /r/mod or a /m/ulti, we want to check the mod filters for _active_ mods. These do not include shadow banned and deleted users
        if (this.subredditName && this.subredditName !== 'mod' && !TBCore.isModLogPage) {
            const subredditNames = this.subredditName.split('+');

            for (let i = 0; i < subredditNames.length; i++) {
                TBApi.getJSON(`/r/${subredditNames[i]}/about/moderators.json`).then(moderatorData => {
                    TBStorage.purifyObject(moderatorData);
                    for (let j = 0; j < moderatorData.data.children.length; j++) {
                        $(`#modmatrixmodfilter-${moderatorData.data.children[j].name}`).prop('checked', 'checked');
                    }
                    if ($('#mod-matrix-settings .mod-filter:not(:checked)').length > 0) {
                        $('#modmatrixmodfilter-all').removeAttr('checked');
                    } else {
                        $('#modmatrixmodfilter-all').prop('checked', 'checked');
                    }
                });
            }
        }

        // Action filter
        const actionFilterRow = $('<tr><td>actions:</td></tr>');
        const actionFilterCell = $('<div></div>').wrap('<td></td>').hide();
        actionFilterCell.append('<div><input type="checkbox" value="" id="modmatrixactionfilter-all" checked="checked" /><label for="modmatrixactionfilter-all">All</label></div>');
        // I want these sorted alphabetically
        const actions = $.map(this.subredditActions, value => value);
        actions.sort((a, b) => {
            if (a.title === b.title) {
                return 0;
            } else if (a.title < b.title) {
                return -1;
            } else {
                return 1;
            }
        });
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            actionFilterCell.append(`<div style="padding-left: 10px;"><input class="action-filter" type="checkbox" value="${action.className}" id="modmatrixactionfilter-${action.className}" checked="checked" /><label for="modmatrixmodfilter-${action.className}">${action.title}</label></div>`);
        }
        modMatrixSettings.find('table').append(actionFilterRow);
        const addButton2 = $('<a></a>').text('show action filter').insertBefore(actionFilterCell);
        actionFilterCell.parent().appendTo(actionFilterRow);
        $('#modmatrixactionfilter-all').change(function () {
            if (this.checked) {
                $('#mod-matrix-settings .action-filter').prop('checked', 'checked');
            } else {
                $('#mod-matrix-settings .action-filter').removeAttr('checked');
            }
        });
        actionFilterCell.find('.action-filter').change(() => {
            if ($('#mod-matrix-settings .action-filter:not(:checked)').length > 0) {
                $('#modmatrixactionfilter-all').removeAttr('checked');
            } else {
                $('#modmatrixactionfilter-all').prop('checked', 'checked');
            }
        });
        addButton2.click(function () {
            if (actionFilterCell.is(':hidden')) {
                actionFilterCell.show();
                $(this).text('hide action filter');
            } else {
                actionFilterCell.hide();
                $(this).text('show action filter');
            }
        });

        // Automatic refresh the table when action filter is changed. Same thing with mod filter, as long as there are fewer than 20 mods
        modMatrixSettings.find(`.action-filter${modMatrixSettings.find('.mod-filter').length < 20 ? ', .mod-filter' : ''}`).change(() => {
            self.refreshTable();
        });

        // Show labels
        modMatrixSettings.find('table').append('<tr><td><label for="showlabels">show header labels:</label></td><td><input id="showlabels" type="checkbox" /></td></tr>');
        $('#showlabels').change(function () {
            $('#mod-matrix').toggleClass('labels', this.checked);
        });

        // Show percentages
        modMatrixSettings.find('table').append('<tr><td><label for="showpercentages">show percentages:</label></td><td><input id="showpercentages" type="checkbox" checked="checked" /></td></tr>');
        $('#showpercentages').change(function () {
            if (this.checked) {
                $('#mod-matrix .action-percentage').css('display', '');
                $('#highlightpercentages').parent().parent().css('display', '');
            } else {
                $('#mod-matrix .action-percentage').css('display', 'none');
                $('#highlightpercentages').parent().parent().css('display', 'none');
            }
        });

        // Highlight percentages
        modMatrixSettings.find('table').append('<tr><td><label for="highlightpercentages">highlight percentages below:</label></td><td><input id="highlightpercentages" type="number" value="0" min="0" max="100" /></td></tr>');
        $('#highlightpercentages').change(() => {
            self.highlightPercentages();
        });

        $('#mod-matrix-settings form').append('<input type="submit" value="generate" />');

        for (const moderator of Object.keys(this.subredditModerators)) {
            this.createModeratorRow(moderator);
        }

        $('.reddit-moderationlog').off('click').click(e => {
            e.preventDefault();
            if (wrapper.is(':hidden')) {
                wrapper.show();
                previousContent.hide();
                location.hash = 'matrix';
            } else {
                previousContent.show();
                wrapper.hide();
                location.hash = '';
            }
            return false;
        });

    // Load data
    // this.getActions();
    };

    self.highlightPercentages = function () {
        const threshold = parseInt($('#highlightpercentages').val());
        $('#mod-matrix tr').removeClass('highlight');
        if (threshold === 0) {
            return;
        }
        $('#mod-matrix td.action-percentage .action-number').each(function () {
            if (parseInt($(this).text()) < threshold) {
                $(this).parents('tr:first').addClass('highlight');
            }
        });
    };

    self.submitForm = function (form) {
        self.resetData();

        const from = $(form).find('input[name=from]').val();
        const to = $(form).find('input[name=to]').val();

        const fromUTC = this.dateToUTC(new Date(from));
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        const toUTC = this.dateToUTC(toDate);

        self.maxDate = toUTC.getTime();
        self.minDate = fromUTC.getTime();
        TB.ui.longLoadSpinner(true);
        this.getRecursiveActions(null, null);
    };

    self.resetData = function () {
        self.after = null;
        self.firstEntry = null;
        self.lastEntry = null;
        self.subredditActions = this.getSubredditActions();
        self.subredditModerators = this.getSubredditModerators();
        self.modFilter = [];
        self.actionFilter = [];
        self.total = 0;
        self.iterations = 0;
        $('#mod-matrix .action-number').text('0');
    };

    self.getRecursiveActions = function (data, hasMoreData) {
        self.iterations += 1;
        if (hasMoreData == null || hasMoreData === true) {
            self.getActions(self.getRecursiveActions);
        } else {
            self.refreshTable();
            TB.ui.longLoadSpinner(false);
        }
    };

    self.createModeratorRow = function (moderator) {
        const body = $('#mod-matrix tbody');
        if (body.find(`tr.moderator-${moderator}`).length > 0) {
            return;
        }
        const row = $('<tr></tr>').addClass(`moderator-${moderator}`).addClass('mod-row');

        row.append(`<td><a href="${TBCore.link(`/user/${moderator}`)}" target="_blank" title="${moderator}">${moderator}</a></td>`);
        for (const subredditAction of Object.keys(this.subredditActions)) {
            const td = $(`<td class="action-cell action-${subredditAction}"><a title="${this.subredditActions[subredditAction].title} actions by ${moderator}" target="_blank" class="action-number" href="${this.subredditUrl}about/log?type=${subredditAction}&mod=${moderator}">0</a></td>`);
            row.append(td);
        }
        row.append(`<td class="action-total"><a class="action-number" target="_blank" title="total actions by ${moderator}"  href="${this.subredditUrl}about/log?mod=${moderator}">0</a></td>`);
        row.append(`<td class="action-percentage"><span class="action-number" title="percentage of actions by ${moderator}">0</span><span>%</span></td>`);

        body.append(row);
    };

    self.dataCache = [];

    self.clearCache = function () {
        self.dataCache = [];
    };

    self.getActions = function (callback) {
        const requestData = {
            limit: this.limit,
            count: (this.iterations - 1) * this.limit,
        };

        if (this.after != null) {
            requestData.after = this.after;
        }

        self.log(`Retreiving ${requestData.count} to ${requestData.count + requestData.limit}`);
        $('#mod-matrix-statistics').text(`loading entries ${requestData.count} to ${requestData.count + requestData.limit}...`);
        $('#mod-matrix-settings input[type=submit]').prop('disabled', true);

        const relativeSubredditUrl = this.subredditUrl.replace(/https?:\/\/...?\.reddit\.com/, '');

        const url = `${relativeSubredditUrl}about/log.json`;
        const cacheKey = `${url}?${JSON.stringify(requestData)}`;

        if (this.dataCache[cacheKey] != null) {
            self.processData(this.dataCache[cacheKey], callback);
        } else {
            TBApi.getJSON(url, requestData).then(response => {
                TBStorage.purifyObject(response);
                self.log(`Got ${requestData.count} to ${requestData.count + requestData.limit}`);
                const data = response.data;
                self.processData(data, callback);
                self.dataCache[cacheKey] = data;
            })
                .catch(error => {
                    self.log(`Mod log request ${requestData.count} to ${requestData.count + requestData.limit} failed:`, error);
                    if (error.response && error.response.status === 504) {
                        self.log('Retrying mod log request...');
                        self.getActions(callback);
                    } else {
                        // End and display what we have with an error
                        self.processData(null, callback);
                    }
                });
        }
    };

    self.updateFilters = function () {
        self.modFilter = [];
        if (!$('#modmatrixmodfilter-all').is(':checked')) {
            const modFilters = $('#mod-matrix-settings .mod-filter:checked');

            modFilters.each(function () {
                if ($(this).val() !== '') {
                    self.modFilter.push($(this).val());
                }
            });
        }
        self.actionFilter = [];
        if (!$('#modmatrixactionfilter-all').is(':checked')) {
            const actionFilters = $('#mod-matrix-settings .action-filter:checked');

            actionFilters.each(function () {
                if ($(this).val() !== '') {
                    self.actionFilter.push($(this).val());
                }
            });
        }
    };

    self.refreshTable = function () {
        this.updateFilters();
        const hasModFilter = self.modFilter != null && !$.isEmptyObject(self.modFilter),
              hasActionFilter = self.actionFilter != null && !$.isEmptyObject(self.actionFilter),
              matrix = $('#mod-matrix');

        // modLogMatrix.filterModeratorActions();

        // Mod numbers
        for (const mod of Object.keys(this.subredditModerators)) {
            const moderator = self.subredditModerators[mod],
                  modRow = matrix.find(`.moderator-${mod}`);
            for (const action of Object.keys(moderator)) {
                const value = parseInt(moderator[action]);
                modRow.find(`.action-${action} .action-number`).text(value);
            }
            modRow.toggleClass('filtered', hasModFilter && !self.modFilter.includes(mod));
            // matrix.find(".moderator-" + mod + " .action-total").text(total);
        }
        // modLogMatrix.filterModeratorActions();

        // Action totals
        for (const action of Object.keys(this.subredditActions)) {
            // var total = actionTotals[action] || 0;
            matrix.find(`.action-${action}`).toggleClass('filtered', hasActionFilter && !self.actionFilter.includes(action));
            let total = 0;
            matrix.find(`tbody .action-${action} .action-number:visible`).each(function () {
                total += parseInt($(this).text());
            });

            matrix.find(`tfoot .action-${action} .action-number`).text(total);
        }

        // modLogMatrix.filterColumnActions();
        // modLogMatrix.highlightPercentages();

        matrix.find('tfoot tr, tbody tr').each(function () {
            let rowTotal = 0;
            $(this).find('.action-cell .action-number:visible').each(function () {
                rowTotal += parseInt($(this).text());
            });
            $(this).find('.action-total .action-number').text(rowTotal);
        });

        const allTotal = parseInt(matrix.find('tr.totals .action-total .action-number').text());
        if (allTotal > 0) {
            matrix.find('tbody tr').each(function () {
                const total = parseInt($(this).find('.action-total .action-number').text());
                const percentage = parseInt(total / allTotal * 100);
                $(this).find('.action-percentage .action-number').text(percentage);
            });
        } else {
            matrix.find('.action-percentage .action-number').text('0');
        }

        this.highlightPercentages();
        // Re-sort table
        if (this.currentSorting.index != null) {
            this.sort(this.currentSorting.index, this.currentSorting.direction);
        }
    };

    self.processData = function (data, callback) {
        let finished = data == null;
        const errored = finished;

        if (!finished) {
            for (let i = 0; i < data.children.length; i++) {
                const item = data.children[i].data;

                const action = item.action;
                const mod = item.mod;
                let moderator = self.subredditModerators[mod];

                if (self.minDate != null && self.minDate > item.created_utc * 1000) {
                // self.log("Item older than fromDate", item.created_utc, modLogMatrix.minDate);
                    finished = true;
                    break;
                } else if (
                    self.maxDate != null && self.maxDate < item.created_utc * 1000
                // (hasModFilter && $.inArray(mod, modLogMatrix.modFilter) == -1) ||
                // (hasActionFilter && $.inArray(action, modLogMatrix.actionFilter)  == -1)
                ) {
                // self.log("Item newer than toDate", item.created_utc, modLogMatrix.maxDate);
                    continue;
                }

                if (self.firstEntry == null) {
                    self.firstEntry = item;
                    if (i !== 0 || self.after != null) {
                        self.beforeFirst = data.children[i - 1].data;
                    }
                }

                if (moderator == null) {
                    moderator = {total: 0};
                    self.subredditModerators[mod] = moderator;
                    self.createModeratorRow(mod);
                }

                const actionCount = moderator[action] ? moderator[action] + 1 : 1;

                moderator[action] = actionCount;

                // modLogMatrix.subredditActions[action].total += 1;
                self.total += 1;
                self.lastEntry = item;

            // Update html
            // matrix.find(".moderator-" + mod + " .action-" + action + "").text(moderator[action]);
            // matrix.find(".moderator-" + mod + " .action-total").text(moderator.total);
            // matrix.find(".totals .action-" + action + "").text(modLogMatrix.subredditActions[action].total);
            // matrix.find(".totals .action-total").text(modLogMatrix.total);
            }

            // Are we finished, or should we keep going?
            if (data.after === self.after || data.after == null || finished === true) {
                finished = true;
            } else {
                self.after = data.after;
            }
        }

        // Show statistics
        if (finished && self.firstEntry != null && self.lastEntry != null) {
            const lastEntryDate = new Date(self.lastEntry.created_utc * 1000);
            const firstEntryDate = new Date(self.firstEntry.created_utc * 1000);
            $('#mod-matrix-statistics').html(TBStorage.purify(`showing <strong>${self.total} actions</strong> between <strong title="${lastEntryDate}">${lastEntryDate.toDateString().toLowerCase()}</strong> and <strong title="${firstEntryDate}">${firstEntryDate.toDateString().toLowerCase()}</strong> ${errored ? "(<span style='color:red'>error occured</span>)" : ''} | <a id="exporttocsv">export table to CSV</a>`));
            $('#exporttocsv').click(self.exportToCSV).attr({
                download: `${self.subredditName}-modlog.csv`,
                target: '_blank',
            });
        } else {
            $('#mod-matrix-statistics').html('no actions during requested period');
        }
        $('#mod-matrix-settings input[type=submit]').prop('disabled', false);

        // Invoke callback
        if (callback != null) {
            callback(data, !finished);
        }
    };

    self.exportToCSV = function () {
        const table = $('#mod-matrix');

        let header = '';
        table.find('thead th').each(function () {
            if ($(this).find('a').length > 0) {
                header += $(this).find('a').attr('title');
            } else {
                header += $(this).text();
            }
            header += ',';
        });

        let body = '';
        table.find('tbody tr').each(function () {
            let row = '';
            $(this).find('td').each(function () {
                row += `${$(this).text()},`;
            });
            if (row.charAt(row.length - 1) === ',') {
                row = row.substring(0, row.length - 1);
            }
            body += `\r\n${row}`;
        });

        let footer = '\r\n';
        table.find('tfoot td').each(function () {
            footer += `${$(this).text()},`;
        });
        const string = header + body + footer;
        this.href = `data:text/csv;charset=utf-8,${escape(string || 'sep=, \r\n')}`;
    };

    self.getSubredditUrl = function () {
        return $('#header .hover.pagename.redditname a').attr('href');
    };

    self.getSubredditModerators = function () {
        let modItems = $('.drop-choices.lightdrop:not(.modaction-drop) a:not(.primary)');

        if ($('.drop-choices.lightdrop:not(.modaction-drop) a.primary').length) {
            modItems = modItems.add('.dropdown.lightdrop:not(.modaction-drop) .selected');
        }

        modItems = $.makeArray(modItems);

        modItems.sort((a, b) => {
            const aText = $(a).text().toLowerCase(),
                  bText = $(b).text().toLowerCase();
            if (aText === bText) {
                return 0;
            } else {
                return aText > bText ? 1 : -1;
            }
        });

        const moderators = {};

        $(modItems).each(function () {
            const mod = $(this).text();
            if (mod === 'all' || /\*/.test(mod)) {
                return;
            }

            moderators[$(this).text()] = {};
        });

        return moderators;
    };

    self.getSubredditActions = function () {
        let actionItems = $('.drop-choices.lightdrop.modaction-drop a');

        if ($('.drop-choices.lightdrop.modaction-drop a.primary').length) {
            actionItems = actionItems.add('.dropdown.lightdrop.modaction-drop .selected');
        }

        const actions = {};

        actionItems.each(function () {
            if ($(this).text() === 'all') {
                return;
            }

            const actionLink = $(this).attr('href');
            const actionCode = self.getQuerystringByName('type', actionLink);
            actions[actionCode] = {title: $(this).text(), className: actionCode};
        });

        return actions;
    };

    self.getQuerystringByName = function (name, url) {
        if (url == null) {
            url = location.search;
        }
        name = name.replace(/[[]/, '\\[').replace(/[\]]/, '\\]');
        const regex = new RegExp(`[\\?&]${name}=([^&#]*)`),
              results = regex.exec(url);
        return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
    };

    self.dateToUTC = function (date) {
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
    };

    self.init = function () {
        if (!TBCore.isModLogPage) {
            return;
        }

        self.log('Running Mod Matrix Module');
        self.run();

        const $body = $('body');

        let lastAfter;

        const $nerNext = $body.find('#NERStaticLink');
        const nerActive = $nerNext.length;
        let loadComments = false;
        const parser = SnuOwnd.getParser(SnuOwnd.getRedditRenderer());
        $('.content .menuarea').append('<div class="spacer"><a href="javascript:;" class="activate-comment-load tb-general-button" >Load text of comments</a></div>');

        function getComments (modlogUrl) {
            TB.ui.longLoadSpinner(true);

            TBApi.getJSON(modlogUrl, {
                raw_json: 1,
            }).then(result => {
                TBStorage.purifyObject(result);
                lastAfter = result.data.after;
                const $modActions = $('.modactionlisting');
                $modActions.addClass('tb-comments-loaded');
                result.data.children.forEach(child => {
                    if (child.data.target_body && child.data.target_fullname.startsWith('t1_')) {
                        const $listingItem = $modActions.find(`tr.modactions[data-fullname="${child.data.id}"] .description`);

                        // Render string markdown to HTML first.
                        const renderedMarkdown = TBStorage.purify(parser.render(child.data.target_body));

                        // Put it in a template.
                        const comment = `
                            <div class="modlog_comment_text ${child.data.action}">
                                <div class="md">

${renderedMarkdown}

                                </div>
                            </div>
                        `;

                        $listingItem.append(comment);
                    }
                });
                TB.ui.longLoadSpinner(false);
            });
        }

        $body.on('click', '.activate-comment-load', function () {
            loadComments = true;
            $(this).hide();
            const modlogUrl = `${location.pathname}.json${location.search}`;
            getComments(modlogUrl);
        });

        // NER support.
        window.addEventListener('TBNewThings', () => {
            if (loadComments && nerActive) {
                const linkUrl = new URL(location);
                linkUrl.searchParams.set('after', lastAfter);
                const modlogUrl = `${linkUrl.pathname}.json${linkUrl.search}`;
                getComments(modlogUrl);
            }
        });
    };

    self.log('Registering module');
    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    modmatrix();
});
