# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#    Copyright (C) 2011-2013 Serpent Consulting Services Pvt. Ltd. (<http://serpentcs.com>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

import datetime
import json
import logging
import select
import time

import openerp
import openerp.tools.config
import openerp.modules.registry
from openerp import http
from openerp.http import request
from openerp.osv import osv, fields, expression
from openerp.tools.misc import DEFAULT_SERVER_DATETIME_FORMAT
from openerp import SUPERUSER_ID
from openerp.osv import fields

#_logger = logging.getLogger(__name__)

class TableController(http.Controller):

    @http.route('/poi_web_alert/get_alert', type='json', auth='user')
    def get_alert(self, **kw):
        result = []
        alert_obj = request.registry['web.alert']

        #We're looking for all the messages for the current user but that were not displayed
        alert_ids = alert_obj.search(request.cr, SUPERUSER_ID, ['&','&',('to','=',request.uid),('displayed','=',False),'|',('time_programmed','=',None),('time_programmed','<',datetime.datetime.now().strftime(DEFAULT_SERVER_DATETIME_FORMAT))])

        #ToDo create a cron job that every hour looks for displayed messages but not read to change their state to not displayed
        #ToDo create a cron job that clears database from every read and displayed message

        if alert_ids:
            for alert in alert_obj.browse(request.cr, SUPERUSER_ID, alert_ids):
                result.append({'id': alert.id,
                               'message': alert.message,
                               'relevance': alert.relevance})
                alert.write({'displayed': True})
        return result

    @http.route('/poi_web_alert/set_alert_as_displayed', type='json', auth='user')
    def set_alert_as_displayed(self, alert_id, noty_id, **kw):
        alert_obj = request.registry['web.alert']

        alert = alert_obj.browse(request.cr, SUPERUSER_ID, alert_id)
        if alert.relevance in ('information','warning','notification','success'):
            alert.write({'read': True, 'noty_id': noty_id})
        else:
            alert.write({'noty_id': noty_id})

    @http.route('/poi_web_alert/set_alert_as_read', type='json', auth='user')
    def set_alert_as_read(self, alert_id, **kw):
        alert_obj = request.registry['web.alert']

        alert = alert_obj.browse(request.cr, SUPERUSER_ID, alert_id)
        alert.write({'read': True})

    @http.route('/poi_web_alert/remind_me_later', type='json', auth='user')
    def remind_me_later(self, alert_id, **kw):
        alert_obj = request.registry['web.alert']

        alert = alert_obj.browse(request.cr, SUPERUSER_ID, alert_id)
        alert_time = datetime.datetime.now()+datetime.timedelta(hours=1)
        alert.write({'time_programmed': alert_time.strftime(DEFAULT_SERVER_DATETIME_FORMAT), 'displayed': False})