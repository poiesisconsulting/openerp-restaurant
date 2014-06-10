# -*- coding: utf-8 -*-
import logging
import simplejson
import os
import openerp
import time
import random

from openerp import http
from openerp.http import request
from openerp.addons.web.controllers.main import manifest_list, module_boot, html_template, login_redirect

_logger = logging.getLogger(__name__)

html_template = """"""

class PosController(http.Controller):

    @http.route('/pos/web', type='http', auth='none')
    def a(self, debug=False, **k):

        if not request.session.uid:
            return login_redirect()

        js_list = manifest_list('js',db=request.db, debug=debug)
        js =  "\n".join('<script type="text/javascript" src="%s"></script>' % i for i in js_list)
        modules =  simplejson.dumps(module_boot(request.db))
        init =  """
                 var wc = new s.web.WebClient();
                 wc.show_application = function(){
                     wc.action_manager.do_action("pos.ui");
                 };
                 wc.appendTo($(document.body));
                 """

        html = request.registry.get('ir.ui.view').render(request.cr, request.session.uid,'point_of_sale.index',{
            'js': js,
            'modules': modules,
            'init': init,
            })

        return html

