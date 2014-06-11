# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
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

from openerp.osv import fields, osv
import time

from datetime import date, timedelta, datetime


class server_closing(osv.osv_memory):
    _name = 'hph.server.closing'

    def _start_date(self, cr, uid, context=None):
        if context is None:
            context = {}
        new_date = datetime.now() - timedelta(days=1)
        return new_date.strftime('%Y-%m-%d %H:%M:%S')

    _columns = {
        'user_id': fields.many2one('res.users', 'Server', required=True),
        'date_start': fields.datetime('Date Start', required=True),
        'date_end': fields.datetime('Date End', required=True)
    }

    _defaults = {
        'date_start': _start_date,
        'date_end': lambda *a: time.strftime('%Y-%m-%d %H:%M:%S')
    }

    _rec_name = 'user_id'

    def print_report(self, cr, uid, ids, context=None):
        """
             To get the date and print the report
             @param self: The object pointer.
             @param cr: A database cursor
             @param uid: ID of the user currently logged in
             @param context: A standard dictionary
             @return : retrun report
        """
        if context is None:
            context = {}
        data = {}
        data['ids'] = context.get('active_ids', [])
        data['model'] = context.get('active_model', 'ir.ui.menu')
        data['form'] = self.read(cr, uid, ids, ['user_id',  'date_start',  'date_end'], context=context)[0]
        #for field in ['fiscalyear_id', 'chart_account_id', 'period_from', 'period_to']:
        #    if isinstance(data['form'][field], tuple):
        #        data['form'][field] = data['form'][field][0]
        #used_context = self._build_contexts(cr, uid, ids, data, context=context)
        #data['form']['periods'] = used_context.get('periods', False) and used_context['periods'] or []
        #data['form']['used_context'] = dict(used_context, lang=context.get('lang', 'en_US'))
        return self.pool['report'].get_action(cr, uid, ids, 'poi_x_hph.report_server_closing', data=data, context=context)