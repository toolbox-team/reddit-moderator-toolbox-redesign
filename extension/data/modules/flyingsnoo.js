'use strict';

function flyingsnoo () {
// @name       Flying Snoo
// @namespace  http://reddit.com/user/LowSociety
// @copyright  2014+, LowSociety

    const self = new TB.Module('Userpage');
    self.shortname = 'Userpage';

    // //Default settings
    self.settings['enabled']['default'] = true;
    self.settings['enabled']['hidden'] = true; // it's an easter egg.

    self.init = function () {
        if (TBCore.isNewModmail) {
            return;
        }
        const $footerblock = $('body').find('#tb-footer-block');
        const $snooFooter = $('<div id="tb-snoo-footer"></div>').appendTo($footerblock);
        $snooFooter.css({
            'background-image': `url(${browser.runtime.getURL('data/images/balloon.png')})`,
            'background-repeat': 'no-repeat',

        });

        $snooFooter.click(function () {
            const width = 87,
                  height = 145;

            // unlock achievement
            TBCore.sendEvent(TBCore.events.TB_FLY_SNOO);

            const floater = $('<div></div>').css({
                height: `${height}px`,
                width: `${width}px`,
                background: `url(${browser.runtime.getURL('data/images/snoo_up.png')})`,
                position: 'absolute',
                top: `${$(this).offset().top}px`,
                left: `${$(window).width() * 0.49 - width / 2}px`,
                zIndex: 999,
            }).appendTo('body');

            const documentHeight = $(document).height(),
                  documentWidth = $(document).width();
            let iterations = 0,
                wind = 0,
                oldTop = floater.position().top,
                oldLeft = floater.position().left;

            let keepFlying = false;

            function startFlying () {
                const newTop = Math.max(0, oldTop - documentHeight * 0.0002);

                if (iterations % 50 === 0) {
                    wind = (Math.random() * 200 - 100) * 0.02;
                }

                const newLeft = Math.min(documentWidth - width, Math.max(0, oldLeft + wind));

                floater.css({
                    top: `${newTop}px`,
                    left: `${newLeft}px`,
                });

                iterations++;
                if (newTop > 0 && keepFlying) {
                    requestAnimationFrame(startFlying);
                }
                oldTop = newTop;
                oldLeft = newLeft;
            }

            function killSnoo () {
                const newTop = oldTop + Math.min(50, Math.max(10, oldTop * 0.0005));
                floater.css({
                    top: `${newTop}px`,
                });
                oldTop = newTop;
                if (oldTop + height >= documentHeight) {
                    floater.css({
                        top: `${documentHeight - height - 40}px`,
                    });
                    floater.css('background', `url(${browser.runtime.getURL('data/images/snoo_splat.png')})`);

                    // unlock achievement
                    TBCore.sendEvent(TBCore.events.TB_KILL_SNOO);
                } else {
                    requestAnimationFrame(killSnoo);
                }
            }

            floater.mousedown(e => {
                if (keepFlying) {
                    keepFlying = false;
                }
                floater.data('offsetX', e.offsetX);
                floater.data('offsetY', e.offsetY);

                function dragEvent (e) {
                    const offsetX = floater.data('offsetX') || 0,
                          offsetY = floater.data('offsetY') || 0;
                    oldLeft = e.pageX - offsetX;
                    oldTop = e.pageY - offsetY;
                    floater.css({
                        left: `${oldLeft}px`,
                        top: `${oldTop}px`,
                    });
                }

                function releaseEvent () {
                    if (!keepFlying) {
                        keepFlying = true;
                        startFlying();
                        $(document).unbind('mousemove', dragEvent);
                        $(document).unbind('mouseup', releaseEvent);
                    }
                }

                $(document).bind('mousemove', dragEvent).bind('mouseup', releaseEvent);
            }).dblclick(function () {
                if (keepFlying) {
                    keepFlying = false;
                }
                $(this).unbind('mousedown');
                $(this).css('background', `url(${browser.runtime.getURL('data/images/snoo_uh_oh.png')})`);
                killSnoo();
            });

            $(this).css('background', 'transparent');
            keepFlying = true;
            startFlying();
        });
    };

    TB.register_module(self);
}

window.addEventListener('TBModuleLoaded', () => {
    flyingsnoo();
}, {
    once: true,
});
