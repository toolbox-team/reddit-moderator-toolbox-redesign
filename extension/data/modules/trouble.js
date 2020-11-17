'use strict';

function trouble () {
    const self = new TB.Module('Trouble Shooter');
    self.shortname = 'Trouble';
    self.oldReddit = true;

    // Default settings
    self.settings['enabled']['default'] = false;
    self.config['betamode'] = false;

    self.register_setting('highlightAuto', {
        type: 'boolean',
        default: false,
        title: 'Highlight comments automatically',
    });

    self.register_setting('negHighlightThreshold', {
        type: 'number',
        default: 0,
        title: 'Negative comment highlight score threshold',
    });

    self.register_setting('highlightControversy', {
        type: 'boolean',
        default: true,
        title: 'Highlight controversial comments',
    });

    self.register_setting('expandOnLoad', {
        type: 'boolean',
        default: false,
        title: 'Expand all downvoted/controversial comments on page load',
    });

    self.register_setting('sortOnMoreChildren', {
        type: 'boolean',
        default: false,
        title: 'Continue to sort children on "load more comments"',
    });

    self.register_setting('displayNChildren', {
        type: 'boolean',
        default: true,
        title: 'Always display the number of children a comment has.',
    });

    self.register_setting('displayNChildrenTop', {
        type: 'boolean',
        default: false,
        advanced: true,
        title: 'Display the number of children a comment has in the upper left.  This may change the normal flow of the comments page slightly.',
    });

    self.sorted = false;
    self.pending = [];

    self.init = function () {
        const neg_thresh_pref = self.setting('negHighlightThreshold'),
              highlightControversy = self.setting('highlightControversy'),
              expand = self.setting('expandOnLoad'),
              auto = self.setting('highlightAuto'),
              sortOnMoreChildren = self.setting('sortOnMoreChildren'),
              nChildren = self.setting('displayNChildren'),
              nChildrenTop = self.setting('displayNChildrenTop'),
              $body = $('body'),
              $buttons = $('<div id="tb-trouble-buttons">'),
              $init_btn = $('<button id="tb-trouble-init" class="tb-action-button">Trouble Shoot</button>').click(start);
        let $sitetable;

        if (!TBCore.isMod) {
            return;
        }

        if (!TBCore.isCommentsPage) {
            return;
        }

        if ($body.hasClass('listing-page')) {
            $sitetable = $('.content').children('.sitetable');
        } else {
            $sitetable = $('.commentarea').children('.sitetable');
        }

        $sitetable.before($buttons);

        if (auto) {
            start();
        } else {
            $buttons.append($init_btn);
        }

        function start () {
            $init_btn.remove();

            $body.addClass('tb-trouble');
            if (highlightControversy) {
                $body.addClass('tb-controversy-hl');
            }
            if (nChildren) {
                $body.addClass('tb-nchildren');
            }
            if (nChildrenTop) {
                $body.addClass('tb-nchildrentop');
            }

            $buttons.append($('<button id="tb-trouble-sort" class="tb-action-button">Sort</button>').click(sortChildren))
                .append($('<button class="tb-action-button" id="tb-trouble-collapse">Collapse</button>').click(collapseNonDrama));

            if (sortOnMoreChildren) {
                $('.commentarea').on('click', '.morecomments', function () {
                    if (self.sorted) {
                        self.pending.push(sortMe.bind($(this).closest('.sitetable')));
                    }
                });
            }
            window.addEventListener('TBNewThings', () => {
                run();
            });

            run();

            if (expand) {
                $('.thing.tb-controversy, .thing.tb-ncontroversy').each(uncollapseThing);
            }
        }

        function run () {
            const $things = $('.thing.comment').not('.tb-pc-proc');

            highlightComments($things);

            while (self.pending.length) {
                self.pending.pop()();
            }

            if (expand) {
                $('.thing.tb-controversy, .thing.tb-ncontroversy').not('.tb-pc-proc').each(uncollapseThing);
            }

            markProcessedThings();
        }

        function highlightComments ($things) {
            const controversial = /\bcontroversial\b/;

            $things.find('.numchildren').each(numChildren);

            $things.find('.score.unvoted').each(score);

            if (highlightControversy) {
                $things.filter(function () {
                    return controversial.test(this.className);
                })
                    .children('.entry').addClass('tb-controversy')
                    .parents('.thing').addClass('tb-controversy');
            }
        }

        function score () {
            const $this = $(this),
                  $thing = $this.closest('.thing');
            let neg_thresh = neg_thresh_pref;

            // lower the threashold by one for user's comments
            if (RegExp(`/${TBCore.logged}\\b`).test($thing.children('.entry').find('.author')[0].href)) {
                --neg_thresh;
            }

            // highlighting here to avoid another .each() iteration
            if (($thing[0].dataset.score = $this.text().match(/^(-)?\d+/)[0]) <= neg_thresh) {
                $thing.addClass('tb-neg tb-ncontroversy')
                    .parents('.thing').addClass('tb-ncontroversy');
            }
        }

        function numChildren () {
            const $this = $(this);

            $this.closest('.thing')[0].dataset.nchildren = $this.text().match(/\d+/)[0];
        }

        function sortChildren () {
            self.sorted = true;
            sortMe.call($(this).closest('.sitetable, .commentarea, .content').children('.sitetable'));
        }

        function fixFlatNER ($this) {
            const $NERs = $this.find('.linklisting');
            if (!$NERs.length) {
                return;
            }

            $this.append($NERs.children('.thing'));
            $('.NERPageMarker, .clearleft + .clearleft').remove();
        }

        function sortMe () {
            const $this = $(this);

            fixFlatNER($this);

            const $things = $this.children('.thing').not('.morechildren')
                .sort((a, b) => b.dataset.nchildren - a.dataset.nchildren);

            $this.prepend($things)
                .prepend($this.children('.thing.tb-controversy'))
                .prepend($this.children('.thing.tb-ncontroversy'));

            $things.children('.child').children('.sitetable').each(sortMe);
        }

        function collapseThing () {
            $(this).addClass('collapsed').children('.entry').find('.expand').text('[+]');
        }

        function uncollapseThing () {
            $(this).removeClass('collapsed').children('.entry').find('.expand').text('[–]');
        }

        function markProcessedThings () {
            $('.thing').not('.tb-pc-proc').addClass('tb-pc-proc');
        }

        function collapseNonDrama () {
            $('.thing.tb-controversy, .thing.tb-ncontroversy').each(uncollapseThing);

            $('.commentarea').add($('.thing.tb-controversy, .thing.tb-ncontroversy').children('.child'))
                .children('.sitetable').children('.thing').not('.tb-controversy, .tb-ncontroversy')
                .each(collapseThing); // collapsing only top-level-most comment children of drama
        }
        /*  TODO

    Include below threshold comments when the score is hidden?

    */
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    trouble(); // run
}, {
    once: true,
});
